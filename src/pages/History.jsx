import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useStation } from '../lib/station.jsx'
import { fcfa, frDate } from '../lib/format'
import { exportRowsToCsv } from '../lib/csv'

const N = (v) => (v ? Number(v) : 0)
const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12']
const ML = { '01':'Janv','02':'Févr','03':'Mars','04':'Avril','05':'Mai','06':'Juin','07':'Juil','08':'Août','09':'Sept','10':'Oct','11':'Nov','12':'Déc' }

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

  if (loading) return <div className="center">Chargement…</div>

  return (
    <div className="card">
      <h2>Historique des points ({frows.length})</h2>
      <div className="toolbar">
        <select value={year} onChange={e => setYear(e.target.value)}>
          <option value="all">Toutes années</option>{years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={e => setMonth(e.target.value)}>
          <option value="all">Tous mois</option>{MONTHS.map(m => <option key={m} value={m}>{ML[m]}</option>)}
        </select>
        {(year !== 'all' || month !== 'all') && <button className="btn sec small" onClick={() => { setYear('all'); setMonth('all') }}>Réinitialiser</button>}
        <button className="btn sec small" onClick={exportCsv} disabled={!frows.length}>⬇️ Exporter (CSV)</button>
      </div>
      <p className="hint">👆 Clique sur une ligne pour {isAdmin ? 'voir/modifier' : 'voir'} le détail complet du jour.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th className="num">CA Carbu.</th><th className="num">Espèce carbu.</th><th className="num">Versé carbu.</th><th className="num">Écart carbu.</th>
              <th className="num">CA Gaz+Lub.</th><th className="num">Versé Gaz+Lub.</th><th className="num">Écart Gaz+Lub.</th>
              <th className="num">CA Supérette</th><th className="num">Versé Sup.</th><th className="num">Écart Sup.</th>
              <th className="num">Bon</th><th>Photos</th>
            </tr>
          </thead>
          <tbody>
            {frows.map(r => {
              const g = recon[r.report_date] || {}
              const carb = g.carburant, gl = g.gaz_lub, sup = g.superette
              const caGL = N(r.gaz_espece) + N(r.lubrifiant_espece)
              return (
                <tr key={r.report_date} style={{ cursor: 'pointer' }} onClick={() => nav(`/saisie?date=${r.report_date}`)}>
                  <td>{frDate(r.report_date)}</td>
                  <td className="num">{fcfa(r.ca_carburant)}</td>
                  <td className="num">{carb ? caCell(carb, carb.espece) : '—'}</td>
                  <td className="num">{verseCell(carb)}</td>
                  <td className="num">{ecartCell(carb)}</td>
                  <td className="num">{caCell(gl, caGL)}</td>
                  <td className="num">{verseCell(gl)}</td>
                  <td className="num">{ecartCell(gl)}</td>
                  <td className="num">{caCell(sup, r.superette_espece)}</td>
                  <td className="num">{verseCell(sup)}</td>
                  <td className="num">{ecartCell(sup)}</td>
                  <td className="num">{fcfa(r.ventes_bon)}</td>
                  <td>{photoDates.has(r.report_date)
                    ? <span style={{ color: 'var(--ok)', fontWeight: 600 }}>Oui</span>
                    : <span className="muted">Non</span>}</td>
                </tr>
              )
            })}
            <tr style={{ fontWeight: 700, background: '#f0f3f7' }}>
              <td>TOTAL ({frows.length} j)</td>
              <td className="num">{fcfa(frows.reduce((s, r) => s + N(r.ca_carburant), 0))}</td>
              <td className="num">{fcfa(frows.reduce((s, r) => s + N(recon[r.report_date]?.carburant?.espece), 0))}</td>
              <td className="num">{fcfa(frows.reduce((s, r) => s + N(recon[r.report_date]?.carburant?.verse), 0))}</td>
              <td></td>
              <td className="num">{fcfa(frows.reduce((s, r) => s + N(r.gaz_espece) + N(r.lubrifiant_espece), 0))}</td>
              <td className="num">{fcfa(frows.reduce((s, r) => s + N(recon[r.report_date]?.gaz_lub?.verse), 0))}</td>
              <td></td>
              <td className="num">{fcfa(frows.reduce((s, r) => s + N(r.superette_espece), 0))}</td>
              <td className="num">{fcfa(frows.reduce((s, r) => s + N(recon[r.report_date]?.superette?.verse), 0))}</td>
              <td></td>
              <td className="num">{fcfa(frows.reduce((s, r) => s + N(r.ventes_bon), 0))}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>
        Un versement couvre une <b>période</b> (gaz et lubrifiant sont cumulables dans un même bordereau).
        Tant que la période n'est pas clôturée, les jours sont « ✓ inclus » (écart 0). Le jour où la période
        se termine, on compare la <b>somme des recettes</b> (carburant : <b>net des dépenses</b>) au
        <b> montant versé</b> : s'il reste un écart, il apparaît en rouge et une alerte est levée.
        « En attente » = recette pas encore rattachée à un versement.
      </p>
    </div>
  )
}

// Sur le jour de clôture d'un versement, la recette affichée = cumul de la
// période (base réelle de l'écart) ; sinon la recette du seul jour.
function caCell(g, dayVal) {
  if (g && N(g.nb_cloture) > 0 && g.recette_cloture != null) {
    return <span title="Recette cumulée de la période clôturée ce jour (base de l'écart)" style={{ borderBottom: '1px dotted var(--muted, #999)', cursor: 'help' }}>{fcfa(g.recette_cloture)}</span>
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
    return <span style={{ fontWeight: 600, color: e > 1000 ? 'var(--danger)' : 'var(--ok)' }}>{fcfa(e)}{e < -1000 ? ' (surplus)' : ''}</span>
  }
  if (g.couvert) return <span style={{ color: 'var(--ok)' }} title="Jour inclus dans une période versée ; l'écart sera calculé au dernier jour de la période.">✓ inclus</span>
  if (N(g.espece) > 0) return <span className="muted">en attente</span>
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
