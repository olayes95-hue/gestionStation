import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useStation } from '../lib/station.jsx'
import { fcfa, frDate, numFR, today } from '../lib/format'

const N = (v) => (v ? (numFR(v) ?? 0) : 0)
const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12']
const CATS = [['gaz', 'Gaz'], ['lubrifiant', 'Lubrifiant'], ['superette', 'Supérette']]

export default function Stock() {
  const { session, isAdmin, isVendeuse, isPompiste } = useAuth()
  const { stationId } = useStation()
  const [stock, setStock] = useState([])
  const [valeur, setValeur] = useState([])
  const [mvts, setMvts] = useState([])
  const [sorties, setSorties] = useState([])
  const [products, setProducts] = useState([])
  const [action, setAction] = useState(null)   // null | 'entree' | 'ajustement'
  const [nm, setNm] = useState(blank('entree'))
  const [fYear, setFYear] = useState('all'); const [fMonth, setFMonth] = useState('all')
  const [showCats, setShowCats] = useState(['gaz', 'lubrifiant', 'superette'])  // pôles affichés (admin)
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')
  const toggleCat = (c) => setShowCats(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c])

  function blank(type) {
    return { categorie: isVendeuse ? 'superette' : 'gaz', produit: '', type, quantite: '', valeur: '', source: type === 'entree' ? 'achat' : 'inventaire', note: '', date_mouvement: today() }
  }
  function openAction(type) { setNm(blank(type)); setAction(type); setErr('') }

  async function load() {
    if (!stationId) return
    const [sp, sv, mv, so, pr] = await Promise.all([
      supabase.from('v_stock_produits').select('*').eq('station_id', stationId),
      supabase.from('v_stock_valeur').select('*').eq('station_id', stationId),
      supabase.from('stock_movements').select('*').eq('station_id', stationId).order('date_mouvement', { ascending: false }).limit(400),
      supabase.from('v_sorties_deduites').select('*').eq('station_id', stationId).order('report_date', { ascending: false }).limit(400),
      supabase.from('products').select('*').eq('actif', true).order('ordre'),
    ])
    setStock(sp.data || []); setValeur(sv.data || []); setMvts(mv.data || []); setSorties(so.data || []); setProducts(pr.data || [])
  }
  useEffect(() => { load() }, [stationId])
  const flash = (m) => { setMsg(m); setErr(''); setTimeout(() => setMsg(''), 2500) }

  async function addMvt(e) {
    e.preventDefault(); setErr('')
    const row = { station_id: stationId, categorie: nm.categorie, type: nm.type, source: nm.source || null, note: nm.note || null, date_mouvement: nm.date_mouvement, created_by: session.user.id }
    if (nm.categorie === 'superette') { if (!nm.valeur) { setErr('Renseigne le montant (F).'); return } row.valeur = numFR(nm.valeur) }
    else { if (!nm.produit || !nm.quantite) { setErr('Choisis un produit et une quantité.'); return } row.produit = nm.produit; row.quantite = numFR(nm.quantite) }
    const { error } = await supabase.from('stock_movements').insert(row)
    if (error) setErr(error.message)
    else { setAction(null); flash(nm.type === 'entree' ? '✅ Livraison enregistrée' : '✅ Inventaire corrigé'); load() }
  }
  async function delMvt(id) { await supabase.from('stock_movements').delete().eq('id', id); load() }

  const valTotal = valeur.reduce((s, v) => s + N(v.valeur), 0)
  const stockByCat = useMemo(() => { const o = {}; stock.forEach(s => { (o[s.categorie] = o[s.categorie] || []).push(s) }); return o }, [stock])
  const cats = isVendeuse ? [['superette', 'Supérette']] : CATS

  return (
    <div>
      {msg && <div className="ok">{msg}</div>}
      {err && <div className="err">{err}</div>}

      {/* ===== VALORISATION — admin ===== */}
      {isAdmin && <div className="grid kpis" style={{ marginBottom: 16 }}>
        {valeur.map(v => <div className="kpi" key={v.categorie}><div className="label" style={{ textTransform: 'capitalize' }}>Valeur stock {v.categorie}</div><div className="value" style={{ color: 'var(--primary)' }}>{fcfa(v.valeur)}</div></div>)}
        <div className="kpi"><div className="label">VALEUR TOTALE</div><div className="value" style={{ color: 'var(--primary)' }}>{fcfa(valTotal)}</div></div>
      </div>}

      {/* ===== STOCK ACTUEL (gaz/lub) — gérant/pompiste/admin ===== */}
      {!isVendeuse && <div className="card">
        <div className="toolbar">
          <h2 style={{ margin: 0, marginRight: 'auto' }}>📦 Stock restant</h2>
          {isAdmin && ['gaz', 'lubrifiant', 'superette'].map(c => (
            <button key={c} type="button" onClick={() => toggleCat(c)}
              className={'btn small' + (showCats.includes(c) ? '' : ' sec')}
              style={{ textTransform: 'capitalize' }}>{showCats.includes(c) ? '✓ ' : ''}{c}</button>
          ))}
        </div>
        <p className="hint">Ce qu'il reste, d'après le <b>dernier comptage déclaré dans la Saisie du jour</b>. Ici tu n'ajoutes que les <b>entrées</b> (livraisons) — les sorties/ventes sont calculées toutes seules.</p>
        {isAdmin && showCats.includes('superette') && (
          <div style={{ marginBottom: 10 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>supérette (valeur)</div>
            <div className="pill">{fcfa((valeur.find(v => v.categorie === 'superette') || {}).valeur)}</div>
          </div>
        )}
        {(isAdmin ? ['gaz', 'lubrifiant'].filter(c => showCats.includes(c)) : ['gaz', 'lubrifiant']).map(cat => (
          <div key={cat} style={{ marginBottom: 10 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{cat}</div>
            <div className="table-wrap">
              <table><thead><tr><th>Produit</th><th className="num">Reste</th><th className="num">Seuil</th></tr></thead>
                <tbody>
                  {(stockByCat[cat] || []).map(s => {
                    const pr = products.find(p => p.categorie === cat && p.nom === s.produit)
                    const low = pr && N(s.stock) < N(pr.seuil)
                    return <tr key={s.produit}><td>{s.produit}</td><td className="num" style={{ color: low ? 'var(--danger)' : 'inherit', fontWeight: 600 }}>{N(s.stock)}{low ? ' ⚠️' : ''}</td><td className="num muted">{pr ? N(pr.seuil) : '—'}</td></tr>
                  })}
                  {!(stockByCat[cat] || []).length && <tr><td colSpan={3} className="muted">Aucun comptage encore.</td></tr>}
                </tbody></table>
            </div>
          </div>
        ))}
      </div>}

      {/* ===== ACTIONS GUIDÉES — tout le monde ===== */}
      <div className="card">
        <h2>{isVendeuse ? '🛒 Supérette' : '📥 Que veux-tu faire ?'}</h2>
        {!action ? (
          <div className="moment-tiles" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="moment-tile" onClick={() => openAction('entree')}>
              <div className="emo">📥</div>
              <div className="t">J'ai reçu une livraison</div>
              <div className="d">Ajouter au stock ce qui vient d'arriver</div>
            </div>
            <div className="moment-tile" onClick={() => openAction('ajustement')}>
              <div className="emo">🔧</div>
              <div className="t">Corriger après inventaire</div>
              <div className="d">Ajuster si le compte réel diffère</div>
            </div>
          </div>
        ) : (
          <form onSubmit={addMvt}>
            <div className={action === 'entree' ? 'ok' : 'err'} style={{ marginTop: 0 }}>
              {action === 'entree'
                ? '📥 Livraison reçue — indique ce qui est entré en stock.'
                : '🔧 Correction d\'inventaire — indique la quantité (ou le montant) réellement constaté.'}
            </div>
            {!isVendeuse && (
              <div><label>Type de produit</label>
                <select value={nm.categorie} onChange={e => setNm({ ...nm, categorie: e.target.value, produit: '' })}>
                  {cats.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select></div>
            )}
            {nm.categorie === 'superette' ? (
              <div className="row">
                <div><label>Montant (F){action === 'ajustement' ? ' — stock réel' : ''}</label><input type="text" inputMode="decimal" autoFocus value={nm.valeur} onChange={e => setNm({ ...nm, valeur: e.target.value })} /></div>
                <div><label>Date</label><input type="date" value={nm.date_mouvement} max={today()} onChange={e => setNm({ ...nm, date_mouvement: e.target.value })} /></div>
              </div>
            ) : (
              <div className="row-3">
                <div><label>Produit</label><select value={nm.produit} onChange={e => setNm({ ...nm, produit: e.target.value })}><option value="">— choisir —</option>{products.filter(p => p.categorie === nm.categorie).map(p => <option key={p.id} value={p.nom}>{p.nom}</option>)}</select></div>
                <div><label>Quantité{action === 'ajustement' ? ' (écart)' : ''}</label><input type="text" inputMode="decimal" value={nm.quantite} onChange={e => setNm({ ...nm, quantite: e.target.value })} /></div>
                <div><label>Date</label><input type="date" value={nm.date_mouvement} max={today()} onChange={e => setNm({ ...nm, date_mouvement: e.target.value })} /></div>
              </div>
            )}
            <label>Note (facultatif)</label><input value={nm.note} onChange={e => setNm({ ...nm, note: e.target.value })} placeholder={action === 'entree' ? 'ex. bon de livraison n°…' : 'ex. casse, écart constaté…'} />
            <div style={{ height: 10 }} />
            <div className="toolbar">
              <button className="btn small">✅ Enregistrer</button>
              <button type="button" className="btn sec small" onClick={() => setAction(null)}>Annuler</button>
            </div>
          </form>
        )}
      </div>

      {/* ===== SORTIES DÉDUITES — admin seulement (analyse) ===== */}
      {isAdmin && (() => {
        const js = sorties.filter(s =>
          (fYear === 'all' || (s.report_date || '').slice(0, 4) === fYear)
          && (fMonth === 'all' || (s.report_date || '').slice(5, 7) === fMonth))
        return (
          <div className="card">
            <div className="toolbar">
              <h2 style={{ margin: 0, marginRight: 'auto' }}>📉 Sorties déduites (consommation)</h2>
              <span className="pill">calculé automatiquement</span>
            </div>
            <p className="hint">Sortie = stock déclaré la veille + entrées du jour − stock déclaré du jour. Négatif = entrée oubliée (à vérifier).</p>
            <div className="table-wrap">
              <table><thead><tr><th>Date</th><th>Catégorie</th><th>Produit</th><th className="num">Veille</th><th className="num">Entrées</th><th className="num">Jour</th><th className="num">Sortie déduite</th></tr></thead>
                <tbody>
                  {js.map((s, i) => <tr key={i}>
                    <td>{frDate(s.report_date)}</td><td>{s.categorie}</td><td>{s.produit}</td>
                    <td className="num muted">{N(s.stock_veille)}</td><td className="num muted">{N(s.entrees)}</td><td className="num muted">{N(s.stock_jour)}</td>
                    <td className="num" style={{ fontWeight: 600, color: N(s.sortie_deduite) < 0 ? 'var(--danger)' : 'inherit' }}>{N(s.sortie_deduite)}</td>
                  </tr>)}
                  {!js.length && <tr><td colSpan={7} className="muted">Rien à afficher (il faut au moins deux relevés consécutifs).</td></tr>}
                </tbody></table>
            </div>
          </div>
        )
      })()}

      {/* ===== JOURNAL ===== */}
      {isAdmin ? (() => {
        const base = mvts
        const years = [...new Set(base.map(m => (m.date_mouvement || '').slice(0, 4)).filter(Boolean))].sort()
        const jm = base.filter(m =>
          (fYear === 'all' || (m.date_mouvement || '').slice(0, 4) === fYear)
          && (fMonth === 'all' || (m.date_mouvement || '').slice(5, 7) === fMonth))
        const totVal = jm.reduce((s, m) => s + (m.valeur != null ? N(m.valeur) * (m.type === 'sortie' ? -1 : 1) : 0), 0)
        return (
          <div className="card">
            <div className="toolbar">
              <h2 style={{ margin: 0, marginRight: 'auto' }}>Journal des mouvements ({jm.length})</h2>
              <select value={fYear} onChange={e => setFYear(e.target.value)}><option value="all">Toutes années</option>{years.map(y => <option key={y}>{y}</option>)}</select>
              <select value={fMonth} onChange={e => setFMonth(e.target.value)}><option value="all">Tous mois</option>{MONTHS.map(m => <option key={m} value={m}>{m}</option>)}</select>
              {(fYear !== 'all' || fMonth !== 'all') && <button className="btn sec small" onClick={() => { setFYear('all'); setFMonth('all') }}>Réinit.</button>}
              <span className="pill">Solde valeur : {fcfa(totVal)}</span>
            </div>
            <div className="table-wrap">
              <table><thead><tr><th>Date</th><th>Catégorie</th><th>Produit</th><th>Type</th><th>Source</th><th className="num">Qté / Valeur</th><th></th></tr></thead>
                <tbody>
                  {jm.map(m => <tr key={m.id}>
                    <td>{frDate(m.date_mouvement)}</td><td>{m.categorie}</td><td>{m.produit || '—'}</td>
                    <td><span className="badge" style={{ background: m.type === 'sortie' ? 'var(--danger)' : m.type === 'entree' ? 'var(--ok)' : 'var(--warn)' }}>{m.type}</span></td>
                    <td className="muted">{m.source || '—'}</td>
                    <td className="num">{m.valeur != null ? fcfa(m.valeur) : N(m.quantite)}</td>
                    <td><button className="btn sec small" onClick={() => delMvt(m.id)}>✕</button></td>
                  </tr>)}
                  {!jm.length && <tr><td colSpan={7} className="muted">Aucun mouvement sur cette période.</td></tr>}
                </tbody></table>
            </div>
          </div>
        )
      })() : (() => {
        // gérant/pompiste/vendeuse : liste simple des dernières entrées (pas de filtres, pas de suppression)
        const recent = mvts.filter(m => !isVendeuse || m.categorie === 'superette').slice(0, 15)
        return (
          <div className="card">
            <h2>🕑 Mes dernières entrées</h2>
            <div className="table-wrap">
              <table><thead><tr><th>Date</th><th>Produit</th><th>Type</th><th className="num">Qté / Montant</th></tr></thead>
                <tbody>
                  {recent.map(m => <tr key={m.id}>
                    <td>{frDate(m.date_mouvement)}</td><td>{m.produit || m.categorie}</td>
                    <td><span className="badge" style={{ background: m.type === 'entree' ? 'var(--ok)' : 'var(--warn)' }}>{m.type === 'entree' ? 'Livraison' : m.type === 'ajustement' ? 'Inventaire' : m.type}</span></td>
                    <td className="num">{m.valeur != null ? fcfa(m.valeur) : N(m.quantite)}</td>
                  </tr>)}
                  {!recent.length && <tr><td colSpan={4} className="muted">Rien enregistré pour l'instant.</td></tr>}
                </tbody></table>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
