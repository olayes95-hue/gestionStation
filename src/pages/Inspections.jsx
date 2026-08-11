import { useEffect, useState } from 'react'
import { supabase, BORDEREAUX_BUCKET } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useStation } from '../lib/station.jsx'
import { frDate, today } from '../lib/format'
import { compressImage } from '../lib/image'

const N = (v) => (v ? Number(v) : 0)

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
      setF(blank()); setFile(null); setMsg('Contrôle enregistré ✓'); setTimeout(() => setMsg(''), 2500); load()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  async function del(id) { await supabase.from('inspections').delete().eq('id', id); load() }

  return (
    <div>
      {msg && <div className="ok">{msg}</div>}
      {err && <div className="err">{err}</div>}

      <div className="card">
        <h2>🛂 Enregistrer un contrôle</h2>
        <p className="hint">Contrôle inopiné (ANM…) : prélèvement, retour en cuve, observations, photo de la fiche.</p>
        <form onSubmit={add}>
          <div className="row">
            <div><label>Date du contrôle</label><input type="date" value={f.date_controle} max={today()} onChange={e => setF({ ...f, date_controle: e.target.value })} /></div>
            <div><label>Organisme</label><input value={f.organisme} onChange={e => setF({ ...f, organisme: e.target.value })} /></div>
          </div>
          <label>Pompes concernées</label><input value={f.pompes} onChange={e => setF({ ...f, pompes: e.target.value })} placeholder="ex : E1, E3, G2" />
          <div className="row">
            <div><label>Prélevé (litres)</label><input type="number" inputMode="decimal" value={f.prelevement_litres} onChange={e => setF({ ...f, prelevement_litres: e.target.value })} /></div>
            <div><label>Retour en cuve (litres)</label><input type="number" inputMode="decimal" value={f.retour_cuve_litres} onChange={e => setF({ ...f, retour_cuve_litres: e.target.value })} /></div>
          </div>
          <label>Pompes conformes ?</label>
          <select value={f.conforme} onChange={e => setF({ ...f, conforme: e.target.value })}>
            <option value="">— non précisé —</option><option value="oui">Oui</option><option value="non">Non</option>
          </select>
          <label>Observations</label><textarea rows={3} value={f.observations} onChange={e => setF({ ...f, observations: e.target.value })} />
          <label>📷 Photo de la fiche</label>
          <input type="file" accept="image/*" capture="environment" onChange={e => setFile(e.target.files[0])} />
          <div style={{ height: 10 }} />
          <button className="btn small" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer le contrôle'}</button>
        </form>
      </div>

      <div className="card">
        <h2>Historique des contrôles ({list.length})</h2>
        {!list.length && <p className="muted">Aucun contrôle enregistré.</p>}
        {list.map(c => (
          <fieldset className="fieldset" key={c.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <b>{frDate(c.date_controle)} — {c.organisme}</b>
              {c.conforme != null && <span className="badge" style={{ background: c.conforme ? 'var(--ok)' : 'var(--danger)' }}>{c.conforme ? 'Conforme' : 'Non conforme'}</span>}
            </div>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              {c.pompes && <>Pompes : {c.pompes}<br /></>}
              Prélevé : {N(c.prelevement_litres)} L · Retour cuve : {N(c.retour_cuve_litres)} L
              {c.observations && <><br />Obs. : {c.observations}</>}
            </div>
            {c.fiche_photo_path && <a href={photoUrl(c.fiche_photo_path)} target="_blank" rel="noreferrer">
              <img src={photoUrl(c.fiche_photo_path)} alt="fiche" style={{ width: 110, height: 110, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)', marginTop: 8 }} /></a>}
            {(isAdmin || c.created_by === session.user.id) && <div><button className="btn sec small" style={{ marginTop: 8 }} onClick={() => del(c.id)}>Supprimer</button></div>}
          </fieldset>
        ))}
      </div>
    </div>
  )
}
function blank() { return { date_controle: today(), organisme: 'ANM', pompes: '', prelevement_litres: '', retour_cuve_litres: '', conforme: '', observations: '' } }
