import { useEffect, useState } from 'react'
import { supabase, BORDEREAUX_BUCKET } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { numFR, today } from '../lib/format'
import { compressImage } from '../lib/image'
import { ORDER_STATUS_TONES } from '../lib/tones'
import { Panel } from '../ds/octane/components/core/Panel.jsx'
import { Button } from '../ds/octane/components/core/Button.jsx'
import { Badge } from '../ds/octane/components/core/Badge.jsx'
import { Tag } from '../ds/octane/components/core/Tag.jsx'
import { Field } from '../ds/octane/components/forms/Field.jsx'
import { Input } from '../ds/octane/components/forms/Input.jsx'
import { Checkbox } from '../ds/octane/components/forms/Checkbox.jsx'
import { AlertBanner } from '../ds/octane/components/feedback/AlertBanner.jsx'
import { EvidenceUpload } from '../ds/octane/components/evidence/EvidenceUpload.jsx'

// Affichage UNIQUE des commandes à réceptionner (statut lancée / partielle),
// partagé par « Saisie du jour » et « Commandes » → strictement identique.
const N = (v) => (v ? (numFR(v) ?? 0) : 0)
const CAT_LABELS = { carburant: 'Carburant', gaz: 'Gaz', lubrifiant: 'Lubrifiant', superette: 'Supérette' }

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
      flash(complet ? 'Commande soldée — stock mis à jour' : `Réception partielle (${total.toLocaleString('fr-FR')}/${N(o.quantite_commandee).toLocaleString('fr-FR')})`)
      await load(); onDone && onDone()
    } catch (e) { setErr(e.message || String(e)) }
  }

  if (!stationId || !orders.length) return null
  return (
    <Panel title="Commandes à réceptionner" meta={`${orders.length}`}>
      {err && <AlertBanner tone="alarm" title="Erreur" style={{ marginBottom: 'var(--sp-4)' }}>{err}</AlertBanner>}
      {msg && <AlertBanner tone="ok" title="Succès" style={{ marginBottom: 'var(--sp-4)' }}>{msg}</AlertBanner>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {orders.map(o => {
          const cat = o.categorie || 'carburant'
          const st = ORDER_STATUS_TONES[o.statut] || { label: o.statut, tone: 'idle' }
          const t = totals[o.id] || {}; const deja = N(t.quantite_recue_total)
          const reste = Math.max(N(o.quantite_commandee) - deja, 0)
          const r = recv[o.id]
          return (
            <div key={o.id} style={{ padding: 'var(--sp-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-1)', border: '1px solid var(--border-hairline)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
                <b style={{ font: 'var(--fw-semibold) 13px/1.2 var(--font-ui)', color: 'var(--text-primary)' }}>
                  {CAT_LABELS[cat] || cat} — {cat === 'superette' ? (o.lignes || []).length + ' article(s)' : `${o.produit} ${N(o.quantite_commandee) ? N(o.quantite_commandee).toLocaleString('fr-FR') : ''}`}
                </b>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
              {cat === 'superette' && o.lignes && <div style={{ font: '400 13px/1.4 var(--font-ui)', color: 'var(--text-body)', marginTop: 'var(--sp-2)' }}>{o.lignes.map(l => `${l.article} ×${l.qte}`).join(' · ')}</div>}
              {deja > 0 && <div style={{ marginTop: 'var(--sp-3)' }}><Tag>Reçu {deja.toLocaleString('fr-FR')} / {N(o.quantite_commandee).toLocaleString('fr-FR')} · reste {reste.toLocaleString('fr-FR')}</Tag></div>}
              {!r
                ? <Button size="sm" style={{ marginTop: 'var(--sp-3)' }} onClick={() => setRecv(p => ({ ...p, [o.id]: { cuve_avant: '', cuve_apres: '', date: date || today(), quantite_recue: reste ? String(reste) : '' } }))}>Réceptionner{deja > 0 ? ' (suite)' : ''}</Button>
                : <div style={{ marginTop: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                    <Field label="Quantité reçue cette fois *">
                      <Input type="text" inputMode="decimal" numeric value={r.quantite_recue || ''} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...r, quantite_recue: e.target.value } }))} />
                    </Field>
                    {cat === 'carburant' && <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                      <Field label="Cuve AVANT (L)"><Input type="text" inputMode="decimal" numeric value={r.cuve_avant} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...r, cuve_avant: e.target.value } }))} /></Field>
                      <Field label="Cuve APRÈS (L)"><Input type="text" inputMode="decimal" numeric value={r.cuve_apres} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...r, cuve_apres: e.target.value } }))} /></Field>
                    </div>}
                    <Field label="Date de réception">
                      <Input type="date" value={r.date || today()} max={today()} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...r, date: e.target.value } }))} />
                    </Field>
                    {r.warnEcart && (
                      <AlertBanner tone="warn" title="Écart détecté">
                        {r.warnEcart}
                        <Checkbox label="Forcer (c'est correct malgré tout)" checked={!!r.forceEcart} onChange={v => setRecv(p => ({ ...p, [o.id]: { ...r, forceEcart: v, warnEcart: v ? '' : r.warnEcart } }))} style={{ marginTop: 'var(--sp-3)' }} />
                      </AlertBanner>
                    )}
                    <EvidenceUpload label={r._file ? r._file.name : 'Photo (bon de livraison) — facultatif'} multiple={false} onFiles={files => setRecv(p => ({ ...p, [o.id]: { ...r, _file: files[0] } }))} />
                    <Button size="sm" tone="primary" onClick={() => receptionner(o)} style={{ alignSelf: 'flex-start' }}>Valider la réception</Button>
                  </div>}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
