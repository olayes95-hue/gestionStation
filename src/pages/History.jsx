import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useStation } from '../lib/station.jsx'
import { fcfa, frDate } from '../lib/format'
import { exportRowsToCsv } from '../lib/csv'
import { Panel } from '../ds/octane/components/core/Panel.jsx'
import { Button } from '../ds/octane/components/core/Button.jsx'
import { Select } from '../ds/octane/components/forms/Select.jsx'
import { DataTable } from '../ds/octane/components/data/DataTable.jsx'

const N = (v) => (v ? Number(v) : 0)
const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12']
const ML = { '01':'Janv','02':'Févr','03':'Mars','04':'Avril','05':'Mai','06':'Juin','07':'Juil','08':'Août','09':'Sept','10':'Oct','11':'Nov','12':'Déc' }
const MONTH_OPTIONS = [{ value: 'all', label: 'Tous mois' }, ...MONTHS.map(m => ({ value: m, label: ML[m] }))]

export default function History() {
  const { stationId, current } = useStation()
  const { isAdmin } = useAuth()
  const nav = useNavigate()
  const [rows, setRows] = useState([])
  const [recon, setRecon] = useState({})   // recon[date][pole_groupe] (v_pole_recon_jour)
  const [photoDates, setPhotoDates] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState('all')
  const [month, setMonth] = useState('all')

  useEffect(() => { if (!stationId) return; (async () => {
    setLoading(true)
    // Borne d'historique (~20 mois) : évite de recalculer v_pole_recon_jour sur TOUT l'historique
    // (3 lignes/jour × sous-requêtes imbriquées). Les 4 requêtes partent en parallèle (avant : en série).
    const CUTOFF = new Date(Date.now() - 600 * 864e5).toISOString().slice(0, 10)
    const [m, cr, at, dp] = await Promise.all([
      supabase.from('v_report_metrics').select('*').eq('station_id', stationId).gte('report_date', CUTOFF).order('report_date', { ascending: false }).limit(600),
      supabase.from('v_pole_recon_jour').select('*').eq('station_id', stationId).gte('report_date', CUTOFF),
      supabase.from('attachments').select('report_date').eq('station_id', stationId).gte('report_date', CUTOFF),
      supabase.from('deposits').select('report_date').eq('station_id', stationId).not('photo_path', 'is', null).gte('report_date', CUTOFF),
    ])
    setRows(m.data || [])
    const cmap = {}; for (const c of (cr.data || [])) { (cmap[c.report_date] = cmap[c.report_date] || {})[c.pole_groupe] = c }
    setRecon(cmap)
    setPhotoDates(new Set([...(at.data || []), ...(dp.data || [])].map(x => x.report_date)))
    setLoading(false)
  })() }, [stationId])

  const years = useMemo(() => [...new Set(rows.map(r => r.report_date.slice(0, 4)))].sort(), [rows])
  const yearOptions = [{ value: 'all', label: 'Toutes années' }, ...years.map(y => ({ value: y, label: y }))]
  const [inited, setInited] = useState(false)
  useEffect(() => {
    if (!inited && rows.length) {
      const d = rows.map(r => r.report_date).sort().at(-1)
      setYear(d.slice(0, 4)); setMonth(d.slice(5, 7)); setInited(true)
    }
  }, [rows, inited])
  const frows = useMemo(() => rows.filter(r =>
    (year === 'all' || r.report_date.slice(0, 4) === year) &&
    (month === 'all' || r.report_date.slice(5, 7) === month)), [rows, year, month])

  function exportCsv() {
    const columns = [
      ['Date', 'date'], ['CA Carbu.', 'ca_carb'], ['Espèce carbu.', 'esp_carb'], ['Versé carbu.', 'ver_carb'], ['Écart carbu.', 'ec_carb'],
      ['CA Gaz+Lub.', 'ca_gl'], ['Versé Gaz+Lub.', 'ver_gl'], ['Écart Gaz+Lub.', 'ec_gl'],
      ['CA Supérette', 'ca_sup'], ['Versé Sup.', 'ver_sup'], ['Écart Sup.', 'ec_sup'],
      ['Bon', 'bon'], ['Photos', 'photos'],
    ]
    const data = frows.map(r => {
      const g = recon[r.report_date] || {}
      const carb = g.carburant, gl = g.gaz_lub, sup = g.superette
      const caGL = N(r.gaz_espece) + N(r.lubrifiant_espece)
      return {
        date: frDate(r.report_date),
        ca_carb: Math.round(N(r.ca_carburant)), esp_carb: caVal(carb, carb?.espece), ver_carb: verseVal(carb), ec_carb: ecartVal(carb),
        ca_gl: caVal(gl, caGL), ver_gl: verseVal(gl), ec_gl: ecartVal(gl),
        ca_sup: caVal(sup, r.superette_espece), ver_sup: verseVal(sup), ec_sup: ecartVal(sup),
        bon: Math.round(N(r.ventes_bon)), photos: photoDates.has(r.report_date) ? 'Oui' : 'Non',
      }
    })
    const label = (year === 'all' ? 'tout' : year) + (month !== 'all' ? '-' + month : '')
    const station = (current?.nom || 'station').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    exportRowsToCsv(`historique-${station}-${label}.csv`, columns, data)
  }

  const columns = [
    { key: 'date', header: 'Date', render: r => frDate(r.report_date) },
    { key: 'ca_carb', header: 'CA Carbu.', numeric: true, align: 'right', render: r => fcfa(r.ca_carburant) },
    { key: 'esp_carb', header: 'Espèce carbu.', numeric: true, align: 'right', render: r => (recon[r.report_date]?.carburant ? caCell(recon[r.report_date].carburant, recon[r.report_date].carburant.espece) : '—') },
    { key: 'ver_carb', header: 'Versé carbu.', numeric: true, align: 'right', render: r => verseCell(recon[r.report_date]?.carburant) },
    { key: 'ec_carb', header: 'Écart carbu.', numeric: true, align: 'right', render: r => ecartCell(recon[r.report_date]?.carburant) },
    { key: 'ca_gl', header: 'CA Gaz+Lub.', numeric: true, align: 'right', render: r => caCell(recon[r.report_date]?.gaz_lub, N(r.gaz_espece) + N(r.lubrifiant_espece)) },
    { key: 'ver_gl', header: 'Versé Gaz+Lub.', numeric: true, align: 'right', render: r => verseCell(recon[r.report_date]?.gaz_lub) },
    { key: 'ec_gl', header: 'Écart Gaz+Lub.', numeric: true, align: 'right', render: r => ecartCell(recon[r.report_date]?.gaz_lub) },
    { key: 'ca_sup', header: 'CA Supérette', numeric: true, align: 'right', render: r => caCell(recon[r.report_date]?.superette, r.superette_espece) },
    { key: 'ver_sup', header: 'Versé Sup.', numeric: true, align: 'right', render: r => verseCell(recon[r.report_date]?.superette) },
    { key: 'ec_sup', header: 'Écart Sup.', numeric: true, align: 'right', render: r => ecartCell(recon[r.report_date]?.superette) },
    { key: 'bon', header: 'Bon', numeric: true, align: 'right', render: r => fcfa(r.ventes_bon) },
    { key: 'photos', header: 'Photos', render: r => photoDates.has(r.report_date)
      ? <span style={{ color: 'var(--state-ok)', fontWeight: 600 }}>Oui</span>
      : <span style={{ color: 'var(--text-muted)' }}>Non</span> },
  ]

  const footer = {
    date: `TOTAL (${frows.length} j)`,
    ca_carb: fcfa(frows.reduce((s, r) => s + N(r.ca_carburant), 0)),
    esp_carb: fcfa(frows.reduce((s, r) => s + N(recon[r.report_date]?.carburant?.espece), 0)),
    ver_carb: fcfa(frows.reduce((s, r) => s + N(recon[r.report_date]?.carburant?.verse), 0)),
    ca_gl: fcfa(frows.reduce((s, r) => s + N(r.gaz_espece) + N(r.lubrifiant_espece), 0)),
    ver_gl: fcfa(frows.reduce((s, r) => s + N(recon[r.report_date]?.gaz_lub?.verse), 0)),
    ca_sup: fcfa(frows.reduce((s, r) => s + N(r.superette_espece), 0)),
    ver_sup: fcfa(frows.reduce((s, r) => s + N(recon[r.report_date]?.superette?.verse), 0)),
    bon: fcfa(frows.reduce((s, r) => s + N(r.ventes_bon), 0)),
  }

  return (
    <Panel
      title="Historique des points"
      meta={`${frows.length}`}
      flush
      actions={<>
        <Select size="sm" value={year} onChange={e => setYear(e.target.value)} options={yearOptions} />
        <Select size="sm" value={month} onChange={e => setMonth(e.target.value)} options={MONTH_OPTIONS} />
        {(year !== 'all' || month !== 'all') && <Button size="sm" onClick={() => { setYear('all'); setMonth('all') }}>Réinitialiser</Button>}
        <Button size="sm" onClick={exportCsv} disabled={!frows.length}>Exporter (CSV)</Button>
      </>}
    >
      <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 'var(--sp-4) var(--gutter-panel) 0' }}>
        Clique sur une ligne pour {isAdmin ? 'voir/modifier' : 'voir'} le détail complet du jour.
      </p>
      <div style={{ marginTop: 'var(--sp-4)' }}>
        {loading
          ? <div style={{ padding: 'var(--gutter-panel)', font: '400 12px/1 var(--font-ui)', color: 'var(--text-muted)' }}>Chargement…</div>
          : <DataTable columns={columns} rows={frows.map(r => ({ ...r, id: r.report_date }))} footer={footer} onRowClick={r => nav(`/saisie?date=${r.report_date}`)} />}
      </div>
      <p style={{ font: '400 12px/1.5 var(--font-ui)', color: 'var(--text-muted)', margin: 'var(--sp-4) var(--gutter-panel) 0' }}>
        Un versement couvre une <b>période</b> (gaz et lubrifiant sont cumulables dans un même bordereau).
        Tant que la période n'est pas clôturée, les jours sont « ✓ inclus » (écart 0). Le jour où la période
        se termine, on compare la <b>somme des recettes</b> (carburant : <b>net des dépenses</b>) au
        <b> montant versé</b> : s'il reste un écart, il apparaît en rouge et une alerte est levée.
        « En attente » = recette pas encore rattachée à un versement.
      </p>
    </Panel>
  )
}

// Sur le jour de clôture d'un versement, la recette affichée = cumul de la
// période (base réelle de l'écart) ; sinon la recette du seul jour.
function caCell(g, dayVal) {
  if (g && N(g.nb_cloture) > 0 && g.recette_cloture != null) {
    return <span title="Recette cumulée de la période clôturée ce jour (base de l'écart)" style={{ borderBottom: '1px dotted var(--text-muted)', cursor: 'help' }}>{fcfa(g.recette_cloture)}</span>
  }
  return fcfa(dayVal)
}
function verseCell(g) {
  return g && N(g.verse) ? fcfa(g.verse) : '—'
}
function ecartCell(g) {
  if (!g) return '—'
  if (N(g.nb_cloture) > 0) {
    const e = N(g.ecart)
    // écart > 0 = il manque du versé (rouge) ; écart < 0 = surplus versé (vert) ; ≈0 = ok (vert)
    return <span style={{ fontWeight: 600, color: e > 1000 ? 'var(--state-alarm)' : 'var(--state-ok)' }}>{fcfa(e)}{e < -1000 ? ' (surplus)' : ''}</span>
  }
  if (g.couvert) return <span style={{ color: 'var(--state-ok)' }} title="Jour inclus dans une période versée ; l'écart sera calculé au dernier jour de la période.">✓ inclus</span>
  if (N(g.espece) > 0) return <span style={{ color: 'var(--text-muted)' }}>en attente</span>
  return '—'
}
// Équivalents en VALEUR BRUTE (nombres/texte, pas de JSX) — pour l'export CSV, miroir de caCell/verseCell/ecartCell.
function caVal(g, dayVal) {
  if (g && N(g.nb_cloture) > 0 && g.recette_cloture != null) return Math.round(N(g.recette_cloture))
  return Math.round(N(dayVal))
}
function verseVal(g) { return g && N(g.verse) ? Math.round(N(g.verse)) : '' }
function ecartVal(g) {
  if (!g) return ''
  if (N(g.nb_cloture) > 0) return Math.round(N(g.ecart))
  if (g.couvert) return 'inclus'
  if (N(g.espece) > 0) return 'en attente'
  return ''
}
