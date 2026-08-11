import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStation } from '../lib/station.jsx'
import { fcfa, frDate } from '../lib/format'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const N = (v) => (v ? Number(v) : 0)
const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12']
const ML = { '01':'Janv','02':'Févr','03':'Mars','04':'Avril','05':'Mai','06':'Juin','07':'Juil','08':'Août','09':'Sept','10':'Oct','11':'Nov','12':'Déc' }

export default function Dashboard() {
  const { stationId } = useStation()
  const [months, setMonths] = useState([])   // v_ventes_mensuelles (agrégé, rapide)
  const [alertCount, setAlertCount] = useState(null)
  const [stock, setStock] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [reorder, setReorder] = useState([])
  const [orders, setOrders] = useState([])
  const [inspections, setInspections] = useState([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState('all')
  const [month, setMonth] = useState('all')
  const [refreshedAt, setRefreshedAt] = useState('')
  const [inited, setInited] = useState(false)

  async function loadStock() {
    if (!stationId) return
    const [ls, sf, ro] = await Promise.all([
      supabase.from('v_latest_stock').select('*').eq('station_id', stationId).maybeSingle(),
      supabase.from('v_stock_forecast').select('*').eq('station_id', stationId).maybeSingle(),
      supabase.from('v_reorder').select('*').eq('station_id', stationId),
    ])
    setStock(ls.data || null); setForecast(sf.data || null); setReorder(ro.data || [])
    setRefreshedAt(new Date().toLocaleTimeString('fr-FR'))
  }
  useEffect(() => { if (!stationId) return
    setLoading(true)
    // Le stock (rapide) s'affiche en premier ; les autres blocs se remplissent dès qu'ils arrivent,
    // sans s'attendre les uns les autres. La vue mensuelle (la plus lourde) ne bloque plus le rendu.
    loadStock()
    supabase.from('fuel_orders').select('categorie,statut,quantite_commandee,cuve_avant,cuve_apres,montant').eq('station_id', stationId)
      .then(({ data }) => setOrders(data || []))
    supabase.from('inspections').select('conforme').eq('station_id', stationId)
      .then(({ data }) => setInspections(data || []))
    supabase.from('v_ventes_mensuelles').select('*').eq('station_id', stationId).order('mois')
      .then(({ data }) => { setMonths(data || []); setLoading(false) })
    // les alertes (vue lourde) se chargent après l'affichage, sans bloquer
    supabase.from('v_alerts').select('type', { count: 'exact', head: true }).eq('station_id', stationId).then(({ count }) => setAlertCount(count ?? 0))
  }, [stationId])
  useEffect(() => {
    if (!stationId) return
    const ch = supabase.channel('stock-' + stationId).on('postgres_changes', { event: '*', schema: 'public', table: 'daily_reports', filter: `station_id=eq.${stationId}` }, loadStock).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [stationId])

  const years = useMemo(() => [...new Set(months.map(m => m.mois.slice(0, 4)))].sort(), [months])
  useEffect(() => { if (!inited && months.length) { const m = months.map(x => x.mois).sort().at(-1); setYear(m.slice(0, 4)); setMonth(m.slice(5, 7)); setInited(true) } }, [months, inited])

  const fm = months.filter(m => (year === 'all' || m.mois.slice(0, 4) === year) && (month === 'all' || m.mois.slice(5, 7) === month))
  const sum = (k) => fm.reduce((s, m) => s + N(m[k]), 0)

  if (loading && !stock && !months.length) return <div className="center">Chargement…</div>
  const L = (v) => loading && !months.length ? '…' : v

  const totBon = sum('ventes_bon'), totCash = sum('recettes_especes'), totVerse = sum('total_verse')
  const caTotal = totBon + totCash
  const pctBon = caTotal ? Math.round(100 * totBon / caTotal) : null
  const pctEsp = caTotal ? Math.round(100 * totCash / caTotal) : null
  const totDep = sum('total_depense'), totMarge = sum('commission_carburant'), totLivr = sum('total_livraisons')
  const gapVerse = totCash - totDep - totVerse

  // Répartition Bon / Espèce du CARBURANT uniquement.
  // ventes_bon = ess_bon+gas_bon (seul le carburant a des bons).
  // espèce carburant = recettes_especes − espèces gaz/supérette/lubrifiant.
  const carbBon = totBon
  const carbEsp = Math.max(0, totCash - sum('ventes_gaz') - sum('ventes_superette') - sum('ventes_lubrifiant'))
  const carbTotal = carbBon + carbEsp
  const pctCarbBon = carbTotal ? Math.round(100 * carbBon / carbTotal) : null
  const pctCarbEsp = carbTotal ? 100 - pctCarbBon : null

  const ordRecues = orders.filter(o => o.statut === 'recue')
  const nConf = inspections.filter(i => i.conforme === true).length, nNonConf = inspections.filter(i => i.conforme === false).length

  const chart = fm.map(m => ({ mois: m.mois.slice(2), 'Ventes bon': Math.round(N(m.ventes_bon)), 'Espèces': Math.round(N(m.recettes_especes)), 'Versé': Math.round(N(m.total_verse)) }))
  const daysColor = (d) => d == null ? 'inherit' : d < 3 ? 'var(--danger)' : d < 6 ? 'var(--warn)' : 'var(--ok)'

  return (
    <div>
      <div className="card" style={{ borderColor: 'var(--primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>📦 Stock en temps réel & autonomie</h2>
          <span className="muted" style={{ fontSize: 12 }}>maj {refreshedAt} · <a style={{ cursor: 'pointer' }} onClick={loadStock}>rafraîchir</a></span>
        </div>
        {!stock ? <p className="muted">Pas encore de stock saisi.</p> : (<>
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Dernière saisie : {frDate(stock.derniere_date)}</p>
          <div className="grid kpis">
            <StockKpi label="Essence en cuve" main={stock.ess_stock != null ? Math.round(stock.ess_stock) + ' L' : '—'} sub={forecast?.jours_essence != null ? `≈ ${forecast.jours_essence} j` : ''} color={daysColor(forecast?.jours_essence)} />
            <StockKpi label="Gasoil en cuve" main={stock.gas_stock != null ? Math.round(stock.gas_stock) + ' L' : '—'} sub={forecast?.jours_gasoil != null ? `≈ ${forecast.jours_gasoil} j` : ''} color={daysColor(forecast?.jours_gasoil)} />
            <StockKpi label="Bons en cours" main={stock.bons_restant != null ? fcfa(stock.bons_restant) : '—'}
              sub={N(stock.bons_utilises_depuis) > 0 ? `dont ${fcfa(stock.bons_utilises_depuis)} engagés en commandes` : ''}
              color={stock.bons_restant != null && stock.bons_restant < 0 ? 'var(--danger)' : undefined} />
            <StockKpi label="Bouteilles gaz" main={`${[stock.gaz_stock_3, stock.gaz_stock_6, stock.gaz_stock_12, stock.gaz_stock_38].reduce((a, b) => a + N(b), 0)} b.`} />
          </div>
        </>)}
      </div>

      {reorder.length > 0 && (
        <div className="card" style={{ borderColor: reorder.some(r => r.commander_maintenant) ? 'var(--danger)' : 'var(--border)' }}>
          <h2>🔮 Prévision de commande carburant</h2>
          <p className="hint">Quand commander pour ne jamais tomber en rupture (rupture = ventes perdues). Calcul : autonomie − délai de livraison − marge de sécurité. Le <b>délai</b> est calculé automatiquement sur l'historique des commandes (lancement → réception).</p>
          <div className="table-wrap">
            <table><thead><tr><th>Produit</th><th className="num">Stock</th><th className="num">Conso/j</th><th className="num">Autonomie</th><th className="num">Délai livr.</th><th>Commander le</th><th>Rupture estimée</th><th>Action</th></tr></thead>
              <tbody>
                {reorder.map(r => {
                  const now = r.commander_maintenant
                  const enCours = r.commande_en_cours
                  return (<tr key={r.produit}>
                    <td style={{ textTransform: 'capitalize' }}>{r.produit}</td>
                    <td className="num">{r.stock != null ? Math.round(r.stock).toLocaleString('fr-FR') + ' L' : '—'}</td>
                    <td className="num">{r.conso_jour ? Math.round(r.conso_jour).toLocaleString('fr-FR') + ' L' : '—'}</td>
                    <td className="num" style={{ color: r.jours_restant == null ? 'inherit' : r.jours_restant < 3 ? 'var(--danger)' : r.jours_restant < 6 ? 'var(--warn)' : 'var(--ok)' }}>{r.jours_restant != null ? `≈ ${r.jours_restant} j` : '—'}</td>
                    <td className="num" title={N(r.nb_delai) > 0 ? `moyenne sur ${N(r.nb_delai)} commande(s)` : 'valeur par défaut (pas encore d\'historique)'}>{r.lead != null ? `${r.lead} j` : '—'}{N(r.nb_delai) > 0 ? <span className="muted" style={{ fontSize: 10 }}> ({N(r.nb_delai)})</span> : <span className="muted" style={{ fontSize: 10 }}> déf.</span>}</td>
                    <td>{enCours ? <span className="muted">commande en cours</span> : now ? <b style={{ color: 'var(--danger)' }}>maintenant</b> : (r.date_commande_conseillee ? frDate(r.date_commande_conseillee) : '—')}</td>
                    <td className="muted">{r.date_rupture_estimee ? frDate(r.date_rupture_estimee) : '—'}</td>
                    <td>{enCours
                      ? <span className="badge" style={{ background: '#8e44ad' }} title="Une commande est déjà proposée/validée/lancée pour ce produit">🚚 Commande en cours</span>
                      : now
                      ? <span className="badge" style={{ background: 'var(--danger)' }}>🚨 Commander{r.manque_a_gagner_estime > 0 ? ` (−${Math.round(r.manque_a_gagner_estime).toLocaleString('fr-FR')} F)` : ''}</span>
                      : <span style={{ color: 'var(--ok)' }}>✓ ok</span>}</td>
                  </tr>)
                })}
              </tbody></table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="toolbar">
          <b>Filtres :</b>
          <select value={year} onChange={e => setYear(e.target.value)}><option value="all">Toutes années</option>{years.map(y => <option key={y}>{y}</option>)}</select>
          <select value={month} onChange={e => setMonth(e.target.value)}><option value="all">Tous mois</option>{MONTHS.map(m => <option key={m} value={m}>{ML[m]}</option>)}</select>
          {(year !== 'all' || month !== 'all') && <button className="btn sec small" onClick={() => { setYear('all'); setMonth('all') }}>Réinitialiser</button>}
          <span className="pill">{sum('jours')} jour(s)</span>
        </div>
      </div>

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <Kpi label="Ventes à bon" value={L(fcfa(totBon))} sub={pctBon != null ? `${pctBon}% du CA` : ''} />
        <Kpi label="Recettes espèces" value={L(fcfa(totCash))} sub={pctEsp != null ? `${pctEsp}% du CA` : ''} />
        <Kpi label="Versé banque" value={L(fcfa(totVerse))} />
        <Kpi label="Cash non tracé" value={L(fcfa(gapVerse))} danger={gapVerse > 0} sub="recettes − dépenses − versé" />
        <Kpi label="Marge carburant" value={L(fcfa(totMarge))} sub="25 F/L" />
        <Kpi label="Livraisons / achats" value={L(fcfa(totLivr))} />
        <Kpi label="Alertes (station)" value={alertCount == null ? '…' : alertCount} danger={alertCount > 0} />
      </div>

      <div className="card">
        <h2>⛽ Ventes carburant — Bon vs Espèce</h2>
        {carbTotal ? (<>
          <div className="grid kpis">
            <Kpi label="Carburant à BON (crédit)" value={L(fcfa(carbBon))} sub={pctCarbBon != null ? `${pctCarbBon}% du carburant` : ''} />
            <Kpi label="Carburant en ESPÈCES" value={L(fcfa(carbEsp))} sub={pctCarbEsp != null ? `${pctCarbEsp}% du carburant` : ''} />
            <Kpi label="CA carburant (période)" value={L(fcfa(carbTotal))} />
          </div>
          <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', marginTop: 12 }}>
            <div title={`Bon ${pctCarbBon}%`} style={{ width: `${pctCarbBon || 0}%`, background: '#e67e22' }} />
            <div title={`Espèce ${pctCarbEsp}%`} style={{ width: `${pctCarbEsp || 0}%`, background: '#16a34a' }} />
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            <span style={{ color: '#e67e22' }}>■</span> Bon {pctCarbBon}% &nbsp;·&nbsp;
            <span style={{ color: '#16a34a' }}>■</span> Espèce {pctCarbEsp}% — essence + gasoil uniquement
          </div>
        </>) : <p className="muted">Pas de ventes carburant sur la période sélectionnée.</p>}
      </div>

      <div className="card">
        <h2>🚚 Commandes & 🛂 contrôles ANM</h2>
        <div className="grid kpis">
          <Kpi label="Commandes reçues" value={ordRecues.length} sub={`${orders.length} au total`} />
          <Kpi label="Contrôles ANM" value={inspections.length} sub={`${nConf} conformes · ${nNonConf} non conf.`} danger={nNonConf > 0} />
        </div>
      </div>

      <div className="card">
        <h2>Évolution mensuelle</h2>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={chart}>
              <XAxis dataKey="mois" fontSize={11} /><YAxis fontSize={11} tickFormatter={v => (v / 1e6).toFixed(0) + 'M'} />
              <Tooltip formatter={v => fcfa(v)} /><Legend />
              <Bar dataKey="Ventes bon" fill="#3b5bdb" /><Bar dataKey="Espèces" fill="#2e86c1" /><Bar dataKey="Versé" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>Réconciliation versements (par mois)</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Mois</th><th className="num">Espèces</th><th className="num">Versé</th><th className="num">Écart</th><th className="num">Couv.</th></tr></thead>
            <tbody>
              {fm.map(m => {
                const esp = N(m.recettes_especes), ver = N(m.total_verse), ec = esp - ver, cov = esp ? Math.round(100 * ver / esp) : 0
                return (<tr key={m.mois}><td>{m.mois}</td><td className="num">{fcfa(esp)}</td><td className="num">{fcfa(ver)}</td>
                  <td className="num" style={{ color: ec > 1000 ? 'var(--danger)' : 'inherit' }}>{fcfa(ec)}</td>
                  <td className="num" style={{ color: cov >= 90 ? 'var(--ok)' : cov >= 60 ? 'var(--warn)' : 'var(--danger)' }}>{cov}%</td></tr>)
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
function StockKpi({ label, main, sub, color }) {
  return (<div className="kpi"><div className="label">{label}</div><div className="value" style={{ fontSize: 20, color: color || 'var(--primary)' }}>{main}</div>{sub && <div className="sub" style={{ color: color || 'var(--muted)' }}>{sub}</div>}</div>)
}
function Kpi({ label, value, sub, danger }) {
  return (<div className="kpi"><div className="label">{label}</div><div className="value" style={{ color: danger ? 'var(--danger)' : 'var(--primary)' }}>{value}</div>{sub && <div className="sub">{sub}</div>}</div>)
}
