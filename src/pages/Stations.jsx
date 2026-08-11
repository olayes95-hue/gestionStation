import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Stations() {
  const [stations, setStations] = useState([])
  const [users, setUsers] = useState([])
  const [settings, setSettings] = useState(null)
  const [lubTypes, setLubTypes] = useState([])
  const [newLub, setNewLub] = useState('')
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')
  const [newName, setNewName] = useState('')

  async function load() {
    const [s, u, st, lt] = await Promise.all([
      supabase.from('stations').select('*').order('id'),
      supabase.from('profiles').select('id, full_name, role, station_id').order('full_name'),
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('lubrifiant_types').select('*').order('ordre'),
    ])
    setStations(s.data || []); setUsers(u.data || []); setSettings(st.data || null); setLubTypes(lt.data || [])
  }
  useEffect(() => { load() }, [])

  const flash = (m) => { setMsg(m); setErr(''); setTimeout(() => setMsg(''), 2500) }
  const fail = (e) => { setErr(e.message || String(e)) }

  async function saveStation(s) {
    const { error } = await supabase.from('stations').update({
      nom: s.nom, compte_bancaire: s.compte_bancaire,
      seuil_essence: num(s.seuil_essence), seuil_gasoil: num(s.seuil_gasoil),
      seuil_gaz: num(s.seuil_gaz), seuil_lubrifiant: num(s.seuil_lubrifiant),
    }).eq('id', s.id)
    error ? fail(error) : flash('Station enregistrée ✓')
  }
  async function addStation(e) {
    e.preventDefault(); if (!newName) return
    const { error } = await supabase.from('stations').insert({ nom: newName })
    if (error) fail(error); else { setNewName(''); load(); flash('Station ajoutée ✓') }
  }
  async function saveUser(u) {
    const { error } = await supabase.from('profiles').update({
      role: u.role, station_id: u.station_id ? Number(u.station_id) : null,
    }).eq('id', u.id)
    error ? fail(error) : flash('Membre mis à jour ✓')
  }
  async function savePrices(e) {
    e.preventDefault()
    const { error } = await supabase.from('settings').update({
      essence_pv: num(settings.essence_pv), gasoil_pv: num(settings.gasoil_pv), marge_unitaire: num(settings.marge_unitaire),
      essence_pa: num(settings.essence_pa), gasoil_pa: num(settings.gasoil_pa),
      taux_gaz: num(settings.taux_gaz), taux_superette: num(settings.taux_superette),
      seuil_rupture: num(settings.seuil_rupture),
      bons_utilisables_commande: !!settings.bons_utilisables_commande,
    }).eq('id', 1)
    error ? fail(error) : flash('Prix enregistrés ✓')
  }

  const upS = (id, k, v) => setStations(p => p.map(s => s.id === id ? { ...s, [k]: v } : s))
  const upU = (id, k, v) => setUsers(p => p.map(u => u.id === id ? { ...u, [k]: v } : u))
  const upL = (id, k, v) => setLubTypes(p => p.map(l => l.id === id ? { ...l, [k]: v } : l))
  async function addLub(e) { e.preventDefault(); if (!newLub) return; const { error } = await supabase.from('lubrifiant_types').insert({ nom: newLub, ordre: (lubTypes.length + 1) * 10 }); error ? fail(error) : (setNewLub(''), load(), flash('Référence ajoutée ✓')) }
  async function saveLub(l) { const { error } = await supabase.from('lubrifiant_types').update({ nom: l.nom, actif: l.actif, ordre: num(l.ordre) }).eq('id', l.id); error ? fail(error) : flash('Référence enregistrée ✓') }
  async function delLub(id) { await supabase.from('lubrifiant_types').delete().eq('id', id); load() }

  return (
    <div>
      {msg && <div className="ok">{msg}</div>}
      {err && <div className="err">{err}</div>}

      <div className="card">
        <h2>🏢 Stations</h2>
        <p className="hint">Nom, compte bancaire et seuils d'alerte de stock bas (en litres).</p>
        {stations.map(s => (
          <fieldset className="fieldset" key={s.id}>
            <div className="row">
              <div><label>Nom</label><input value={s.nom || ''} onChange={e => upS(s.id, 'nom', e.target.value)} /></div>
              <div><label>Compte bancaire</label><input value={s.compte_bancaire || ''} onChange={e => upS(s.id, 'compte_bancaire', e.target.value)} /></div>
            </div>
            <div className="row">
              <div><label>Seuil essence (L)</label><input type="number" value={s.seuil_essence ?? ''} onChange={e => upS(s.id, 'seuil_essence', e.target.value)} /></div>
              <div><label>Seuil gasoil (L)</label><input type="number" value={s.seuil_gasoil ?? ''} onChange={e => upS(s.id, 'seuil_gasoil', e.target.value)} /></div>
            </div>
            <div className="row">
              <div><label>Seuil gaz (bouteilles/type)</label><input type="number" value={s.seuil_gaz ?? ''} onChange={e => upS(s.id, 'seuil_gaz', e.target.value)} /></div>
              <div><label>Seuil lubrifiant (unités)</label><input type="number" value={s.seuil_lubrifiant ?? ''} onChange={e => upS(s.id, 'seuil_lubrifiant', e.target.value)} /></div>
            </div>
            <button className="btn small" style={{ marginTop: 10 }} onClick={() => saveStation(s)}>Enregistrer</button>
          </fieldset>
        ))}
        <form onSubmit={addStation} className="toolbar" style={{ marginTop: 4 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nouvelle station…" style={{ flex: 1 }} />
          <button className="btn small">+ Ajouter</button>
        </form>
      </div>

      <div className="card">
        <h2>👥 Équipe</h2>
        <p className="hint">Rattache chaque gérant à sa station. Un admin voit toutes les stations.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nom</th><th>Rôle</th><th>Station</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.full_name}</td>
                  <td><select value={u.role} onChange={e => upU(u.id, 'role', e.target.value)}>
                    <option value="pompiste">Pompiste</option><option value="vendeuse">Vendeuse</option><option value="gerant">Gérant</option><option value="admin">Admin</option></select></td>
                  <td><select value={u.station_id || ''} onChange={e => upU(u.id, 'station_id', e.target.value)}>
                    <option value="">— toutes / aucune —</option>
                    {stations.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}</select></td>
                  <td><button className="btn small" onClick={() => saveUser(u)}>OK</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>🛢️ Références lubrifiant</h2>
        <p className="hint">Ajoute, renomme, désactive ou supprime les références proposées à la saisie.</p>
        <div className="table-wrap" style={{ marginBottom: 12 }}>
          <table>
            <thead><tr><th>Nom</th><th className="num">Ordre</th><th>Actif</th><th></th></tr></thead>
            <tbody>
              {lubTypes.map(l => (
                <tr key={l.id}>
                  <td><input value={l.nom || ''} onChange={e => upL(l.id, 'nom', e.target.value)} /></td>
                  <td style={{ width: 80 }}><input type="number" value={l.ordre ?? ''} onChange={e => upL(l.id, 'ordre', e.target.value)} /></td>
                  <td><input type="checkbox" style={{ width: 20 }} checked={!!l.actif} onChange={e => upL(l.id, 'actif', e.target.checked)} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn small" onClick={() => saveLub(l)}>OK</button>{' '}
                    <button className="btn sec small" onClick={() => delLub(l.id)}>Suppr.</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form onSubmit={addLub} className="toolbar">
          <input value={newLub} onChange={e => setNewLub(e.target.value)} placeholder="Nouvelle référence (ex : 20W50 1L)" style={{ flex: 1 }} />
          <button className="btn small">+ Ajouter</button>
        </form>
      </div>

      {settings && (
        <div className="card">
          <h2>💲 Prix & marge</h2>
          <p className="hint">Prix de vente (pré-remplis dans la saisie), prix d'achat (coût des commandes) et marge, en FCFA/L.</p>
          <form onSubmit={savePrices}>
            <fieldset className="fieldset"><legend>Prix de vente</legend>
              <div className="row-3">
                <div><label>Essence</label><input type="number" value={settings.essence_pv} onChange={e => setSettings({ ...settings, essence_pv: e.target.value })} /></div>
                <div><label>Gasoil</label><input type="number" value={settings.gasoil_pv} onChange={e => setSettings({ ...settings, gasoil_pv: e.target.value })} /></div>
                <div><label>Marge (F/L)</label><input type="number" value={settings.marge_unitaire} onChange={e => setSettings({ ...settings, marge_unitaire: e.target.value })} /></div>
              </div>
            </fieldset>
            <fieldset className="fieldset"><legend>Prix d'achat</legend>
              <div className="row">
                <div><label>Essence</label><input type="number" value={settings.essence_pa ?? ''} onChange={e => setSettings({ ...settings, essence_pa: e.target.value })} /></div>
                <div><label>Gasoil</label><input type="number" value={settings.gasoil_pa ?? ''} onChange={e => setSettings({ ...settings, gasoil_pa: e.target.value })} /></div>
              </div>
            </fieldset>
            <fieldset className="fieldset"><legend>Taux de commission autres pôles (%)</legend>
              <div className="row">
                <div><label>Gaz + lubrifiant</label><input type="number" value={settings.taux_gaz ?? ''} onChange={e => setSettings({ ...settings, taux_gaz: e.target.value })} /></div>
                <div><label>Supérette</label><input type="number" value={settings.taux_superette ?? ''} onChange={e => setSettings({ ...settings, taux_superette: e.target.value })} /></div>
              </div>
            </fieldset>
            <fieldset className="fieldset"><legend>Seuil de rupture cuve (L)</legend>
              <p className="hint" style={{ marginTop: 0 }}>Niveau physique en dessous duquel il n'y a plus de ventes normales (crépine de la pompe). Sert de base aux prédictions (jours d'autonomie, date de rupture, alerte « commander maintenant ») — le stock utile = stock en cuve − ce seuil.</p>
              <div style={{ maxWidth: 160 }}><label>Essence + Gasoil</label><input type="number" value={settings.seuil_rupture ?? 250} onChange={e => setSettings({ ...settings, seuil_rupture: e.target.value })} /></div>
            </fieldset>
            <fieldset className="fieldset"><legend>Financement des commandes</legend>
              <p className="hint" style={{ marginTop: 0 }}>Quand les bons seront virés directement en banque, désactive cette option : le formulaire de commande n'affichera plus que le chèque comme mode de paiement (carburant + gaz/lubrifiant).</p>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={settings.bons_utilisables_commande !== false} onChange={e => setSettings({ ...settings, bons_utilisables_commande: e.target.checked })} />
                Les bons peuvent financer une commande
              </label>
            </fieldset>
            <button className="btn small">Enregistrer les prix</button>
          </form>
        </div>
      )}
    </div>
  )
}

const num = (v) => (v === '' || v == null || isNaN(v) ? null : Number(v))
