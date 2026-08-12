import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useStation } from '../lib/station.jsx'
import { fcfa } from '../lib/format'
import { Panel, PanelEmpty } from '../ds/octane/components/core/Panel.jsx'
import { Button } from '../ds/octane/components/core/Button.jsx'
import { Field } from '../ds/octane/components/forms/Field.jsx'
import { Input } from '../ds/octane/components/forms/Input.jsx'
import { Select } from '../ds/octane/components/forms/Select.jsx'
import { AlertBanner } from '../ds/octane/components/feedback/AlertBanner.jsx'
import { DataTable } from '../ds/octane/components/data/DataTable.jsx'
import { Kpi } from '../lib/Kpi.jsx'

const N = (v) => (v ? Number(v) : 0)
// charges saisies à la main (les récurrentes se reportent d'un mois sur l'autre)
const MANUAL_CATS = ['LOYER','SALAIRES','PRELEVEMENT_GERANT','IMPOTS','HONORAIRES','PRESTATIONS','PERTE_VENTE_CARBURANT','SONEB','TELEPHONE','AUTRE']
const REVENU_CAT = 'AUTRES_PRODUITS'
const CAT_OPTIONS = [...MANUAL_CATS.map(c => ({ value: c, label: c.replace(/_/g, ' ') })), { value: REVENU_CAT, label: '+ AUTRES PRODUITS (revenu)' }]

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
    if (error) setErr(error.message); else { setNc({ categorie: 'LOYER', montant: '', note: '' }); flash('Charge ajoutée'); load() }
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
    if (error) setErr(error.message); else { flash(`${rows.length} charge(s) reportée(s) de ${prev}`); load() }
  }

  const anneeOptions = annees.map(a => ({ value: a, label: a }))
  const moisOptions = [{ value: '', label: 'Année entière' }, ...['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => ({ value: `${annee}-${m}`, label: `${annee}-${m}` }))]

  const chargesColumns = [
    { key: 'mois', header: 'Mois' },
    { key: 'categorie', header: 'Catégorie', render: c => `${c.categorie === REVENU_CAT ? 'Autres produits' : c.categorie.replace(/_/g, ' ')}${c.note ? ` · ${c.note}` : ''}` },
    { key: 'montant', header: 'Montant', numeric: true, align: 'right', render: c => <span style={{ color: c.categorie === REVENU_CAT ? 'var(--state-ok)' : 'inherit' }}>{fcfa(c.montant)}</span> },
    { key: 'actions', header: '', align: 'right', render: c => <Button size="sm" tone="danger" onClick={() => delCharge(c.id)}>Suppr.</Button> },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {msg && <AlertBanner tone="ok" title="Succès">{msg}</AlertBanner>}
      {err && <AlertBanner tone="alarm" title="Erreur">{err}</AlertBanner>}

      <Panel title="Point financier" bodyStyle={{ display: 'none' }} actions={<>
        <Select size="sm" value={annee} onChange={e => { setAnnee(e.target.value); setMois('') }} options={anneeOptions} />
        <Select size="sm" value={mois} onChange={e => setMois(e.target.value)} options={moisOptions} />
      </>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)' }}>
        <Kpi label="Litres carburant" value={Math.round(sum('litres_carburant')).toLocaleString('fr-FR')} unit="L" />
        <Kpi label="Commission carburant" value={fcfa(commCarb)} sub="litres × marge" />
        <Kpi label="Ventes gaz + lubrifiant" value={fcfa(sum('ventes_gaz') + sum('ventes_lubrifiant'))} />
        <Kpi label="Ventes supérette" value={fcfa(sum('ventes_superette'))} />
        <Kpi label="Total charges" value={fcfa(totCharges)} />
        <Kpi label="Valeur du stock" value={fcfa(stockVal.reduce((s, v) => s + N(v.valeur), 0))} sub="gaz + lubrifiant + supérette" />
        <Kpi label="RÉSULTAT" value={fcfa(resultat)} status={resultat < 0 ? 'alarm' : 'ok'} />
      </div>

      <Panel title="Pertes sur livraisons" meta={mois || annee} status={perteNaMontant > 0 ? 'alarm' : 'ok'}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)' }}>
          <Kpi label="Pertes NON acceptables" value={Math.round(perteNaLitres).toLocaleString('fr-FR')} unit="L" status={perteNaLitres > 0 ? 'alarm' : 'ok'} sub={`au-delà de ${settings.taux_perte_acceptable || 5}%`} />
          <Kpi label="Montant (base retenue)" value={fcfa(perteNaMontant)} status={perteNaMontant > 0 ? 'alarm' : 'ok'} />
        </div>
        <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 'var(--sp-4)', marginBottom: 0 }}>
          Total des pertes au-delà du seuil de tolérance sur les livraisons réceptionnées. Sert de base à une éventuelle retenue sur le salaire du gérant si non justifiées.
        </p>
      </Panel>

      <Panel title="Compte de résultat" meta={mois || annee}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <LedgerHead>Produits (commissions, auto)</LedgerHead>
          <LedgerRow label="Commission carburant" value={fcfa(commCarb)} />
          <LedgerRow label={`Commission gaz + lubrifiant (${settings.taux_gaz}%)`} value={fcfa(commGazLub)} />
          <LedgerRow label={`Commission supérette (${settings.taux_superette}%)`} value={fcfa(commSuperette)} />
          {autresProduits > 0 && <LedgerRow label="Autres produits (saisis)" value={fcfa(autresProduits)} />}
          <LedgerHead>Charges</LedgerHead>
          <LedgerRow label="SBEE (auto, depuis dépenses)" value={fcfa(autoCharges.SBEE)} />
          <LedgerRow label="Carburant / déplacement (auto)" value={fcfa(autoCharges.CARBURANT)} />
          <LedgerRow label="Charges fixes (saisies)" value={fcfa(totManuel)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--sp-3)', borderTop: '2px solid var(--border-default)', font: 'var(--fw-semibold) 13px/1.2 var(--font-ui)', color: 'var(--text-primary)' }}>
            <span>RÉSULTAT</span>
            <span style={{ color: resultat < 0 ? 'var(--state-alarm)' : 'var(--state-ok)' }}>{fcfa(resultat)}</span>
          </div>
        </div>
        <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 'var(--sp-4)', marginBottom: 0 }}>
          SBEE et carburant/déplacement sont <b>déduits automatiquement</b> des dépenses saisies au quotidien. Les charges fixes se <b>reportent d'un mois sur l'autre</b> (bouton ci-dessous), tout reste modifiable.
        </p>
      </Panel>

      <Panel title="Charges fixes" meta={mois || undefined} flush>
        <div style={{ padding: 'var(--gutter-panel)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {!mois && <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>Sélectionne un <b>mois précis</b> pour saisir/reporter les charges.</p>}
          {mois && <>
            <Button size="sm" onClick={reporterMoisPrecedent} style={{ alignSelf: 'flex-start' }}>Reporter le mois précédent</Button>
            <form onSubmit={addCharge} style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap', alignItems: 'end' }}>
              <Field label="Catégorie" style={{ flex: '1 1 200px' }}>
                <Select value={nc.categorie} onChange={e => setNc({ ...nc, categorie: e.target.value })} options={CAT_OPTIONS} style={{ width: '100%' }} />
              </Field>
              <Field label="Montant" style={{ flex: '1 1 150px' }}>
                <Input type="number" inputMode="decimal" numeric value={nc.montant} onChange={e => setNc({ ...nc, montant: e.target.value })} />
              </Field>
              <Button type="submit" tone="primary">Ajouter</Button>
            </form>
          </>}
        </div>
        {chP.length
          ? <DataTable columns={chargesColumns} rows={[...chP].sort((a, b) => (a.mois + a.categorie).localeCompare(b.mois + b.categorie))} />
          : <PanelEmpty icon="landmark" label="Aucune charge fixe pour cette période" />}
      </Panel>
    </div>
  )
}

function LedgerHead({ children }) {
  return <div style={{ font: 'var(--fw-semibold) 11px/1 var(--font-ui)', textTransform: 'uppercase', letterSpacing: 'var(--ls-label)', color: 'var(--text-muted)', marginTop: 'var(--sp-2)' }}>{children}</div>
}
function LedgerRow({ label, value }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 'var(--sp-5)', font: '400 13px/1.3 var(--font-ui)', color: 'var(--text-body)' }}>
    <span>{label}</span><span style={{ font: '500 13px/1 var(--font-data)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
  </div>
}
