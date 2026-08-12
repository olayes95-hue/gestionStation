import { useEffect, useState } from 'react'
import { supabase, BORDEREAUX_BUCKET } from '../lib/supabase'
import { useStation } from '../lib/station.jsx'
import { fcfa, frDate } from '../lib/format'
import { Panel, PanelEmpty } from '../ds/octane/components/core/Panel.jsx'
import { Button } from '../ds/octane/components/core/Button.jsx'
import { Tag } from '../ds/octane/components/core/Tag.jsx'
import { AlertBanner } from '../ds/octane/components/feedback/AlertBanner.jsx'
import { DataTable } from '../ds/octane/components/data/DataTable.jsx'
import { Kpi } from '../lib/Kpi.jsx'

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

  const columns = [
    { key: 'photo', header: 'Photo', render: r => (
      <a href={url(r.photo_path)} target="_blank" rel="noreferrer">
        <img src={url(r.photo_path)} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 'var(--radius-1)', border: '1px solid var(--border-default)', display: 'block' }} />
      </a>
    ) },
    { key: 'date', header: 'Date', render: r => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span>{frDate(r.deposit_date || r.report_date)}</span>
        <Tag>{r.pole}</Tag>
      </div>
    ) },
    { key: 'montant', header: 'Déclaré', numeric: true, align: 'right', render: r => fcfa(r.montant) },
    { key: 'montant_ocr', header: 'Lu (OCR)', numeric: true, align: 'right', render: r => r.montant_ocr != null ? fcfa(r.montant_ocr) : '—' },
    { key: 'ecart', header: 'Écart', numeric: true, align: 'right', render: r => {
      const ec = r.ocr_ecart
      const color = ec == null ? 'var(--text-muted)' : Math.abs(ec) > 100 ? 'var(--state-alarm)' : 'var(--state-ok)'
      return <span style={{ color, fontWeight: 600 }}>{ec == null ? '—' : Math.abs(ec) <= 100 ? '✓ OK' : (ec > 0 ? '+' : '') + fcfa(ec)}</span>
    } },
    { key: 'actions', header: '', align: 'right', render: r => (
      <Button size="sm" disabled={busy === r.id} onClick={() => analyser(r)}>
        {busy === r.id ? '…' : (r.montant_ocr != null ? 'Ré-analyser' : 'Analyser')}
      </Button>
    ) },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {err && <AlertBanner tone="alarm" title="Erreur">{err}</AlertBanner>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)' }}>
        <Kpi label="Bordereaux avec photo" value={rows.length} />
        <Kpi label="Analysés (OCR)" value={withOcr.length} />
        <Kpi label="Écarts détectés" value={mismatches.length} status={mismatches.length > 0 ? 'alarm' : 'ok'} />
      </div>

      <Panel title="Vérification des bordereaux (déclaré vs lu sur la photo)" flush>
        <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 'var(--sp-4) var(--gutter-panel) 0' }}>
          « Analyser » lit le montant sur la photo par IA et le compare au montant déclaré par le gérant.
        </p>
        <div style={{ marginTop: 'var(--sp-4)' }}>
          {rows.length
            ? <DataTable columns={columns} rows={rows} />
            : <PanelEmpty icon="camera" label="Aucun bordereau avec photo pour cette station" />}
        </div>
      </Panel>
    </div>
  )
}
