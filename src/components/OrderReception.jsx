import { useEffect, useState } from 'react'
import { supabase, BORDEREAUX_BUCKET } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { today } from '../lib/format'
import { N, receptionner as receptionnerCommande } from '../lib/orderReception'
import { ORDER_STATUS_TONES } from '../lib/tones'
import { Panel } from '../ds/octane/components/core/Panel.jsx'
import { Button } from '../ds/octane/components/core/Button.jsx'
import { IconButton } from '../ds/octane/components/core/IconButton.jsx'
import { Badge } from '../ds/octane/components/core/Badge.jsx'
import { Tag } from '../ds/octane/components/core/Tag.jsx'
import { Field } from '../ds/octane/components/forms/Field.jsx'
import { Input } from '../ds/octane/components/forms/Input.jsx'
import { Checkbox } from '../ds/octane/components/forms/Checkbox.jsx'
import { AlertBanner } from '../ds/octane/components/feedback/AlertBanner.jsx'
import { EvidenceUpload } from '../ds/octane/components/evidence/EvidenceUpload.jsx'

// Affichage UNIQUE des commandes à réceptionner (statut lancée / partielle),
// partagé par « Saisie du jour » et « Commandes » → strictement identique.
const CAT_LABELS = { carburant: 'Carburant', gaz: 'Gaz', lubrifiant: 'Lubrifiant', superette: 'Supérette' }

export default function OrderReception({ stationId, date, settings = {}, onDone, open = true, onToggle }) {
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

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  async function receptionner(o) {
    const raw = recv[o.id] || {}
    const r = raw.date ? raw : { ...raw, date: date || today() }
    setErr('')
    try {
      const deja = N(totals[o.id]?.quantite_recue_total)
      const result = await receptionnerCommande({ supabase, bucket: BORDEREAUX_BUCKET, stationId, session, order: o, recv: r, settings, deja })
      if (result.warnEcart) { setRecv(p => ({ ...p, [o.id]: { ...r, warnEcart: result.warnEcart } })); return }
      setRecv(p => ({ ...p, [o.id]: undefined }))
      flash(result.complet ? 'Commande soldée — stock mis à jour' : `Réception partielle (${result.total.toLocaleString('fr-FR')}/${N(o.quantite_commandee).toLocaleString('fr-FR')})`)
      await load(); onDone && onDone()
    } catch (e) { setErr(e.message || String(e)) }
  }

  if (!stationId || !orders.length) return null
  return (
    <Panel title="Commandes à réceptionner" meta={`${orders.length}`}
      actions={onToggle && <IconButton icon="chevron-down" size="sm" title={open ? 'Masquer' : 'Afficher'}
        onClick={onToggle} style={{ transform: open ? 'rotate(180deg)' : 'none' }} />}
      bodyStyle={open ? undefined : { display: 'none' }}>
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
