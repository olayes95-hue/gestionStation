import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, BORDEREAUX_BUCKET } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useStation } from '../lib/station.jsx'
import { fcfa, frDate } from '../lib/format'
import { exportRowsToCsv } from '../lib/csv'
import { Panel } from '../ds/octane/components/core/Panel.jsx'
import { Button } from '../ds/octane/components/core/Button.jsx'
import { Badge } from '../ds/octane/components/core/Badge.jsx'
import { Select } from '../ds/octane/components/forms/Select.jsx'
import { DataTable } from '../ds/octane/components/data/DataTable.jsx'
import { Drawer } from '../ds/octane/components/feedback/Drawer.jsx'
import { EvidenceThumb } from '../ds/octane/components/evidence/EvidenceThumb.jsx'
import { Kpi } from '../lib/Kpi.jsx'

const N = (v) => (v ? Number(v) : 0)
const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12']
const ML = { '01':'Janv','02':'Févr','03':'Mars','04':'Avril','05':'Mai','06':'Juin','07':'Juil','08':'Août','09':'Sept','10':'Oct','11':'Nov','12':'Déc' }
const MONTH_OPTIONS = [{ value: 'all', label: 'Tous mois' }, ...MONTHS.map(m => ({ value: m, label: ML[m] }))]

// Fusion de « Historique des points » (réconciliation financière) et « Saisies & photos »
// (détail opérationnel + preuves) — même donnée journalière parcourue sous deux angles avant,
// un seul tableau + panneau de détail maintenant.
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
  const [quickFilter, setQuickFilter] = useState('tous')   // tous | ecarts | sans-photo
  const [detailDate, setDetailDate] = useState(null)
  const [detailExtra, setDetailExtra] = useState({ at: [], dep: [], exp: [], urls: {} })   // chargé à la demande, pour le seul jour ouvert

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

  // Détail d'un jour (compteurs, stock, charges, photos) : chargé seulement à l'ouverture du
  // panneau, pas pour toute la période — sinon requête lourde pour une donnée rarement consultée.
  useEffect(() => {
    if (!detailDate || !stationId) return
    (async () => {
      const [at, dep, exp] = await Promise.all([
        supabase.from('attachments').select('*').eq('report_date', detailDate).eq('station_id', stationId).order('id'),
        supabase.from('deposits').select('*').eq('report_date', detailDate).eq('station_id', stationId),
        supabase.from('expenses').select('*').eq('report_date', detailDate).eq('station_id', stationId),
      ])
      const paths = [
        ...(at.data || []).map(x => x.photo_path),
        ...(dep.data || []).filter(x => x.photo_path).map(x => x.photo_path),
        ...(exp.data || []).filter(x => x.photo_path).map(x => x.photo_path),
      ].filter(Boolean)
      let urls = {}
      if (paths.length) {
        const { data: signed } = await supabase.storage.from(BORDEREAUX_BUCKET).createSignedUrls(paths, 3600)
        for (const s of (signed || [])) if (s.signedUrl) urls[s.path] = s.signedUrl
      }
      setDetailExtra({ at: at.data || [], dep: dep.data || [], exp: exp.data || [], urls })
    })()
  }, [detailDate, stationId])

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

  // Statut du jour = pire cas des 3 pôles (carburant / gaz+lub / supérette) — sert au résumé,
  // au filtre rapide et au badge de la colonne "Statut" du tableau allégé.
  const dayStatus = (r) => {
    const g = recon[r.report_date] || {}
    const states = [
      poleState(g.carburant, g.carburant?.espece),
      poleState(g.gaz_lub, N(r.gaz_espece) + N(r.lubrifiant_espece)),
      poleState(g.superette, r.superette_espece),
    ]
    if (states.includes('ecart')) return 'ecart'
    if (states.includes('attente')) return 'attente'
    return 'ok'
  }
  const nbEcarts = frows.filter(r => dayStatus(r) === 'ecart').length
  const nbSansPhoto = frows.filter(r => !photoDates.has(r.report_date)).length
  const shownRows = frows.filter(r =>
    quickFilter === 'ecarts' ? dayStatus(r) === 'ecart' :
    quickFilter === 'sans-photo' ? !photoDates.has(r.report_date) : true)

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
    { key: 'ca_total', header: 'CA du jour', numeric: true, align: 'right', render: r => fcfa(N(r.ca_carburant) + N(r.gaz_espece) + N(r.lubrifiant_espece) + N(r.superette_espece)) },
    { key: 'statut', header: 'Statut', render: r => {
      const s = dayStatus(r)
      return s === 'ecart' ? <Badge tone="alarm">Écart</Badge> : s === 'attente' ? <Badge tone="idle">En attente</Badge> : <Badge tone="ok">OK</Badge>
    } },
    { key: 'photos', header: 'Photos', render: r => photoDates.has(r.report_date) ? <Badge tone="ok">Oui</Badge> : <Badge tone="alarm">Non</Badge> },
  ]

  const footer = {
    date: `TOTAL (${shownRows.length} j)`,
    ca_total: fcfa(shownRows.reduce((s, r) => s + N(r.ca_carburant) + N(r.gaz_espece) + N(r.lubrifiant_espece) + N(r.superette_espece), 0)),
  }

  const detailRow = frows.find(r => r.report_date === detailDate) || null
  const nombreMachines = Math.min(10, Math.max(1, N(current?.nombre_machines) || 4))
  const machineNums = Array.from({ length: nombreMachines }, (_, i) => i + 1)
  const photos = [
    ...detailExtra.at,
    ...detailExtra.dep.filter(x => x.photo_path).map(x => ({ ...x, categorie: 'versement ' + x.pole, note: fcfa(x.montant) })),
    ...detailExtra.exp.filter(x => x.photo_path).map(x => ({ ...x, categorie: 'justificatif ' + (x.categorie || ''), note: fcfa(x.montant) })),
  ]
  const photoUrl = (p) => detailExtra.urls[p] || supabase.storage.from(BORDEREAUX_BUCKET).getPublicUrl(p).data.publicUrl

  return (
    <Panel
      title="Historique"
      meta={`${shownRows.length}`}
      flush
      actions={<>
        <Select size="sm" value={year} onChange={e => setYear(e.target.value)} options={yearOptions} />
        <Select size="sm" value={month} onChange={e => setMonth(e.target.value)} options={MONTH_OPTIONS} />
        {(year !== 'all' || month !== 'all') && <Button size="sm" onClick={() => { setYear('all'); setMonth('all') }}>Réinitialiser</Button>}
        <Button size="sm" onClick={exportCsv} disabled={!frows.length}>Exporter (CSV)</Button>
      </>}
    >
      <div style={{ padding: 'var(--gutter-panel)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--sp-4)' }}>
          <div onClick={() => setQuickFilter('tous')} style={{ cursor: 'pointer' }}><Kpi label="Jours saisis" value={frows.length} status={quickFilter === 'tous' ? 'info' : undefined} /></div>
          <div onClick={() => setQuickFilter('ecarts')} style={{ cursor: 'pointer' }}><Kpi label="Jours avec écart" value={nbEcarts} status={nbEcarts > 0 ? 'alarm' : 'ok'} /></div>
          <div onClick={() => setQuickFilter('sans-photo')} style={{ cursor: 'pointer' }}><Kpi label="Jours sans photo" value={nbSansPhoto} status={nbSansPhoto > 0 ? 'warn' : 'ok'} /></div>
        </div>
        {quickFilter !== 'tous' && <Button size="sm" onClick={() => setQuickFilter('tous')} style={{ alignSelf: 'flex-start' }}>Réinitialiser le filtre rapide</Button>}
        <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>
          Clique sur une ligne pour voir le détail complet du jour (réconciliation, compteurs, stock, charges, photos).
        </p>
      </div>

      <div>
        {loading
          ? <div style={{ padding: 'var(--gutter-panel)', font: '400 12px/1 var(--font-ui)', color: 'var(--text-muted)' }}>Chargement…</div>
          : <DataTable columns={columns} rows={shownRows.map(r => ({ ...r, id: r.report_date }))} footer={footer} onRowClick={r => setDetailDate(r.report_date)} />}
      </div>
      <p style={{ font: '400 12px/1.5 var(--font-ui)', color: 'var(--text-muted)', margin: 'var(--sp-4) var(--gutter-panel)' }}>
        Un versement couvre une <b>période</b> (gaz et lubrifiant sont cumulables dans un même bordereau).
        Tant que la période n'est pas clôturée, les jours sont « ✓ inclus » (écart 0). Le jour où la période
        se termine, on compare la <b>somme des recettes</b> (carburant : <b>net des dépenses</b>) au
        <b> montant versé</b> : s'il reste un écart, il apparaît en rouge dans le détail du jour et une alerte est levée.
      </p>

      <Drawer open={!!detailRow} onClose={() => setDetailDate(null)}
        title={detailRow ? frDate(detailRow.report_date) : ''}
        footer={detailRow && <Button tone="primary" onClick={() => nav(`/saisie?date=${detailRow.report_date}`)}>{isAdmin ? 'Ouvrir / modifier' : 'Ouvrir'} cette journée</Button>}>
        {detailRow && (() => {
          const g = recon[detailRow.report_date] || {}
          const caGL = N(detailRow.gaz_espece) + N(detailRow.lubrifiant_espece)
          return (
            <>
              <Section title="Réconciliation">
                <Info l="CA carburant" v={caCell(g.carburant, g.carburant?.espece)} />
                <Info l="Versé / Écart carburant" v={<>{verseCell(g.carburant)} · {ecartCell(g.carburant)}</>} />
                <Info l="CA gaz + lubrifiant" v={caCell(g.gaz_lub, caGL)} />
                <Info l="Versé / Écart gaz + lubrifiant" v={<>{verseCell(g.gaz_lub)} · {ecartCell(g.gaz_lub)}</>} />
                <Info l="CA supérette" v={caCell(g.superette, detailRow.superette_espece)} />
                <Info l="Versé / Écart supérette" v={<>{verseCell(g.superette)} · {ecartCell(g.superette)}</>} />
                <Info l="Ventes à bon" v={fcfa(detailRow.ventes_bon)} />
              </Section>

              <Section title="Ventes carburant">
                <Info l="Essence" v={`${N(detailRow.ess_litres)} L × ${N(detailRow.ess_pu)} — bon ${fcfa(detailRow.ess_bon)} · espèce ${fcfa(detailRow.ess_espece)}`} />
                <Info l="Gasoil" v={`${N(detailRow.gas_litres)} L × ${N(detailRow.gas_pu)} — bon ${fcfa(detailRow.gas_bon)} · espèce ${fcfa(detailRow.gas_espece)}`} />
              </Section>

              <Section title="Autres pôles (espèces)">
                <Info l="Gaz / Supérette / Lubrifiant" v={`${fcfa(detailRow.gaz_espece)} · ${fcfa(detailRow.superette_espece)} · ${fcfa(detailRow.lubrifiant_espece)}`} />
              </Section>

              <Section title="Compteurs">
                <Info l={`Ouverture E1→E${nombreMachines}`} v={machineNums.map(n => N(detailRow['e' + n + '_m'])).join(' · ')} />
                <Info l={`Ouverture G1→G${nombreMachines}`} v={machineNums.map(n => N(detailRow['g' + n + '_m'])).join(' · ')} />
                <Info l={`16h E1→E${nombreMachines}`} v={machineNums.map(n => N(detailRow['e' + n])).join(' · ')} />
                <Info l={`16h G1→G${nombreMachines}`} v={machineNums.map(n => N(detailRow['g' + n])).join(' · ')} />
              </Section>

              <Section title="Stock">
                <Info l="Cuve essence / gasoil" v={`${N(detailRow.ess_stock)} L · ${N(detailRow.gas_stock)} L`} />
                <Info l="Gaz 3/6/12/38 kg" v={`${N(detailRow.gaz_stock_3)} · ${N(detailRow.gaz_stock_6)} · ${N(detailRow.gaz_stock_12)} · ${N(detailRow.gaz_stock_38)}`} />
              </Section>

              <Section title="Charges déclarées par le gérant">
                {detailExtra.exp.length
                  ? <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                      {detailExtra.exp.map(e => (
                        <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-3)', font: '400 13px/1.3 var(--font-ui)' }}>
                          <span style={{ color: 'var(--text-body)' }}>{(e.categorie || 'AUTRE').replace(/_/g, ' ')}{e.motif ? ` — ${e.motif}` : ''}{e.non_cash ? ' (non-cash)' : ''}</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>{fcfa(e.montant)}</span>
                        </div>
                      ))}
                    </div>
                  : <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>Aucune charge déclarée ce jour.</p>}
              </Section>

              {photos.length > 0 && (
                <Section title="Photos du jour">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
                    {photos.map((x, i) => (
                      <EvidenceThumb key={i} src={photoUrl(x.photo_path)} label={x.categorie} timestamp={x.note} status="none" size={92} onClick={() => window.open(photoUrl(x.photo_path), '_blank')} />
                    ))}
                  </div>
                </Section>
              )}
            </>
          )
        })()}
      </Drawer>
    </Panel>
  )
}

// poleState : état d'un pôle pour un jour donné, réutilisé par le résumé/filtre rapide et le
// badge Statut du tableau. Distinct de caCell/verseCell/ecartCell (JSX) — ici juste un mot-clé.
function poleState(g, espece) {
  if (g && N(g.nb_cloture) > 0 && g.ecart != null) return N(g.ecart) > 1000 ? 'ecart' : 'ok'
  if (g?.couvert) return 'ok'
  if (N(espece) > 0) return 'attente'
  return null
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

function Section({ title, children }) {
  return (<div style={{ marginBottom: 'var(--sp-4)' }}>
    <div style={{ font: 'var(--fw-semibold) 10px/1 var(--font-ui)', textTransform: 'uppercase', letterSpacing: 'var(--ls-micro)', color: 'var(--text-muted)', margin: '0 0 var(--sp-2)' }}>{title}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>{children}</div>
  </div>)
}
function Info({ l, v }) {
  return (<div style={{ display: 'flex', gap: 'var(--sp-4)', font: '400 13px/1.3 var(--font-ui)', flexWrap: 'wrap', alignItems: 'baseline' }}>
    <span style={{ color: 'var(--text-muted)', minWidth: 150, flexShrink: 0 }}>{l}</span>
    <span style={{ fontWeight: 600, color: 'var(--text-body)', wordBreak: 'break-word', flex: 1 }}>{v}</span>
  </div>)
}
