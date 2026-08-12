import { useEffect, useState } from 'react'
import { supabase, BORDEREAUX_BUCKET } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useStation } from '../lib/station.jsx'
import { frDate, today } from '../lib/format'
import { compressImage } from '../lib/image'
import { Panel } from '../ds/octane/components/core/Panel.jsx'
import { Button } from '../ds/octane/components/core/Button.jsx'
import { Badge } from '../ds/octane/components/core/Badge.jsx'
import { Field } from '../ds/octane/components/forms/Field.jsx'
import { Input } from '../ds/octane/components/forms/Input.jsx'
import { Select } from '../ds/octane/components/forms/Select.jsx'
import { Textarea } from '../ds/octane/components/forms/Textarea.jsx'
import { AlertBanner } from '../ds/octane/components/feedback/AlertBanner.jsx'
import { EvidenceUpload } from '../ds/octane/components/evidence/EvidenceUpload.jsx'
import { PanelEmpty } from '../ds/octane/components/core/Panel.jsx'

const N = (v) => (v ? Number(v) : 0)
const CONFORME_OPTIONS = [
  { value: '', label: '— non précisé —' },
  { value: 'oui', label: 'Oui' },
  { value: 'non', label: 'Non' },
]

export default function Inspections() {
  const { session, isAdmin } = useAuth()
  const { stationId } = useStation()
  const [list, setList] = useState([])
  const [f, setF] = useState(blank())
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('')

  async function load() {
    if (!stationId) return
    setList((await supabase.from('inspections').select('*').eq('station_id', stationId).order('date_controle', { ascending: false })).data || [])
  }
  useEffect(() => { load() }, [stationId])
  const photoUrl = (p) => supabase.storage.from(BORDEREAUX_BUCKET).getPublicUrl(p).data.publicUrl

  async function add(e) {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      let fiche_photo_path = null
      if (file) {
        const path = `${stationId}/inspections/${f.date_controle}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`
        const { error: up } = await supabase.storage.from(BORDEREAUX_BUCKET).upload(path, await compressImage(file))
        if (up) throw up
        fiche_photo_path = path
      }
      const { error } = await supabase.from('inspections').insert({
        station_id: stationId, date_controle: f.date_controle, organisme: f.organisme,
        pompes: f.pompes || null, prelevement_litres: f.prelevement_litres ? Number(f.prelevement_litres) : null,
        retour_cuve_litres: f.retour_cuve_litres ? Number(f.retour_cuve_litres) : null,
        conforme: f.conforme === '' ? null : f.conforme === 'oui',
        observations: f.observations || null, fiche_photo_path, created_by: session.user.id })
      if (error) throw error
      setF(blank()); setFile(null); setMsg('Contrôle enregistré'); setTimeout(() => setMsg(''), 2500); load()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  async function del(id) { await supabase.from('inspections').delete().eq('id', id); load() }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {msg && <AlertBanner tone="ok" title="Succès">{msg}</AlertBanner>}
      {err && <AlertBanner tone="alarm" title="Erreur">{err}</AlertBanner>}

      <Panel title="Enregistrer un contrôle">
        <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 0 }}>
          Contrôle inopiné (ANM…) : prélèvement, retour en cuve, observations, photo de la fiche.
        </p>
        <form onSubmit={add} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
            <Field label="Date du contrôle" style={{ flex: '1 1 180px' }}>
              <Input type="date" value={f.date_controle} max={today()} onChange={e => setF({ ...f, date_controle: e.target.value })} />
            </Field>
            <Field label="Organisme" style={{ flex: '1 1 180px' }}>
              <Input value={f.organisme} onChange={e => setF({ ...f, organisme: e.target.value })} />
            </Field>
          </div>
          <Field label="Pompes concernées">
            <Input value={f.pompes} onChange={e => setF({ ...f, pompes: e.target.value })} placeholder="ex : E1, E3, G2" />
          </Field>
          <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
            <Field label="Prélevé (litres)" style={{ flex: '1 1 180px' }}>
              <Input type="number" inputMode="decimal" numeric value={f.prelevement_litres} onChange={e => setF({ ...f, prelevement_litres: e.target.value })} />
            </Field>
            <Field label="Retour en cuve (litres)" style={{ flex: '1 1 180px' }}>
              <Input type="number" inputMode="decimal" numeric value={f.retour_cuve_litres} onChange={e => setF({ ...f, retour_cuve_litres: e.target.value })} />
            </Field>
          </div>
          <Field label="Pompes conformes ?">
            <Select value={f.conforme} onChange={e => setF({ ...f, conforme: e.target.value })} options={CONFORME_OPTIONS} style={{ width: '100%' }} />
          </Field>
          <Field label="Observations">
            <Textarea rows={3} value={f.observations} onChange={e => setF({ ...f, observations: e.target.value })} />
          </Field>
          <Field label="Photo de la fiche">
            <EvidenceUpload label={file ? file.name : 'Déposer la photo'} multiple={false} onFiles={files => setFile(files[0])} />
          </Field>
          <Button type="submit" tone="primary" disabled={busy} style={{ alignSelf: 'flex-start' }}>
            {busy ? 'Enregistrement…' : 'Enregistrer le contrôle'}
          </Button>
        </form>
      </Panel>

      <Panel title="Historique des contrôles" meta={`${list.length}`}>
        {!list.length
          ? <PanelEmpty icon="shield-check" label="Aucun contrôle enregistré" />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              {list.map(c => (
                <div key={c.id} style={{ padding: 'var(--sp-5)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-1)', border: '1px solid var(--border-hairline)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-3)', alignItems: 'center' }}>
                    <b style={{ font: 'var(--fw-semibold) 13px/1.2 var(--font-ui)', color: 'var(--text-primary)' }}>{frDate(c.date_controle)} — {c.organisme}</b>
                    {c.conforme != null && <Badge tone={c.conforme ? 'ok' : 'alarm'}>{c.conforme ? 'Conforme' : 'Non conforme'}</Badge>}
                  </div>
                  <div style={{ font: '400 13px/1.5 var(--font-ui)', color: 'var(--text-body)', marginTop: 'var(--sp-3)' }}>
                    {c.pompes && <>Pompes : {c.pompes}<br /></>}
                    Prélevé : {N(c.prelevement_litres)} L · Retour cuve : {N(c.retour_cuve_litres)} L
                    {c.observations && <><br />Obs. : {c.observations}</>}
                  </div>
                  {c.fiche_photo_path && (
                    <a href={photoUrl(c.fiche_photo_path)} target="_blank" rel="noreferrer">
                      <img src={photoUrl(c.fiche_photo_path)} alt="fiche" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 'var(--radius-1)', border: '1px solid var(--border-default)', marginTop: 'var(--sp-4)', display: 'block' }} />
                    </a>
                  )}
                  {(isAdmin || c.created_by === session.user.id) && (
                    <div style={{ marginTop: 'var(--sp-4)' }}>
                      <Button size="sm" tone="danger" onClick={() => del(c.id)}>Supprimer</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>}
      </Panel>
    </div>
  )
}
function blank() { return { date_controle: today(), organisme: 'ANM', pompes: '', prelevement_litres: '', retour_cuve_litres: '', conforme: '', observations: '' } }
