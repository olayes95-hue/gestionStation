import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, BORDEREAUX_BUCKET } from '../lib/supabase'
import { useStation } from '../lib/station.jsx'
import { fcfa, frDate } from '../lib/format'

const N = (v) => (v ? Number(v) : 0)
const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12']

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

  if (loading) return <div className="center">Chargement…</div>
  const [yy, mm] = (ym || '2026-01').split('-')

  return (
    <div>
      <div className="card">
        <h2>🗂️ Saisies & photos</h2>
        <p className="hint">Le détail de chaque journée avec toutes les infos et toutes les photos. Clique une ligne pour déplier.</p>
        <div className="toolbar">
          <select value={yy} onChange={e => setYm(`${e.target.value}-${mm}`)}>{years.map(y => <option key={y}>{y}</option>)}</select>
          <select value={mm} onChange={e => setYm(`${yy}-${e.target.value}`)}>{MONTHS.map(m => <option key={m} value={m}>{m}</option>)}</select>
          <span className="pill">{rows.length} jour(s)</span>
        </div>
      </div>

      {!rows.length && <div className="card muted">Aucune saisie sur cette période.</div>}

      {rows.map(r => {
        const a = attByDay[r.report_date] || []
        const d = depByDay[r.report_date] || []
        const isOpen = open === r.report_date
        return (
          <div className="card" key={r.report_date}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: 8 }}
              onClick={() => setOpen(isOpen ? null : r.report_date)}>
              <b>{frDate(r.report_date)}</b>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span className="pill">CA {fcfa(r.ca_carburant)}</span>
                <span className="pill">Espèces {fcfa(r.cash_declare)}</span>
                <span className="pill">Versé {fcfa(r.total_verse)}</span>
                {(() => { const np = a.length + d.filter(x => x.photo_path).length; return np > 0
                  ? <span className="pill" style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}>📷 Oui ({np})</span>
                  : <span className="pill" style={{ background: '#fdecea', color: 'var(--danger)' }}>Sans photo</span> })()}
                <span className="muted">{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {isOpen && <div style={{ marginTop: 12 }}>
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
                <div className="hint" style={{ margin: '14px 0 6px', fontWeight: 600 }}>📷 Photos du jour</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {a.map(x => <Thumb key={'a' + x.id} src={url(x.photo_path)} label={x.categorie} note={x.note} />)}
                  {d.filter(x => x.photo_path).map(x => <Thumb key={'d' + x.id} src={url(x.photo_path)} label={'versement ' + x.pole} note={fcfa(x.montant)} />)}
                </div>
              </>}

              <button className="btn sec small" style={{ marginTop: 12 }} onClick={() => nav(`/saisie?date=${r.report_date}`)}>Ouvrir / modifier cette journée</button>
            </div>}
          </div>
        )
      })}
    </div>
  )
}

function group(arr, key) { const o = {}; for (const x of arr) { (o[x[key]] = o[x[key]] || []).push(x) } return o }
function Section({ title, children }) {
  return (<div style={{ marginBottom: 10 }}>
    <div className="muted" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 4px' }}>{title}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
  </div>)
}
function Info({ l, v }) {
  return (<div style={{ display: 'flex', gap: 10, fontSize: 13, flexWrap: 'wrap', alignItems: 'baseline' }}>
    <span className="muted" style={{ minWidth: 130, flexShrink: 0 }}>{l}</span>
    <span style={{ fontWeight: 600, wordBreak: 'break-word', flex: 1 }}>{v}</span>
  </div>)
}
function Thumb({ src, label, note }) {
  return (<div style={{ textAlign: 'center' }}>
    <a href={src} target="_blank" rel="noreferrer"><img src={src} alt="" style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} /></a>
    <div className="pill" style={{ marginTop: 4 }}>{label}</div>
    {note && <div className="muted" style={{ fontSize: 10.5, maxWidth: 92 }}>{note}</div>}
  </div>)
}
