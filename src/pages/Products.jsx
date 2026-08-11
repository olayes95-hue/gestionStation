import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { numFR } from '../lib/format'

const CATS = ['gaz', 'lubrifiant', 'superette', 'autre']
const UNITES = ['bouteille', 'bidon', 'carton', 'unité', 'litre', 'valeur']

export default function Products() {
  const [list, setList] = useState([])
  const [cat, setCat] = useState('gaz')
  const [nf, setNf] = useState({ nom: '', unite: 'unité', prix_achat: '', prix_vente: '', seuil: '' })
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')

  async function load() { setList((await supabase.from('products').select('*').order('categorie').order('ordre')).data || []) }
  useEffect(() => { load() }, [])
  const flash = (m) => { setMsg(m); setErr(''); setTimeout(() => setMsg(''), 2000) }
  const up = (id, k, v) => setList(p => p.map(x => x.id === id ? { ...x, [k]: v } : x))

  async function add(e) {
    e.preventDefault(); setErr(''); if (!nf.nom) return
    const { error } = await supabase.from('products').insert({
      categorie: cat, nom: nf.nom, unite: nf.unite,
      prix_achat: numFR(nf.prix_achat), prix_vente: numFR(nf.prix_vente), seuil: numFR(nf.seuil) ?? 0,
      ordre: (list.filter(p => p.categorie === cat).length + 1) * 10 })
    if (error) setErr(error.message); else { setNf({ nom: '', unite: 'unité', prix_achat: '', prix_vente: '', seuil: '' }); flash('Produit ajouté ✓'); load() }
  }
  async function save(p) {
    const { error } = await supabase.from('products').update({
      nom: p.nom, unite: p.unite, prix_achat: numFR(p.prix_achat), prix_vente: numFR(p.prix_vente),
      seuil: numFR(p.seuil) ?? 0, actif: p.actif, ordre: numFR(p.ordre) }).eq('id', p.id)
    error ? setErr(error.message) : flash('Enregistré ✓')
  }
  async function del(id) { await supabase.from('products').delete().eq('id', id); load() }

  async function validate(p) {
    const { error } = await supabase.from('products').update({
      categorie: p.categorie, nom: p.nom, unite: p.unite,
      prix_achat: numFR(p.prix_achat), prix_vente: numFR(p.prix_vente), seuil: numFR(p.seuil) ?? 0,
      statut: 'valide', actif: true }).eq('id', p.id)
    error ? setErr(error.message) : (flash('Produit validé ✓'), load())
  }
  async function reject(id) { await supabase.from('products').delete().eq('id', id); load() }

  const pending = list.filter(p => p.statut === 'en_attente')
  const shown = list.filter(p => p.categorie === cat && p.statut !== 'en_attente')

  return (
    <div>
      {msg && <div className="ok">{msg}</div>}
      {err && <div className="err">{err}</div>}
      <div className="card">
        <h2>📚 Produits & prix</h2>
        <p className="hint">Catalogue par catégorie avec prix d'achat, prix de vente et seuil d'alerte. (Le carburant se règle dans « Prix & marge ».)</p>
        <div className="toolbar">
          {CATS.map(c => <button key={c} className={'btn small ' + (cat === c ? '' : 'sec')} onClick={() => setCat(c)}>{c}</button>)}
        </div>
      </div>

      {pending.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid #e67e22' }}>
          <h2>🕓 Produits à valider ({pending.length})</h2>
          <p className="hint">Ajoutés par une vendeuse pendant la vente. Corrige la catégorie / les prix si besoin, puis <b>Valider</b> (ou rejeter).</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nom</th><th>Catégorie</th><th>Unité</th><th className="num">Prix achat</th><th className="num">Prix vente</th><th className="num">Seuil</th><th></th></tr></thead>
              <tbody>
                {pending.map(p => (
                  <tr key={p.id}>
                    <td><input value={p.nom || ''} onChange={e => up(p.id, 'nom', e.target.value)} style={{ minWidth: 120 }} /></td>
                    <td><select value={p.categorie || 'superette'} onChange={e => up(p.id, 'categorie', e.target.value)}>{CATS.map(c => <option key={c}>{c}</option>)}</select></td>
                    <td><select value={p.unite || 'unité'} onChange={e => up(p.id, 'unite', e.target.value)}>{UNITES.map(u => <option key={u}>{u}</option>)}</select></td>
                    <td style={{ width: 90 }}><input value={p.prix_achat ?? ''} onChange={e => up(p.id, 'prix_achat', e.target.value)} /></td>
                    <td style={{ width: 90 }}><input value={p.prix_vente ?? ''} onChange={e => up(p.id, 'prix_vente', e.target.value)} /></td>
                    <td style={{ width: 70 }}><input value={p.seuil ?? ''} onChange={e => up(p.id, 'seuil', e.target.value)} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}><button className="btn small" onClick={() => validate(p)}>✓ Valider</button>{' '}<button className="btn sec small" onClick={() => reject(p.id)}>Rejeter</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h2 style={{ textTransform: 'capitalize' }}>{cat} ({shown.length})</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nom</th><th>Unité</th><th className="num">Prix achat</th><th className="num">Prix vente</th><th className="num">Seuil</th><th>Actif</th><th></th></tr></thead>
            <tbody>
              {shown.map(p => (
                <tr key={p.id}>
                  <td><input value={p.nom || ''} onChange={e => up(p.id, 'nom', e.target.value)} style={{ minWidth: 120 }} /></td>
                  <td><select value={p.unite || 'unité'} onChange={e => up(p.id, 'unite', e.target.value)}>{UNITES.map(u => <option key={u}>{u}</option>)}</select></td>
                  <td style={{ width: 90 }}><input value={p.prix_achat ?? ''} onChange={e => up(p.id, 'prix_achat', e.target.value)} /></td>
                  <td style={{ width: 90 }}><input value={p.prix_vente ?? ''} onChange={e => up(p.id, 'prix_vente', e.target.value)} /></td>
                  <td style={{ width: 70 }}><input value={p.seuil ?? ''} onChange={e => up(p.id, 'seuil', e.target.value)} /></td>
                  <td><input type="checkbox" style={{ width: 20 }} checked={!!p.actif} onChange={e => up(p.id, 'actif', e.target.checked)} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}><button className="btn small" onClick={() => save(p)}>OK</button>{' '}<button className="btn sec small" onClick={() => del(p.id)}>✕</button></td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={7} className="muted">Aucun produit.</td></tr>}
            </tbody>
          </table>
        </div>
        <form onSubmit={add} className="row-3" style={{ marginTop: 12, alignItems: 'end' }}>
          <div><label>Nouveau produit</label><input value={nf.nom} onChange={e => setNf({ ...nf, nom: e.target.value })} placeholder={cat === 'superette' ? 'ex : Eau 1,5L' : 'nom'} /></div>
          <div><label>Prix achat</label><input value={nf.prix_achat} onChange={e => setNf({ ...nf, prix_achat: e.target.value })} /></div>
          <div><label>Prix vente</label><input value={nf.prix_vente} onChange={e => setNf({ ...nf, prix_vente: e.target.value })} /></div>
          <div style={{ gridColumn: '1 / -1' }}><button className="btn small">+ Ajouter à « {cat} »</button></div>
        </form>
      </div>
    </div>
  )
}
