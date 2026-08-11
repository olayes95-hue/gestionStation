import { useEffect, useState } from 'react'
import { supabase, BORDEREAUX_BUCKET } from '../lib/supabase'
import { useStation } from '../lib/station.jsx'
import { fcfa, frDate } from '../lib/format'

const N = (v) => (v ? Number(v) : 0)

export default function OcrCheck() {
  const { stationId } = useStation()
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState('')

  async function load() {
    if (!stationId) return
    const { data } = await supabase.from('deposits').select('*').eq('station_id', stationId)
      .not('photo_path', 'is', null).order('deposit_date', { ascending: false }).limit(200)
    setRows(data || [])
  }
  useEffect(() => { load() }, [stationId])
  const url = (p) => supabase.storage.from(BORDEREAUX_BUCKET).getPublicUrl(p).data.publicUrl

  async function analyser(dep) {
    setErr(''); setBusy(dep.id)
    try {
      const { data, error } = await supabase.functions.invoke('ocr-bordereau', { body: { deposit_id: dep.id } })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      await load()
    } catch (e) { setErr('Analyse impossible : ' + (e.message || e) + ' — la fonction serveur est-elle déployée ?') }
    finally { setBusy(null) }
  }

  const withOcr = rows.filter(r => r.montant_ocr != null)
  const mismatches = withOcr.filter(r => Math.abs(N(r.ocr_ecart)) > 100)

  return (
    <div>
      {err && <div className="err">{err}</div>}
      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <K label="Bordereaux avec photo" v={rows.length} />
        <K label="Analysés (OCR)" v={withOcr.length} />
        <K label="Écarts détectés" v={mismatches.length} danger={mismatches.length > 0} />
      </div>

      <div className="card">
        <h2>Vérification des bordereaux (déclaré vs lu sur la photo)</h2>
        <p className="hint">« Analyser » lit le montant sur la photo par IA et le compare au montant déclaré par le gérant.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Photo</th><th>Date</th><th className="num">Déclaré</th><th className="num">Lu (OCR)</th><th className="num">Écart</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => {
                const ec = r.ocr_ecart
                return (
                  <tr key={r.id}>
                    <td><a href={url(r.photo_path)} target="_blank" rel="noreferrer">
                      <img src={url(r.photo_path)} alt="" style={{ width: 46, height: 46, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} /></a></td>
                    <td>{frDate(r.deposit_date || r.report_date)}<div className="pill" style={{ marginTop: 2 }}>{r.pole}</div></td>
                    <td className="num">{fcfa(r.montant)}</td>
                    <td className="num">{r.montant_ocr != null ? fcfa(r.montant_ocr) : '—'}</td>
                    <td className="num" style={{ color: ec == null ? 'var(--muted)' : Math.abs(ec) > 100 ? 'var(--danger)' : 'var(--ok)', fontWeight: 600 }}>
                      {ec == null ? '—' : Math.abs(ec) <= 100 ? '✓ OK' : (ec > 0 ? '+' : '') + fcfa(ec)}</td>
                    <td><button className="btn sec small" disabled={busy === r.id} onClick={() => analyser(r)}>{busy === r.id ? '…' : (r.montant_ocr != null ? 'Ré-analyser' : 'Analyser')}</button></td>
                  </tr>
                )
              })}
              {!rows.length && <tr><td colSpan={6} className="muted">Aucun bordereau avec photo pour cette station.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
function K({ label, v, danger }) {
  return (<div className="kpi"><div className="label">{label}</div><div className="value" style={{ color: danger ? 'var(--danger)' : 'var(--primary)' }}>{v}</div></div>)
}
