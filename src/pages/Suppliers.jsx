import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Suppliers() {
  const [list, setList] = useState([])
  const [f, setF] = useState({ nom: '', categorie: 'superette', contact: '' })
  const [err, setErr] = useState('')

  async function load() { setList((await supabase.from('suppliers').select('*').order('nom')).data || []) }
  useEffect(() => { load() }, [])

  async function add(e) {
    e.preventDefault(); setErr('')
    if (!f.nom) return
    const { error } = await supabase.from('suppliers').insert({ nom: f.nom, categorie: f.categorie, contact: f.contact || null })
    if (error) setErr(error.message)
    else { setF({ nom: '', categorie: 'superette', contact: '' }); load() }
  }
  async function del(id) {
    await supabase.from('suppliers').delete().eq('id', id); load()
  }

  return (
    <div>
      <div className="card">
        <h2>Ajouter un fournisseur</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>Le carburant a un fournisseur unique (non géré ici). Ajoute ici les fournisseurs supérette / lubrifiant / gaz / autre.</p>
        {err && <div className="err">{err}</div>}
        <form onSubmit={add}>
          <div className="row">
            <div><label>Nom</label><input value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} required /></div>
            <div><label>Catégorie</label>
              <select value={f.categorie} onChange={e => setF({ ...f, categorie: e.target.value })}>
                <option value="superette">Supérette</option><option value="lubrifiant">Lubrifiant</option>
                <option value="gaz">Gaz</option><option value="autre">Autre</option>
              </select></div>
          </div>
          <label>Contact (tél / email)</label><input value={f.contact} onChange={e => setF({ ...f, contact: e.target.value })} />
          <div style={{ height: 10 }} />
          <button className="btn">Ajouter</button>
        </form>
      </div>

      <div className="card">
        <h2>Fournisseurs ({list.length})</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nom</th><th>Catégorie</th><th>Contact</th><th></th></tr></thead>
            <tbody>
              {list.map(s => (
                <tr key={s.id}>
                  <td>{s.nom}</td><td>{s.categorie}</td><td>{s.contact || '—'}</td>
                  <td><button className="btn sec small" onClick={() => del(s.id)}>Suppr.</button></td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={4} className="muted">Aucun fournisseur.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
