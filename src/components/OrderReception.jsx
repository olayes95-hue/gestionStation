import { useEffect, useState } from 'react'
import { supabase, BORDEREAUX_BUCKET } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { numFR, today } from '../lib/format'
import { compressImage } from '../lib/image'

// Affichage UNIQUE des commandes à réceptionner (statut lancée / partielle),
// partagé par « Saisie du jour » et « Commandes » → strictement identique.
const N = (v) => (v ? (numFR(v) ?? 0) : 0)
const CAT_LABELS = { carburant: '⛽ Carburant', gaz: '🔥 Gaz', lubrifiant: '🛢️ Lubrifiant', superette: '🛒 Supérette' }
const STATUTS = { lancee: { label: 'Lancée', color: '#8e44ad' }, partielle: { label: 'Partielle', color: '#d68910' } }

export default function OrderReception({ stationId, date, settings = {}, onDone }) {
  const { session } = useAuth()
  const [orders, setOrders] = useState([])
  const [totals, setTotals] = useState({})
  const [recv, setRecv] = useState({})
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('')

  async function load() {
    if (!stationId) return
    const [o, rt] = await Promise.all([
      supabase.from('fuel_orders').select('*').eq('station_id', stationId).in('statut', ['lancee', 'partielle']).order('created_at'),
      supabase.from('v_order_reception').select('*').eq('station_id', stationId),
    ])
    setOrders(o.data || [])
    const m = {}; for (const x of (rt.data || [])) m[x.order_id] = x; setTotals(m)
  }
  useEffect(() => { load() }, [stationId])

  const pa = (produit) => produit === 'gasoil' ? N(settings.gasoil_pa || 730) : N(settings.essence_pa || 705)
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  async function receptionner(o) {
    const r = recv[o.id] || {}
    const day = r.date || date || today()
    const recu = numFR(r.quantite_recue)
    if (!recu || recu <= 0) { setErr('Renseigne la quantité effectivement reçue (> 0).'); return }
    if (o.categorie === 'carburant' && (r.cuve_avant === '' || r.cuve_apres === '' || r.cuve_avant == null || r.cuve_apres == null)) {
      setErr('Renseigne cuve AVANT et APRÈS.'); return
    }
    // Garde-fou : quantité déclarée reçue vs mesure physique cuve_après−cuve_avant (CETTE réception).
    // Un écart important signale un relevé « cuve avant » pris trop tôt (pollué par des ventes avant
    // l'arrivée réelle du camion) ou une erreur de saisie — pas forcément une vraie perte.
    if (o.categorie === 'carburant' && !r.forceEcart) {
      const cuveDelta = N(r.cuve_apres) - N(r.cuve_avant)
      const ecart = Math.abs(recu - cuveDelta)
      const seuil = Math.max(recu * (N(settings.taux_perte_acceptable) || 5) / 100, 50)
      if (ecart > seuil) {
        setRecv(p => ({ ...p, [o.id]: { ...r, warnEcart: `Déclaré reçu ${recu.toLocaleString('fr-FR')} L, mais cuve après−avant = ${cuveDelta.toLocaleString('fr-FR')} L (écart ${Math.round(ecart).toLocaleString('fr-FR')} L). Vérifie que « cuve avant » a bien été relevée juste avant l'arrivée du camion.` } }))
        return
      }
    }
    const deja = N(totals[o.id]?.quantite_recue_total)
    const total = deja + recu
    const marge = N(o.quantite_commandee) * (N(settings.taux_perte_acceptable) || 5) / 100
    const complet = total >= N(o.quantite_commandee) - marge
    setErr('')
    try {
      // Photo (bon de livraison / jauge) — facultative, n'empêche pas la réception.
      let photo_path = null
      if (r._file) {
        photo_path = `${stationId}/reception/${day}/${o.id}_${(r._file.name || 'photo').replace(/[^\w.\-]/g, '_')}`
        const { error: up } = await supabase.storage.from(BORDEREAUX_BUCKET).upload(photo_path, await compressImage(r._file))
        if (up) throw up
      }
      if (o.categorie === 'carburant') {
        const prix = pa(o.produit)
        await supabase.from('order_receptions').insert({ order_id: o.id, station_id: stationId, report_date: day, quantite_recue: recu, cuve_avant: numFR(r.cuve_avant), cuve_apres: numFR(r.cuve_apres), prix_achat: prix, montant: recu * prix, photo_path, created_by: session.user.id })
        await supabase.from('fuel_orders').update({ statut: complet ? 'recue' : 'partielle', cuve_avant: o.cuve_avant != null ? o.cuve_avant : numFR(r.cuve_avant), cuve_apres: numFR(r.cuve_apres), report_date: day, prix_achat: prix, montant: total * prix, recu_by: session.user.id, recu_at: new Date().toISOString() }).eq('id', o.id)
        const sf = o.produit === 'gasoil' ? 'gas_stock' : 'ess_stock'
        await supabase.from('daily_reports').upsert({ station_id: stationId, report_date: day, [sf]: numFR(r.cuve_apres), created_by: session.user.id }, { onConflict: 'station_id,report_date' })
      } else {
        await supabase.from('order_receptions').insert({ order_id: o.id, station_id: stationId, report_date: day, quantite_recue: recu, photo_path, created_by: session.user.id })
        await supabase.from('fuel_orders').update({ statut: complet ? 'recue' : 'partielle', report_date: day, recu_by: session.user.id, recu_at: new Date().toISOString() }).eq('id', o.id)
        const mvt = { station_id: stationId, categorie: o.categorie, type: 'entree', source: 'reception', ref: 'CMD#' + o.id, date_mouvement: day, created_by: session.user.id }
        if (o.categorie === 'superette') mvt.valeur = N(o.montant_paiement)
        else { mvt.produit = o.produit; mvt.quantite = recu }
        await supabase.from('stock_movements').insert(mvt)
      }
      if (photo_path) await supabase.from('attachments').insert({ station_id: stationId, report_date: day, categorie: 'reception', note: `${o.produit || o.categorie} — reçu ${recu} / ${N(o.quantite_commandee)}`, photo_path, created_by: session.user.id })
      setRecv(p => ({ ...p, [o.id]: undefined }))
      flash(complet ? '✅ Commande soldée — stock mis à jour' : `Réception partielle ✓ (${total.toLocaleString('fr-FR')}/${N(o.quantite_commandee).toLocaleString('fr-FR')})`)
      await load(); onDone && onDone()
    } catch (e) { setErr(e.message || String(e)) }
  }

  if (!stationId || !orders.length) return null
  return (
    <div className="card">
      <h2>🚚 Commandes à réceptionner ({orders.length})</h2>
      {err && <div className="err">{err}</div>}
      {msg && <div className="ok">{msg}</div>}
      {orders.map(o => {
        const cat = o.categorie || 'carburant'
        const st = STATUTS[o.statut] || { label: o.statut, color: '#666' }
        const t = totals[o.id] || {}; const deja = N(t.quantite_recue_total)
        const reste = Math.max(N(o.quantite_commandee) - deja, 0)
        const r = recv[o.id]
        return (
          <fieldset className="fieldset" key={o.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <b>{CAT_LABELS[cat] || cat} — {cat === 'superette' ? (o.lignes || []).length + ' article(s)' : `${o.produit} ${N(o.quantite_commandee) ? N(o.quantite_commandee).toLocaleString('fr-FR') : ''}`}</b>
              <span className="badge" style={{ background: st.color }}>{st.label}</span>
            </div>
            {cat === 'superette' && o.lignes && <div style={{ fontSize: 13, marginTop: 4 }}>{o.lignes.map(l => `${l.article} ×${l.qte}`).join(' · ')}</div>}
            {deja > 0 && <div style={{ marginTop: 4 }}><span className="pill">Reçu {deja.toLocaleString('fr-FR')} / {N(o.quantite_commandee).toLocaleString('fr-FR')} · reste {reste.toLocaleString('fr-FR')}</span></div>}
            {!r
              ? <div><button className="btn small" style={{ marginTop: 8 }} onClick={() => setRecv(p => ({ ...p, [o.id]: { cuve_avant: '', cuve_apres: '', date: date || today(), quantite_recue: reste ? String(reste) : '' } }))}>📥 Réceptionner{deja > 0 ? ' (suite)' : ''}</button></div>
              : <div style={{ marginTop: 8 }}>
                  <label>Quantité reçue cette fois *</label>
                  <input type="text" inputMode="decimal" value={r.quantite_recue || ''} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...r, quantite_recue: e.target.value } }))} />
                  {cat === 'carburant' && <div className="row" style={{ marginTop: 8 }}>
                    <div><label>Cuve AVANT (L)</label><input type="text" inputMode="decimal" value={r.cuve_avant} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...r, cuve_avant: e.target.value } }))} /></div>
                    <div><label>Cuve APRÈS (L)</label><input type="text" inputMode="decimal" value={r.cuve_apres} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...r, cuve_apres: e.target.value } }))} /></div>
                  </div>}
                  <label style={{ marginTop: 8, display: 'block' }}>Date de réception</label>
                  <input type="date" value={r.date || today()} max={today()} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...r, date: e.target.value } }))} />
                  {r.warnEcart && (
                    <div className="err" style={{ marginTop: 8 }}>
                      ⚠️ {r.warnEcart}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                        <input type="checkbox" checked={!!r.forceEcart} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...r, forceEcart: e.target.checked, warnEcart: e.target.checked ? '' : r.warnEcart } }))} />
                        Forcer (c'est correct malgré tout)
                      </label>
                    </div>
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 0', fontSize: 12.5, color: 'var(--primary)', cursor: 'pointer' }}>
                    📷 {r._file ? '✓ photo (bon de livraison)' : 'Photo (bon de livraison) — facultatif'}
                    <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...r, _file: e.target.files[0] } }))} />
                  </label>
                  <div><button className="btn small" style={{ marginTop: 8 }} onClick={() => receptionner(o)}>Valider la réception</button></div>
                </div>}
          </fieldset>
        )
      })}
    </div>
  )
}
