import { useEffect, useState } from 'react'
import { supabase, BORDEREAUX_BUCKET } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useStation } from '../lib/station.jsx'
import { fcfa, frDate, numFR, today } from '../lib/format'
import { compressImage } from '../lib/image'
import { ORDER_STATUS_TONES } from '../lib/tones'
import { Panel } from '../ds/octane/components/core/Panel.jsx'
import { Button } from '../ds/octane/components/core/Button.jsx'
import { Badge } from '../ds/octane/components/core/Badge.jsx'
import { Tag } from '../ds/octane/components/core/Tag.jsx'
import { Field } from '../ds/octane/components/forms/Field.jsx'
import { Input } from '../ds/octane/components/forms/Input.jsx'
import { Select } from '../ds/octane/components/forms/Select.jsx'
import { Checkbox } from '../ds/octane/components/forms/Checkbox.jsx'
import { AlertBanner } from '../ds/octane/components/feedback/AlertBanner.jsx'
import { DataTable } from '../ds/octane/components/data/DataTable.jsx'

const N = (v) => (v ? (numFR(v) ?? 0) : 0)
const CATS = [['carburant', 'Carburant'], ['gaz', 'Gaz'], ['lubrifiant', 'Lubrifiant'], ['superette', 'Supérette']]
// Lignes carburant par défaut (essence + gasoil commandés simultanément).
const carbRows = () => [{ produit: 'essence', qte: '', bons: '', cheque: '', ref: '' }, { produit: 'gasoil', qte: '', bons: '', cheque: '', ref: '' }]
const blankNf = () => ({ categorie: 'carburant', mode_paiement: 'cheque', rows: carbRows(), lignes: [{ article: '', qte: '' }], montant_paiement: '', date_proposition: today(), note: '' })

export default function Orders() {
  const { session, isAdmin, isPompiste } = useAuth()
  const { stationId } = useStation()
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [settings, setSettings] = useState({ essence_pa: 705, gasoil_pa: 730, taux_perte_acceptable: 5 })
  const [nf, setNf] = useState(blankNf())
  const [showPropose, setShowPropose] = useState(false)
  const [launch, setLaunch] = useState({})
  const [recv, setRecv] = useState({})
  const [recvTotals, setRecvTotals] = useState({})
  const [livreReel, setLivreReel] = useState({})   // {order_id: somme des (cuve_après−cuve_avant) PAR réception}
  const [fStatut, setFStatut] = useState('tous'); const [fCat, setFCat] = useState('tous'); const [fProduit, setFProduit] = useState('tous')
  const [year, setYear] = useState('all'); const [month, setMonth] = useState('all')
  const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState('')
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('')
  const [bonsRestant, setBonsRestant] = useState(0)

  async function load() {
    if (!stationId) return
    const [o, rt, lv] = await Promise.all([
      supabase.from('fuel_orders').select('*').eq('station_id', stationId).order('created_at', { ascending: false }),
      supabase.from('v_order_reception').select('*').eq('station_id', stationId),
      // Livraison réelle = somme des (cuve_après−cuve_avant) PAR réception (v40), insensible aux ventes
      // survenues entre deux réceptions partielles d'une même commande. Repli silencieux si v40 pas encore exécutée.
      supabase.from('v_order_livraison').select('*').eq('station_id', stationId),
    ])
    setOrders(o.data || [])
    const m = {}; for (const x of (rt.data || [])) m[x.order_id] = x; setRecvTotals(m)
    const lm = {}; for (const x of (lv.data || [])) lm[x.order_id] = N(x.livre_reel); setLivreReel(lm)
  }
  useEffect(() => { load() }, [stationId])
  useEffect(() => { supabase.from('settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => data && setSettings(data)) }, [])
  useEffect(() => { supabase.from('products').select('*').eq('actif', true).order('ordre').then(({ data }) => setProducts(data || [])) }, [])
  useEffect(() => { if (!stationId) return; supabase.from('v_latest_stock').select('bons_restant').eq('station_id', stationId).maybeSingle().then(({ data }) => setBonsRestant(N(data?.bons_restant))) }, [stationId])
  const pa = (produit) => produit === 'gasoil' ? N(settings.gasoil_pa) : N(settings.essence_pa)
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }
  const prodOf = (cat) => products.filter(p => p.categorie === cat)
  const bonsOn = settings.bons_utilisables_commande !== false   // interrupteur admin (v43)
  const MIN_CARBURANT = 5000   // litres minimum par produit, exigence fournisseur
  const COMBOS = [5000, 6000, 7000, 8000, 10000, 12000, 15000]

  // Applique une combinaison choisie dans le tableau : préremplit qté + bons + chèque de CE produit.
  function chooseCombo(produit, q) {
    const idx = nf.rows.findIndex(r => r.produit === produit)
    if (idx < 0) return
    const cost = q * pa(produit)
    const bons = bonsOn ? Math.min(bonsRestant, cost) : 0
    const cheque = cost - bons
    setRow(idx, 'qte', String(q))
    setRow(idx, 'bons', bons > 0 ? String(Math.round(bons)) : '')
    setRow(idx, 'cheque', String(Math.round(cheque)))
  }

  // Répartit les bons disponibles sur les lignes carburant (essence d'abord, puis gasoil).
  function applyBonsAuto() {
    let dispo = bonsRestant
    setNf(p => ({ ...p, rows: p.rows.map(r => {
      const cost = N(r.qte) * pa(r.produit)
      if (cost <= 0) return { ...r, bons: '', cheque: '' }
      const bons = Math.min(dispo, cost)
      dispo -= bons
      return { ...r, bons: bons > 0 ? String(Math.round(bons)) : '', cheque: String(Math.round(cost - bons)) }
    }) }))
  }

  // Changement de catégorie : prépare les lignes selon la catégorie choisie.
  function changeCat(cat) {
    let rows = []
    if (cat === 'carburant') rows = carbRows()
    else if (cat === 'gaz' || cat === 'lubrifiant') rows = prodOf(cat).map(p => ({ produit: p.nom, qte: '', montant: '' }))
    setNf({ ...blankNf(), categorie: cat, rows })
  }
  const setRow = (i, k, v) => setNf(p => ({ ...p, rows: p.rows.map((r, j) => j === i ? { ...r, [k]: v } : r) }))

  async function propose(e) {
    e.preventDefault(); setErr('')
    const c = nf.categorie
    const base = { station_id: stationId, categorie: c, note: nf.note || null, date_proposition: nf.date_proposition || today(), statut: 'proposee', proposed_by: session.user.id }
    let toInsert = []
    if (c === 'carburant') {
      const withQte = nf.rows.filter(r => N(r.qte) > 0)
      const sousMin = withQte.find(r => N(r.qte) < MIN_CARBURANT)
      if (sousMin) { setErr(`Quantité minimum ${MIN_CARBURANT.toLocaleString('fr-FR')} L par produit (exigence fournisseur) — ${sousMin.produit} : ${N(sousMin.qte).toLocaleString('fr-FR')} L.`); return }
      toInsert = withQte.map(r => ({
        ...base, produit: r.produit, quantite_commandee: numFR(r.qte),
        bons_base: bonsOn && r.bons ? numFR(r.bons) : null, cheque_montant: r.cheque ? numFR(r.cheque) : null,
        cheque_ref: r.ref || null, mode_paiement: 'bons' }))
      if (!toInsert.length) { setErr('Renseigne au moins une quantité (essence et/ou gasoil).'); return }
    } else if (c === 'gaz' || c === 'lubrifiant') {
      toInsert = nf.rows.filter(r => N(r.qte) > 0).map(r => ({
        ...base, produit: r.produit, quantite_commandee: numFR(r.qte),
        mode_paiement: bonsOn ? nf.mode_paiement : (nf.mode_paiement === 'bons' ? 'cheque' : nf.mode_paiement),
        montant_paiement: r.montant ? numFR(r.montant) : null }))
      if (!toInsert.length) { setErr('Renseigne au moins une quantité.'); return }
    } else { // superette : une seule commande, plusieurs articles (déjà simultané)
      const lignes = nf.lignes.filter(l => l.article && l.qte).map(l => ({ article: l.article, qte: numFR(l.qte) }))
      if (!lignes.length) { setErr('Ajoute au moins un article avec sa quantité.'); return }
      toInsert = [{ ...base, produit: 'supérette', lignes, mode_paiement: nf.mode_paiement, montant_paiement: nf.montant_paiement ? numFR(nf.montant_paiement) : null }]
    }
    const { error } = await supabase.from('fuel_orders').insert(toInsert)
    if (error) setErr(error.message); else { setNf(blankNf()); setShowPropose(false); flash(toInsert.length > 1 ? `${toInsert.length} commandes proposées` : 'Commande proposée'); load() }
  }
  async function setStatut(o, patch) { const { error } = await supabase.from('fuel_orders').update(patch).eq('id', o.id); error ? setErr(error.message) : load() }
  const valider = (o) => setStatut(o, { statut: 'validee', validated_by: session.user.id, validated_at: new Date().toISOString() })
  const refuser = (o) => setStatut(o, { statut: 'annulee' })
  const lancer = (o) => setStatut(o, { statut: 'lancee', lancee_at: new Date().toISOString(), date_lancement: launch[o.id] || today() })

  // Réception — action désormais intégrée à la ligne du tableau (plus de section séparée).
  async function receptionner(o) {
    const r = recv[o.id] || {}
    const day = r.date || today()
    const recu = numFR(r.quantite_recue)
    if (!recu || recu <= 0) { setErr('Renseigne la quantité effectivement reçue (> 0).'); return }
    const cat = o.categorie || 'carburant'
    if (cat === 'carburant' && (r.cuve_avant === '' || r.cuve_avant == null || r.cuve_apres === '' || r.cuve_apres == null)) {
      setErr('Renseigne cuve AVANT et APRÈS.'); return
    }
    // Garde-fou : quantité déclarée reçue vs mesure physique cuve_après−cuve_avant (CETTE réception).
    // Un écart important signale un relevé pris au mauvais moment (avant l'arrivée réelle du camion,
    // donc pollué par des ventes entre-temps) ou une erreur de saisie — pas forcément une vraie perte.
    if (cat === 'carburant' && !r.forceEcart) {
      const cuveDelta = N(r.cuve_apres) - N(r.cuve_avant)
      const ecart = Math.abs(recu - cuveDelta)
      const seuil = Math.max(recu * (N(settings.taux_perte_acceptable) || 5) / 100, 50)
      if (ecart > seuil) {
        setRecv(p => ({ ...p, [o.id]: { ...r, warnEcart: `Déclaré reçu ${recu.toLocaleString('fr-FR')} L, mais cuve après−avant = ${cuveDelta.toLocaleString('fr-FR')} L (écart ${Math.round(ecart).toLocaleString('fr-FR')} L). Vérifie que « cuve avant » a bien été relevée juste avant l'arrivée du camion (pas plus tôt dans la journée).` } }))
        return
      }
    }
    const deja = N(recvTotals[o.id]?.quantite_recue_total)
    const total = deja + recu
    const marge = N(o.quantite_commandee) * (N(settings.taux_perte_acceptable) || 5) / 100
    const complet = total >= N(o.quantite_commandee) - marge
    setErr('')
    try {
      let photo_path = null
      if (r._file) {
        photo_path = `${stationId}/reception/${day}/${o.id}_${(r._file.name || 'photo').replace(/[^\w.\-]/g, '_')}`
        const { error: up } = await supabase.storage.from(BORDEREAUX_BUCKET).upload(photo_path, await compressImage(r._file))
        if (up) throw up
      }
      if (cat === 'carburant') {
        const prix = pa(o.produit)
        await supabase.from('order_receptions').insert({ order_id: o.id, station_id: stationId, report_date: day, quantite_recue: recu, cuve_avant: numFR(r.cuve_avant), cuve_apres: numFR(r.cuve_apres), prix_achat: prix, montant: recu * prix, photo_path, created_by: session.user.id })
        await supabase.from('fuel_orders').update({ statut: complet ? 'recue' : 'partielle', cuve_avant: o.cuve_avant != null ? o.cuve_avant : numFR(r.cuve_avant), cuve_apres: numFR(r.cuve_apres), report_date: day, prix_achat: prix, montant: total * prix, recu_by: session.user.id, recu_at: new Date().toISOString() }).eq('id', o.id)
        const sf = o.produit === 'gasoil' ? 'gas_stock' : 'ess_stock'
        await supabase.from('daily_reports').upsert({ station_id: stationId, report_date: day, [sf]: numFR(r.cuve_apres), created_by: session.user.id }, { onConflict: 'station_id,report_date' })
      } else {
        await supabase.from('order_receptions').insert({ order_id: o.id, station_id: stationId, report_date: day, quantite_recue: recu, photo_path, created_by: session.user.id })
        await supabase.from('fuel_orders').update({ statut: complet ? 'recue' : 'partielle', report_date: day, recu_by: session.user.id, recu_at: new Date().toISOString() }).eq('id', o.id)
        const mvt = { station_id: stationId, categorie: cat, type: 'entree', source: 'reception', ref: 'CMD#' + o.id, date_mouvement: day, created_by: session.user.id }
        if (cat === 'superette') mvt.valeur = N(o.montant_paiement)
        else { mvt.produit = o.produit; mvt.quantite = recu }
        await supabase.from('stock_movements').insert(mvt)
      }
      setRecv(p => ({ ...p, [o.id]: undefined }))
      flash(complet ? 'Commande soldée — stock mis à jour' : `Réception partielle (${total.toLocaleString('fr-FR')}/${N(o.quantite_commandee).toLocaleString('fr-FR')})`)
      load()
    } catch (e) { setErr(e.message || String(e)) }
  }
  async function delOrder(o) { await supabase.from('fuel_orders').delete().eq('id', o.id); load() }

  // Réception réelle (écritures en base) déléguée au composant partagé OrderReception,
  // identique dans « Saisie du jour » et ici. Le tableau ci-dessous est un historique
  // en LECTURE (+ actions de workflow valider/refuser/lancer), pas un formulaire de réception.
  const orderMontant = (o) => o.categorie === 'carburant'
    ? (o.montant != null ? N(o.montant) : N(o.quantite_commandee) * pa(o.produit))
    : N(o.montant_paiement)
  const dateOf = (o) => o.date_proposition || (o.proposed_at || '').slice(0, 10) || ''
  // Délai (jours) entre le LANCEMENT et la RÉCEPTION (report_date = dernière réception connue).
  const delaiJours = (o) => (o.date_lancement && o.report_date)
    ? Math.round((new Date(o.report_date) - new Date(o.date_lancement)) / 86400000) : null
  const count = (s) => orders.filter(o => o.statut === s).length
  const produits = [...new Set(orders.map(o => o.produit).filter(Boolean))].sort()
  const orderYears = [...new Set(orders.map(o => dateOf(o).slice(0, 4)).filter(Boolean))].sort()

  const inPeriod = (d) => {
    if (!d) return true
    if (dateFrom && dateTo) return d >= dateFrom && d <= dateTo
    if (year !== 'all' && d.slice(0, 4) !== year) return false
    if (month !== 'all' && d.slice(5, 7) !== month) return false
    return true
  }
  const resetFilters = () => { setYear('all'); setMonth('all'); setDateFrom(''); setDateTo(''); setFCat('tous'); setFProduit('tous'); setFStatut('tous') }
  const filtersActive = year !== 'all' || month !== 'all' || dateFrom || dateTo || fCat !== 'tous' || fProduit !== 'tous' || fStatut !== 'tous'

  const shown = orders.filter(o =>
    inPeriod(dateOf(o)) &&
    (fStatut === 'tous' || o.statut === fStatut) &&
    (fCat === 'tous' || (o.categorie || 'carburant') === fCat) &&
    (fProduit === 'tous' || o.produit === fProduit))
  const totalMontant = shown.reduce((s, o) => s + orderMontant(o), 0)

  const columns = [
    { key: 'dates', header: 'Dates', render: o => (
      <div style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
        Prop. {frDate(dateOf(o))}
        {o.date_lancement && <><br />Lanc. {frDate(o.date_lancement)}</>}
        {o.statut === 'recue' && o.report_date && <><br />Reçue {frDate(o.report_date)}</>}
      </div>
    ) },
    { key: 'delai', header: 'Délai', numeric: true, align: 'right', render: o => delaiJours(o) != null ? `${delaiJours(o)} j` : '—' },
    { key: 'categorie', header: 'Catégorie', render: o => (CATS.find(c => c[0] === (o.categorie || 'carburant')) || [, o.categorie])[1] },
    { key: 'produit', header: 'Produit / détail', render: o => (o.categorie || 'carburant') === 'superette'
      ? <span title={(o.lignes || []).map(l => `${l.article} ×${l.qte}`).join(' · ')}>{(o.lignes || []).length} article(s)</span>
      : o.produit },
    { key: 'qte', header: 'Qté', numeric: true, align: 'right', render: o => (o.categorie || 'carburant') !== 'superette' && N(o.quantite_commandee) ? N(o.quantite_commandee).toLocaleString('fr-FR') : '—' },
    { key: 'statut', header: 'Statut', render: o => { const st = ORDER_STATUS_TONES[o.statut] || { label: o.statut, tone: 'idle' }; return <Badge tone={st.tone}>{st.label}</Badge> } },
    { key: 'paiement', header: 'Paiement', render: o => <span style={{ fontSize: 12 }}>{(o.categorie || 'carburant') === 'carburant'
      ? <>{fcfa(orderMontant(o))}{o.bons_base ? ` · bons ${fcfa(o.bons_base)}` : ''}{o.cheque_montant ? ` · chèque ${fcfa(o.cheque_montant)}` : ''}</>
      : <>{o.mode_paiement || '—'} · {fcfa(o.montant_paiement)}</>}</span> },
    { key: 'avancement', header: 'Avancement', render: o => {
      const cat = o.categorie || 'carburant'
      const livre = cat !== 'carburant' ? null
        : livreReel[o.id] != null ? livreReel[o.id]
        : (o.cuve_apres != null && o.cuve_avant != null) ? N(o.cuve_apres) - N(o.cuve_avant) : null
      const perte = livre != null ? Math.max(0, N(o.quantite_commandee) - livre) : null
      const seuil = N(o.quantite_commandee) * N(settings.taux_perte_acceptable) / 100
      const perteNA = perte != null ? Math.max(0, perte - seuil) : null
      const t = recvTotals[o.id] || {}; const deja = N(t.quantite_recue_total)
      const reste = Math.max(N(o.quantite_commandee) - deja, 0)
      return <span style={{ fontSize: 12 }}>
        {(o.statut === 'lancee' || o.statut === 'partielle') && <Tag>reçu {deja.toLocaleString('fr-FR')}/{N(o.quantite_commandee).toLocaleString('fr-FR')} · reste {reste.toLocaleString('fr-FR')}</Tag>}
        {o.statut === 'recue' && cat === 'carburant' && livre != null && (
          <span style={{ color: perteNA > 0 ? 'var(--state-alarm)' : 'var(--state-ok)' }}>
            livré {livre.toLocaleString('fr-FR')} · perte {perte.toLocaleString('fr-FR')}{perteNA > 0 ? ` (${Math.round(perteNA).toLocaleString('fr-FR')} hors seuil)` : ' ✓'}
          </span>
        )}
        {o.statut === 'recue' && cat !== 'carburant' && <span>reçu {deja.toLocaleString('fr-FR')}/{N(o.quantite_commandee).toLocaleString('fr-FR')}</span>}
        {!['lancee', 'partielle', 'recue'].includes(o.statut) && '—'}
      </span>
    } },
    { key: 'note', header: 'Note', render: o => <span style={{ fontSize: 12, maxWidth: 140, display: 'inline-block' }}>{o.note || ''}</span> },
    { key: 'actions', header: 'Actions', render: o => {
      const cat = o.categorie || 'carburant'
      const t = recvTotals[o.id] || {}; const deja = N(t.quantite_recue_total)
      const reste = Math.max(N(o.quantite_commandee) - deja, 0)
      return (
        <div style={{ whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {o.statut === 'proposee' && isAdmin && <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <Button size="sm" tone="primary" onClick={() => valider(o)}>✓</Button>
            <Button size="sm" tone="danger" onClick={() => refuser(o)}>✕</Button>
          </div>}
          {o.statut === 'proposee' && !isAdmin && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>en attente admin</span>}
          {o.statut === 'validee' && <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <Input type="date" size="sm" value={launch[o.id] || today()} max={today()} onChange={e => setLaunch(p => ({ ...p, [o.id]: e.target.value }))} style={{ width: 130 }} />
            <Button size="sm" tone="primary" onClick={() => lancer(o)}>Lancer</Button>
          </div>}
          {(o.statut === 'lancee' || o.statut === 'partielle') && (() => {
            const r = recv[o.id]
            if (!r) return <Button size="sm" onClick={() => setRecv(p => ({ ...p, [o.id]: { cuve_avant: '', cuve_apres: '', date: today(), quantite_recue: reste ? String(reste) : '' } }))}>Réceptionner{deja > 0 ? ' (suite)' : ''}</Button>
            return (
              <div style={{ minWidth: 200, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                <Field label="Qté reçue *"><Input size="sm" type="text" inputMode="decimal" numeric value={r.quantite_recue || ''} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...r, quantite_recue: e.target.value } }))} /></Field>
                {cat === 'carburant' && <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                  <Field label="Cuve avant"><Input size="sm" type="text" inputMode="decimal" numeric value={r.cuve_avant} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...r, cuve_avant: e.target.value } }))} /></Field>
                  <Field label="Cuve après"><Input size="sm" type="text" inputMode="decimal" numeric value={r.cuve_apres} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...r, cuve_apres: e.target.value } }))} /></Field>
                </div>}
                <Field label="Date"><Input size="sm" type="date" value={r.date || today()} max={today()} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...r, date: e.target.value } }))} /></Field>
                {r.warnEcart && (
                  <AlertBanner tone="warn" title="Écart" style={{ padding: 'var(--sp-3)' }}>
                    <span style={{ fontSize: 11 }}>{r.warnEcart}</span>
                    <Checkbox label="Forcer (c'est correct malgré tout)" checked={!!r.forceEcart} onChange={v => setRecv(p => ({ ...p, [o.id]: { ...r, forceEcart: v, warnEcart: v ? '' : r.warnEcart } }))} style={{ marginTop: 'var(--sp-2)' }} />
                  </AlertBanner>
                )}
                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                  <Button size="sm" tone="primary" onClick={() => receptionner(o)}>Valider</Button>
                  <Button size="sm" onClick={() => setRecv(p => ({ ...p, [o.id]: undefined }))}>Annuler</Button>
                </div>
              </div>
            )
          })()}
          {isAdmin && <Button size="sm" tone="danger" onClick={() => delOrder(o)}>Suppr.</Button>}
        </div>
      )
    } },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {msg && <AlertBanner tone="ok" title="Succès">{msg}</AlertBanner>}
      {err && <AlertBanner tone="alarm" title="Erreur">{err}</AlertBanner>}

      {!isPompiste && !showPropose && (
        <Button tone="primary" onClick={() => setShowPropose(true)} style={{ alignSelf: 'flex-start' }}>+ Proposer une nouvelle commande</Button>
      )}

      {!isPompiste && showPropose && (
        <Panel title="Proposer une commande" actions={<Button size="sm" onClick={() => setShowPropose(false)}>Fermer</Button>}>
          <form onSubmit={propose} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
              <Field label="Catégorie" style={{ flex: '1 1 180px' }}>
                <Select value={nf.categorie} onChange={e => changeCat(e.target.value)} options={CATS.map(([k, l]) => ({ value: k, label: l }))} style={{ width: '100%' }} />
              </Field>
              <Field label="Date de proposition" style={{ flex: '1 1 180px' }}>
                <Input type="date" value={nf.date_proposition} max={today()} onChange={e => setNf({ ...nf, date_proposition: e.target.value })} />
              </Field>
            </div>

            {nf.categorie === 'carburant' && <>
              <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>
                Commande simultanée essence + gasoil : renseigne la quantité de chaque produit (laisse à 0 ce que tu ne commandes pas). Une commande sera créée par produit. Minimum {MIN_CARBURANT.toLocaleString('fr-FR')} L par produit (exigence fournisseur).
              </p>

              {(pa('essence') === 0 || pa('gasoil') === 0) && (
                <AlertBanner tone="alarm" title="Prix manquant">
                  Prix d'achat manquant pour {[pa('essence') === 0 && 'essence', pa('gasoil') === 0 && 'gasoil'].filter(Boolean).join(' et ')} — les coûts affichés ci-dessous seront à 0 F.
                  Renseigne-le dans <b>Stations &amp; équipe → Prix &amp; marge → Prix d'achat</b> avant de proposer cette commande.
                </AlertBanner>
              )}

              {!bonsOn && <AlertBanner tone="info" title="Info">Les bons sont désormais virés directement en banque : les commandes se règlent à 100 % par chèque.</AlertBanner>}

              {bonsOn && (
                <Panel title="Combinaisons possibles" meta={`bons disponibles : ${fcfa(bonsRestant)}`} flush>
                  <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 'var(--sp-4) var(--gutter-panel) 0' }}>
                    Pour une quantité donnée, part payée en bons (dans la limite du disponible) vs complément en chèque — calculé indépendamment pour chaque produit.
                  </p>
                  <div style={{ marginTop: 'var(--sp-4)' }}>
                    <DataTable columns={[
                      { key: 'litres', header: 'Litres', numeric: true, align: 'right', render: row => row.litres.toLocaleString('fr-FR') },
                      { key: 'ce', header: 'Coût essence', numeric: true, align: 'right', render: row => fcfa(row.litres * pa('essence')) },
                      { key: 'be', header: 'Bons', numeric: true, align: 'right', render: row => fcfa(Math.min(bonsRestant, row.litres * pa('essence'))) },
                      { key: 'che', header: 'Chèque', numeric: true, align: 'right', render: row => fcfa(row.litres * pa('essence') - Math.min(bonsRestant, row.litres * pa('essence'))) },
                      { key: 'choose_e', header: '', render: row => <Button size="sm" onClick={() => chooseCombo('essence', row.litres)}>Choisir</Button> },
                      { key: 'cg', header: 'Coût gasoil', numeric: true, align: 'right', render: row => fcfa(row.litres * pa('gasoil')) },
                      { key: 'bg', header: 'Bons', numeric: true, align: 'right', render: row => fcfa(Math.min(bonsRestant, row.litres * pa('gasoil'))) },
                      { key: 'chg', header: 'Chèque', numeric: true, align: 'right', render: row => fcfa(row.litres * pa('gasoil') - Math.min(bonsRestant, row.litres * pa('gasoil'))) },
                      { key: 'choose_g', header: '', render: row => <Button size="sm" onClick={() => chooseCombo('gasoil', row.litres)}>Choisir</Button> },
                    ]} rows={COMBOS.map(q => ({ id: q, litres: q }))} />
                  </div>
                  <p style={{ font: '400 11px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 'var(--sp-4) var(--gutter-panel) 0' }}>
                    Si tu choisis essence ET gasoil, clique ensuite « Utiliser les bons disponibles » pour répartir correctement le pool de bons partagé entre les deux.
                  </p>
                  <div style={{ padding: '0 var(--gutter-panel) var(--gutter-panel)', marginTop: 'var(--sp-3)' }}>
                    <Button size="sm" onClick={applyBonsAuto}>Utiliser les bons disponibles (répartir sur les quantités saisies)</Button>
                  </div>
                </Panel>
              )}

              {nf.rows.map((r, i) => (
                <div key={r.produit} style={{ padding: 'var(--sp-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-1)', border: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                  <b style={{ textTransform: 'capitalize', font: 'var(--fw-semibold) 13px/1.2 var(--font-ui)', color: 'var(--text-primary)' }}>{r.produit}</b>
                  <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                    <Field label="Quantité (L)" style={{ flex: '1 1 140px' }}><Input type="text" inputMode="decimal" numeric value={r.qte} onChange={e => setRow(i, 'qte', e.target.value)} /></Field>
                    {bonsOn && <Field label="Bons (base, F)" style={{ flex: '1 1 140px' }}><Input type="text" inputMode="decimal" numeric value={r.bons} onChange={e => setRow(i, 'bons', e.target.value)} /></Field>}
                    <Field label={bonsOn ? 'Complément chèque (F)' : 'Chèque (F)'} style={{ flex: '1 1 140px' }}><Input type="text" inputMode="decimal" numeric value={r.cheque} onChange={e => setRow(i, 'cheque', e.target.value)} /></Field>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap', alignItems: 'end' }}>
                    <Field label="Réf. chèque" style={{ flex: '1 1 160px' }}><Input value={r.ref} onChange={e => setRow(i, 'ref', e.target.value)} /></Field>
                    {N(r.qte) > 0 && <span style={{ color: 'var(--state-ok)', font: '400 12px/1.3 var(--font-ui)' }}>Coût estimé <b>{fcfa(N(r.qte) * pa(r.produit))}</b> · financement {fcfa(N(r.bons) + N(r.cheque))}</span>}
                  </div>
                  {N(r.qte) > 0 && N(r.qte) < MIN_CARBURANT && <AlertBanner tone="alarm" title="Quantité insuffisante">Minimum {MIN_CARBURANT.toLocaleString('fr-FR')} L exigé par le fournisseur.</AlertBanner>}
                </div>
              ))}
              {(() => { const t = nf.rows.reduce((s, r) => s + N(r.qte) * pa(r.produit), 0); return t > 0 ? <div style={{ color: 'var(--state-ok)', font: '400 13px/1.3 var(--font-ui)' }}>Total commande : <b>{fcfa(t)}</b></div> : null })()}
            </>}

            {(nf.categorie === 'gaz' || nf.categorie === 'lubrifiant') && <>
              <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>Renseigne les quantités pour tous les types voulus en une seule fois. Une commande sera créée par produit avec une quantité &gt; 0.</p>
              {!nf.rows.length && <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>Aucun produit « {nf.categorie} » dans le catalogue. Ajoute-les d'abord dans « Produits &amp; prix ».</p>}
              <Field label="Paiement" style={{ maxWidth: 220 }}>
                <Select value={nf.mode_paiement} onChange={e => setNf({ ...nf, mode_paiement: e.target.value })}
                  options={[{ value: 'cheque', label: 'Chèque' }, { value: 'especes', label: 'Espèces' }, ...(bonsOn ? [{ value: 'bons', label: 'Bons' }] : [])]} style={{ width: '100%' }} />
              </Field>
              {nf.rows.length > 0 && (
                <DataTable columns={[
                  { key: 'produit', header: 'Produit' },
                  { key: 'qte', header: 'Quantité', numeric: true, align: 'right', render: r => <Input size="sm" type="text" inputMode="decimal" numeric value={r.qte} onChange={e => setRow(r.id, 'qte', e.target.value)} style={{ width: 90 }} /> },
                  { key: 'montant', header: 'Montant (F)', numeric: true, align: 'right', render: r => <Input size="sm" type="text" inputMode="decimal" numeric value={r.montant} onChange={e => setRow(r.id, 'montant', e.target.value)} style={{ width: 110 }} /> },
                ]} rows={nf.rows.map((r, i) => ({ ...r, id: i }))} />
              )}
              {(() => { const t = nf.rows.reduce((s, r) => s + N(r.montant), 0); return t > 0 ? <div style={{ color: 'var(--state-ok)', font: '400 13px/1.3 var(--font-ui)' }}>Total à payer : <b>{fcfa(t)}</b></div> : null })()}
            </>}

            {nf.categorie === 'superette' && <>
              <div style={{ font: 'var(--fw-semibold) 11px/1 var(--font-ui)', textTransform: 'uppercase', letterSpacing: 'var(--ls-label)', color: 'var(--text-muted)' }}>Articles</div>
              {nf.lignes.map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                  <Input list="prod-sup" value={l.article} placeholder="article" onChange={e => setNf({ ...nf, lignes: nf.lignes.map((x, j) => j === i ? { ...x, article: e.target.value } : x) })} style={{ flex: 2 }} />
                  <Input type="text" inputMode="decimal" numeric value={l.qte} placeholder="qté" onChange={e => setNf({ ...nf, lignes: nf.lignes.map((x, j) => j === i ? { ...x, qte: e.target.value } : x) })} style={{ flex: 1 }} />
                </div>
              ))}
              <datalist id="prod-sup">{prodOf('superette').map(p => <option key={p.id} value={p.nom} />)}</datalist>
              <Button type="button" onClick={() => setNf({ ...nf, lignes: [...nf.lignes, { article: '', qte: '' }] })} style={{ alignSelf: 'flex-start' }}>+ Article</Button>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                <Field label="Paiement" style={{ flex: '1 1 160px' }}>
                  <Select value={nf.mode_paiement} onChange={e => setNf({ ...nf, mode_paiement: e.target.value })} options={[{ value: 'cheque', label: 'Chèque' }, { value: 'especes', label: 'Espèces' }]} style={{ width: '100%' }} />
                </Field>
                <Field label="Montant total (F)" style={{ flex: '1 1 160px' }}>
                  <Input type="text" inputMode="decimal" numeric value={nf.montant_paiement} onChange={e => setNf({ ...nf, montant_paiement: e.target.value })} />
                </Field>
              </div>
            </>}

            <Field label="Note"><Input value={nf.note} onChange={e => setNf({ ...nf, note: e.target.value })} /></Field>
            <Button type="submit" tone="primary" style={{ alignSelf: 'flex-start' }}>Proposer la commande</Button>
          </form>
        </Panel>
      )}

      {/* Historique des commandes : tableau filtrable (mois OU période libre, catégorie, produit, statut).
          Toutes les actions d'une commande (valider/refuser/lancer/réceptionner/supprimer) sont ici,
          contextuelles au statut et au rôle — plus de section « à réceptionner » séparée. */}
      <Panel title="Historique des commandes" meta={`${shown.length} commande(s) · total ${fcfa(totalMontant)}`} flush>
        <div style={{ padding: 'var(--gutter-panel)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'center' }}>
            <Select size="sm" value={year} onChange={e => { setYear(e.target.value); setDateFrom(''); setDateTo('') }} options={[{ value: 'all', label: 'Toutes années' }, ...orderYears.map(y => ({ value: y, label: y }))]} />
            <Select size="sm" value={month} onChange={e => { setMonth(e.target.value); setDateFrom(''); setDateTo('') }} options={[{ value: 'all', label: 'Tous mois' }, ...['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => ({ value: m, label: m }))]} />
            <span style={{ font: '400 12px/1 var(--font-ui)', color: 'var(--text-muted)' }}>ou période :</span>
            <Input type="date" size="sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 150 }} />
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <Input type="date" size="sm" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 150 }} />
            {filtersActive && <Button size="sm" onClick={resetFilters}>Réinitialiser</Button>}
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <Button size="sm" tone={fCat === 'tous' ? 'primary' : 'outline'} onClick={() => { setFCat('tous'); setFProduit('tous') }}>Toutes catégories</Button>
            {CATS.map(([k, l]) => <Button key={k} size="sm" tone={fCat === k ? 'primary' : 'outline'} onClick={() => { setFCat(k); setFProduit('tous') }}>{l}</Button>)}
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <Select size="sm" value={fProduit} onChange={e => setFProduit(e.target.value)}
              options={[{ value: 'tous', label: 'Tous produits' }, ...produits.filter(p => fCat === 'tous' || orders.some(o => o.produit === p && (o.categorie || 'carburant') === fCat)).map(p => ({ value: p, label: p }))]} />
            {[['tous', 'Tous statuts'], ['proposee', `Proposées (${count('proposee')})`], ['validee', `Validées (${count('validee')})`], ['lancee', `Lancées (${count('lancee')})`], ['partielle', `Partielles (${count('partielle')})`], ['recue', `Reçues (${count('recue')})`], ['annulee', `Refusées (${count('annulee')})`]].map(([k, l]) =>
              <Button key={k} size="sm" tone={fStatut === k ? 'primary' : 'outline'} onClick={() => setFStatut(k)}>{l}</Button>)}
          </div>
        </div>
        <DataTable columns={columns} rows={shown} />
      </Panel>
    </div>
  )
}
