import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, BORDEREAUX_BUCKET } from '../lib/supabase'
import { useStation } from '../lib/station.jsx'
import { fcfa, frDate } from '../lib/format'
import { Panel, PanelEmpty } from '../ds/octane/components/core/Panel.jsx'
import { Button } from '../ds/octane/components/core/Button.jsx'
import { Tag } from '../ds/octane/components/core/Tag.jsx'
import { Select } from '../ds/octane/components/forms/Select.jsx'
import { Icon } from '../ds/octane/components/core/Icon.jsx'
import { EvidenceThumb } from '../ds/octane/components/evidence/EvidenceThumb.jsx'

const N = (v) => (v ? Number(v) : 0)
const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12']
const MONTH_OPTIONS = MONTHS.map(m => ({ value: m, label: m }))

export default function Entries() {
  const { stationId } = useStation()
  const nav = useNavigate()
  const [rows, setRows] = useState([])
  const [atts, setAtts] = useState([])
  const [deps, setDeps] = useState([])
  const [ym, setYm] = useState('') // 'YYYY-MM'
  const [open, setOpen] = useState(null)
  const [urls, setUrls] = useState({}) // path -> signed url
  const [loading, setLoading] = useState(true)

  // mois par défaut = le plus récent avec des données
  useEffect(() => { if (!stationId) return; (async () => {
    setLoading(true)
    const { data: last } = await supabase.from('v_report_metrics').select('report_date').eq('station_id', stationId).order('report_date', { ascending: false }).limit(1)
    setYm((last?.[0]?.report_date || new Date().toISOString()).slice(0, 7))
    setLoading(false)
  })() }, [stationId])

  useEffect(() => { if (!stationId || !ym) return; (async () => {
    const start = ym + '-01', end = ym + '-31'
    const { data: r } = await supabase.from('v_report_metrics').select('*').eq('station_id', stationId).gte('report_date', start).lte('report_date', end).order('report_date', { ascending: false })
    setRows(r || [])
    const { data: a } = await supabase.from('attachments').select('*').eq('station_id', stationId).gte('report_date', start).lte('report_date', end)
    setAtts(a || [])
    const { data: d } = await supabase.from('deposits').select('*').eq('station_id', stationId).gte('report_date', start).lte('report_date', end)
    setDeps(d || [])
    // URLs signées (marche que le bucket soit public ou privé)
    const paths = [...(a || []).map(x => x.photo_path), ...(d || []).map(x => x.photo_path)].filter(Boolean)
    if (paths.length) {
      const { data: signed } = await supabase.storage.from(BORDEREAUX_BUCKET).createSignedUrls(paths, 3600)
      const map = {}; (signed || []).forEach(s => { if (s.signedUrl) map[s.path] = s.signedUrl })
      setUrls(map)
    } else setUrls({})
  })() }, [stationId, ym])

  const url = (p) => urls[p] || supabase.storage.from(BORDEREAUX_BUCKET).getPublicUrl(p).data.publicUrl
  const attByDay = useMemo(() => group(atts, 'report_date'), [atts])
  const depByDay = useMemo(() => group(deps, 'report_date'), [deps])
  const years = ['2025', '2026']
  const yearOptions = years.map(y => ({ value: y, label: y }))

  const [yy, mm] = (ym || '2026-01').split('-')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      <Panel title="Saisies & photos" meta={`${rows.length} jour(s)`}
        actions={<>
          <Select size="sm" value={yy} onChange={e => setYm(`${e.target.value}-${mm}`)} options={yearOptions} />
          <Select size="sm" value={mm} onChange={e => setYm(`${yy}-${e.target.value}`)} options={MONTH_OPTIONS} />
        </>}>
        <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>
          Le détail de chaque journée avec toutes les infos et toutes les photos. Clique une ligne pour déplier.
        </p>
      </Panel>

      {loading
        ? <Panel><p style={{ font: '400 12px/1 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>Chargement…</p></Panel>
        : !rows.length
          ? <Panel><PanelEmpty icon="folder-open" label="Aucune saisie sur cette période" /></Panel>
          : rows.map(r => {
              const a = attByDay[r.report_date] || []
              const d = depByDay[r.report_date] || []
              const isOpen = open === r.report_date
              const np = a.length + d.filter(x => x.photo_path).length
              return (
                <Panel key={r.report_date} flush>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 'var(--sp-3)', padding: 'var(--gutter-panel)' }}
                    onClick={() => setOpen(isOpen ? null : r.report_date)}>
                    <b style={{ font: 'var(--fw-semibold) 13px/1.2 var(--font-ui)', color: 'var(--text-primary)' }}>{frDate(r.report_date)}</b>
                    <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <Tag>CA {fcfa(r.ca_carburant)}</Tag>
                      <Tag>Espèces {fcfa(r.cash_declare)}</Tag>
                      <Tag>Versé {fcfa(r.total_verse)}</Tag>
                      {np > 0
                        ? <Tag color="var(--state-ok)">Photos ({np})</Tag>
                        : <Tag color="var(--state-alarm)">Sans photo</Tag>}
                      <Icon name="chevron-down" size={14} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                    </div>
                  </div>

                  {isOpen && <div style={{ padding: '0 var(--gutter-panel) var(--gutter-panel)' }}>
                    <Section title="Ventes carburant">
                      <Info l="Essence" v={`${N(r.ess_litres)} L × ${N(r.ess_pu)} — bon ${fcfa(r.ess_bon)} · espèce ${fcfa(r.ess_espece)}`} />
                      <Info l="Gasoil" v={`${N(r.gas_litres)} L × ${N(r.gas_pu)} — bon ${fcfa(r.gas_bon)} · espèce ${fcfa(r.gas_espece)}`} />
                      <Info l="CA carburant / Bons en cours" v={`${fcfa(r.ca_carburant)} · cumul ${fcfa(r.total_bon_cumul)}`} />
                    </Section>
                    <Section title="Autres pôles (espèces)">
                      <Info l="Gaz / Supérette / Lubrifiant" v={`${fcfa(r.gaz_espece)} · ${fcfa(r.superette_espece)} · ${fcfa(r.lubrifiant_espece)}`} />
                    </Section>
                    <Section title="Compteurs">
                      <Info l="Ouverture E1→E4" v={`${N(r.e1_m)} · ${N(r.e2_m)} · ${N(r.e3_m)} · ${N(r.e4_m)}`} />
                      <Info l="Ouverture G1→G4" v={`${N(r.g1_m)} · ${N(r.g2_m)} · ${N(r.g3_m)} · ${N(r.g4_m)}`} />
                      <Info l="16h E1→E4" v={`${N(r.e1)} · ${N(r.e2)} · ${N(r.e3)} · ${N(r.e4)}`} />
                      <Info l="16h G1→G4" v={`${N(r.g1)} · ${N(r.g2)} · ${N(r.g3)} · ${N(r.g4)}`} />
                    </Section>
                    <Section title="Stock">
                      <Info l="Cuve essence / gasoil" v={`${N(r.ess_stock)} L · ${N(r.gas_stock)} L`} />
                      <Info l="Gaz 3/6/12/38 kg" v={`${N(r.gaz_stock_3)} · ${N(r.gaz_stock_6)} · ${N(r.gaz_stock_12)} · ${N(r.gaz_stock_38)}`} />
                    </Section>

                    {(a.length > 0 || d.some(x => x.photo_path)) && <>
                      <div style={{ font: 'var(--fw-semibold) 11px/1 var(--font-ui)', textTransform: 'uppercase', letterSpacing: 'var(--ls-label)', color: 'var(--text-muted)', margin: 'var(--sp-4) 0 var(--sp-3)' }}>Photos du jour</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
                        {a.map(x => <EvidenceThumb key={'a' + x.id} src={url(x.photo_path)} label={x.categorie} timestamp={x.note} status="none" size={92} onClick={() => window.open(url(x.photo_path), '_blank')} />)}
                        {d.filter(x => x.photo_path).map(x => <EvidenceThumb key={'d' + x.id} src={url(x.photo_path)} label={'versement ' + x.pole} timestamp={fcfa(x.montant)} status="none" size={92} onClick={() => window.open(url(x.photo_path), '_blank')} />)}
                      </div>
                    </>}

                    <Button size="sm" style={{ marginTop: 'var(--sp-4)' }} onClick={() => nav(`/saisie?date=${r.report_date}`)}>Ouvrir / modifier cette journée</Button>
                  </div>}
                </Panel>
              )
            })}
    </div>
  )
}

function group(arr, key) { const o = {}; for (const x of arr) { (o[x[key]] = o[x[key]] || []).push(x) } return o }
function Section({ title, children }) {
  return (<div style={{ marginBottom: 'var(--sp-4)' }}>
    <div style={{ font: 'var(--fw-semibold) 10px/1 var(--font-ui)', textTransform: 'uppercase', letterSpacing: 'var(--ls-micro)', color: 'var(--text-muted)', margin: '0 0 var(--sp-2)' }}>{title}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>{children}</div>
  </div>)
}
function Info({ l, v }) {
  return (<div style={{ display: 'flex', gap: 'var(--sp-4)', font: '400 13px/1.3 var(--font-ui)', flexWrap: 'wrap', alignItems: 'baseline' }}>
    <span style={{ color: 'var(--text-muted)', minWidth: 130, flexShrink: 0 }}>{l}</span>
    <span style={{ fontWeight: 600, color: 'var(--text-body)', wordBreak: 'break-word', flex: 1 }}>{v}</span>
  </div>)
}
