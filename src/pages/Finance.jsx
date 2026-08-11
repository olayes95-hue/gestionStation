import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useStation } from '../lib/station.jsx'
import { fcfa } from '../lib/format'

const N = (v) => (v ? Number(v) : 0)
// charges saisies à la main (les récurrentes se reportent d'un mois sur l'autre)
const MANUAL_CATS = ['LOYER','SALAIRES','PRELEVEMENT_GERANT','IMPOTS','HONORAIRES','PRESTATIONS','PERTE_VENTE_CARBURANT','SONEB','TELEPHONE','AUTRE']
const REVENU_CAT = 'AUTRES_PRODUITS'
// dépenses quotidiennes -> charge auto
const EXP_MAP = { SBEE: 'SBEE (auto)', CARBURANT: 'Carburant / déplacement (auto)' }

export default function Finance() {
  const { session } = useAuth()
  const { stationId } = useStation()
  const [ventes, setVentes] = useState([])
  const [charges, setCharges] = useState([])
  const [expenses, setExpenses] = useState([])
  const [pertes, setPertes] = useState([])
  const [stockVal, setStockVal] = useState([])
  const [settings, setSettings] = useState({ taux_gaz: 8, taux_superette: 8 })
  const [annee, setAnnee] = useState('')
  const [mois, setMois] = useState('')
  const [nc, setNc] = useState({ categorie: 'LOYER', montant: '', note: '' })
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')

  async function load() {
    if (!stationId) return
    const [v, c, e, st, p, sv] = await Promise.all([
      supabase.from('v_ventes_mensuelles').select('*').eq('station_id', stationId).order('mois'),
      supabase.from('charges').select('*').eq('station_id', stationId),
      supabase.from('expenses').select('report_date,categorie,montant').eq('station_id', stationId),
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('v_pertes_mensuelles').select('*').eq('station_id', stationId),
      supabase.from('v_stock_valeur').select('*').eq('station_id', stationId),
    ])
    setVentes(v.data || []); setCharges(c.data || []); setExpenses(e.data || [])
    if (st.data) setSettings(st.data)
    setPertes(p.data || []); setStockVal(sv.data || [])
  }
  useEffect(() => { load() }, [stationId])

  const annees = useMemo(() => [...new Set(ventes.map(v => v.mois.slice(0, 4)))].sort(), [ventes])
  useEffect(() => { if (!annee && annees.length) setAnnee(annees[annees.length - 1]) }, [annees])

  const inPeriod = (m) => mois ? m === mois : (m || '').startsWith(annee)
  const V = ventes.filter(v => inPeriod(v.mois))
  const sum = (k) => V.reduce((s, v) => s + N(v[k]), 0)
  const commCarb = sum('commission_carburant')
  // commissions AUTO des autres pôles = ventes × taux
  const commGazLub = (sum('ventes_gaz') + sum('ventes_lubrifiant')) * N(settings.taux_gaz) / 100
  const commSuperette = sum('ventes_superette') * N(settings.taux_superette) / 100

  // charges AUTO depuis les dépenses quotidiennes (SBEE, carburant)
  const autoCharges = {}
  for (const e of expenses) {
    const m = (e.report_date || '').slice(0, 7)
    if (!inPeriod(m)) continue
    if (e.categorie === 'SBEE' || e.categorie === 'CARBURANT')
      autoCharges[e.categorie] = (autoCharges[e.categorie] || 0) + N(e.montant)
  }
  const totAuto = Object.values(autoCharges).reduce((s, v) => s + v, 0)

  // charges MANUELLES
  const chP = charges.filter(c => inPeriod(c.mois))
  const autresProduits = chP.filter(c => c.categorie === REVENU_CAT).reduce((s, c) => s + N(c.montant), 0)
  const totManuel = chP.filter(c => c.categorie !== REVENU_CAT).reduce((s, c) => s + N(c.montant), 0)

  // pertes livraison non acceptables sur la période
  const pertesP = pertes.filter(p => inPeriod(p.mois))
  const perteNaMontant = pertesP.reduce((s, p) => s + N(p.perte_na_montant), 0)
  const perteNaLitres = pertesP.reduce((s, p) => s + N(p.perte_na_litres), 0)

  const totCharges = totAuto + totManuel
  const produits = commCarb + commGazLub + commSuperette + autresProduits
  const resultat = produits - totCharges

  const flash = (m) => { setMsg(m); setErr(''); setTimeout(() => setMsg(''), 2500) }
  async function addCharge(e) {
    e.preventDefault(); setErr('')
    if (!mois) { setErr('Choisis un mois précis pour saisir une charge.'); return }
    if (!nc.montant) return
    const { error } = await supabase.from('charges').insert({ station_id: stationId, mois, categorie: nc.categorie, montant: Number(nc.montant), note: nc.note || null, created_by: session.user.id })
    if (error) setErr(error.message); else { setNc({ categorie: 'LOYER', montant: '', note: '' }); flash('Charge ajoutée ✓'); load() }
  }
  async function delCharge(id) { await supabase.from('charges').delete().eq('id', id); load() }
  // proposer : copier les charges récurrentes du mois précédent
  async function reporterMoisPrecedent() {
    if (!mois) return
    const [y, m] = mois.split('-').map(Number)
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
    const prevRows = charges.filter(c => c.mois === prev && c.categorie !== REVENU_CAT && c.categorie !== 'PERTE_VENTE_CARBURANT')
    if (!prevRows.length) { setErr(`Aucune charge sur ${prev} à reporter.`); return }
    const rows = prevRows.map(c => ({ station_id: stationId, mois, categorie: c.categorie, montant: c.montant, note: 'proposé (report ' + prev + ')', created_by: session.user.id }))
    const { error } = await supabase.from('charges').insert(rows)
    if (error) setErr(error.message); else { flash(`${rows.length} charge(s) reportée(s) de ${prev} ✓`); load() }
  }

  return (
    <div>
      {msg && <div className="ok">{msg}</div>}
      {err && <div className="err">{err}</div>}

      <div className="card">
        <h2>📊 Point financier</h2>
        <div className="toolbar">
          <select value={annee} onChange={e => { setAnnee(e.target.value); setMois('') }}>{annees.map(a => <option key={a}>{a}</option>)}</select>
          <select value={mois} onChange={e => setMois(e.target.value)}>
            <option value="">Année entière</option>
            {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => <option key={m} value={`${annee}-${m}`}>{`${annee}-${m}`}</option>)}
          </select>
        </div>
      </div>

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <Kpi label="Litres carburant" value={Math.round(sum('litres_carburant')).toLocaleString('fr-FR') + ' L'} />
        <Kpi label="Commission carburant" value={fcfa(commCarb)} sub="litres × marge" />
        <Kpi label="Ventes gaz + lubrifiant" value={fcfa(sum('ventes_gaz') + sum('ventes_lubrifiant'))} />
        <Kpi label="Ventes supérette" value={fcfa(sum('ventes_superette'))} />
        <Kpi label="Total charges" value={fcfa(totCharges)} />
        <Kpi label="Valeur du stock" value={fcfa(stockVal.reduce((s, v) => s + N(v.valeur), 0))} sub="gaz + lubrifiant + supérette" />
        <Kpi label="RÉSULTAT" value={fcfa(resultat)} danger={resultat < 0} />
      </div>

      <div className="card" style={{ borderColor: perteNaMontant > 0 ? '#f4c7c7' : 'var(--border)' }}>
        <h2>⚠️ Pertes sur livraisons — {mois || annee}</h2>
        <div className="grid kpis">
          <Kpi label="Pertes NON acceptables" value={Math.round(perteNaLitres).toLocaleString('fr-FR') + ' L'} danger={perteNaLitres > 0} sub={`au-delà de ${settings.taux_perte_acceptable || 5}%`} />
          <Kpi label="Montant (base retenue)" value={fcfa(perteNaMontant)} danger={perteNaMontant > 0} />
        </div>
        <p className="hint" style={{ marginTop: 8 }}>Total des pertes au-delà du seuil de tolérance sur les livraisons réceptionnées. Sert de base à une éventuelle retenue sur le salaire du gérant si non justifiées.</p>
      </div>

      <div className="card">
        <h2>Compte de résultat — {mois || annee}</h2>
        <table><tbody>
          <tr style={{ fontWeight: 600 }}><td>Produits (commissions, auto)</td><td className="num"></td></tr>
          <tr><td style={{ paddingLeft: 20 }}>Commission carburant</td><td className="num">{fcfa(commCarb)}</td></tr>
          <tr><td style={{ paddingLeft: 20 }}>Commission gaz + lubrifiant ({settings.taux_gaz}%)</td><td className="num">{fcfa(commGazLub)}</td></tr>
          <tr><td style={{ paddingLeft: 20 }}>Commission supérette ({settings.taux_superette}%)</td><td className="num">{fcfa(commSuperette)}</td></tr>
          {autresProduits > 0 && <tr><td style={{ paddingLeft: 20 }}>Autres produits (saisis)</td><td className="num">{fcfa(autresProduits)}</td></tr>}
          <tr style={{ fontWeight: 600 }}><td>Charges</td><td className="num"></td></tr>
          <tr><td style={{ paddingLeft: 20 }}>SBEE (auto, depuis dépenses)</td><td className="num">{fcfa(autoCharges.SBEE)}</td></tr>
          <tr><td style={{ paddingLeft: 20 }}>Carburant / déplacement (auto)</td><td className="num">{fcfa(autoCharges.CARBURANT)}</td></tr>
          <tr><td style={{ paddingLeft: 20 }}>Charges fixes (saisies)</td><td className="num">{fcfa(totManuel)}</td></tr>
          <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
            <td>RÉSULTAT</td><td className="num" style={{ color: resultat < 0 ? 'var(--danger)' : 'var(--ok)' }}>{fcfa(resultat)}</td></tr>
        </tbody></table>
        <p className="hint" style={{ marginTop: 8 }}>SBEE et carburant/déplacement sont <b>déduits automatiquement</b> des dépenses saisies au quotidien. Les charges fixes se <b>reportent d'un mois sur l'autre</b> (bouton ci-dessous), tout reste modifiable.</p>
      </div>

      <div className="card">
        <h2>Charges fixes {mois ? `de ${mois}` : ''}</h2>
        {!mois && <p className="hint">Sélectionne un <b>mois précis</b> pour saisir/reporter les charges.</p>}
        {mois && <>
          <div className="toolbar">
            <button className="btn sec small" onClick={reporterMoisPrecedent}>↩︎ Reporter le mois précédent</button>
          </div>
          <form onSubmit={addCharge} className="row-3" style={{ alignItems: 'end' }}>
            <div><label>Catégorie</label>
              <select value={nc.categorie} onChange={e => setNc({ ...nc, categorie: e.target.value })}>
                {MANUAL_CATS.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                <option value={REVENU_CAT}>+ AUTRES PRODUITS (revenu)</option>
              </select></div>
            <div><label>Montant</label><input type="number" inputMode="decimal" value={nc.montant} onChange={e => setNc({ ...nc, montant: e.target.value })} /></div>
            <div><button className="btn small">Ajouter</button></div>
          </form>
        </>}
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead><tr><th>Mois</th><th>Catégorie</th><th className="num">Montant</th><th></th></tr></thead>
            <tbody>
              {chP.sort((a, b) => (a.mois + a.categorie).localeCompare(b.mois + b.categorie)).map(c => (
                <tr key={c.id}>
                  <td>{c.mois}</td>
                  <td>{c.categorie === REVENU_CAT ? '➕ Autres produits' : c.categorie.replace(/_/g, ' ')}{c.note ? ` · ${c.note}` : ''}</td>
                  <td className="num" style={{ color: c.categorie === REVENU_CAT ? 'var(--ok)' : 'inherit' }}>{fcfa(c.montant)}</td>
                  <td><button className="btn sec small" onClick={() => delCharge(c.id)}>Suppr.</button></td>
                </tr>
              ))}
              {!chP.length && <tr><td colSpan={4} className="muted">Aucune charge fixe pour cette période.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
function Kpi({ label, value, sub, danger }) {
  return (<div className="kpi"><div className="label">{label}</div>
    <div className="value" style={{ color: danger ? 'var(--danger)' : 'var(--primary)' }}>{value}</div>
    {sub && <div className="sub">{sub}</div>}</div>)
}
