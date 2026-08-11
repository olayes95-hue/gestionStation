import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase, BORDEREAUX_BUCKET } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useStation } from '../lib/station.jsx'
import { fcfa, today, numFR, frDate } from '../lib/format'
import { compressImage } from '../lib/image'
import OrderReception from '../components/OrderReception.jsx'

const N = (v) => (v === '' || v === null || v === undefined ? 0 : (numFR(v) ?? 0))
const LUB_TYPES = ['5W30 1L','5W30 5L','20W50 5L','15W40 5L','80W90 1L','50 SAE 5L','Dexron 1L','Dot4 1L','10W40 5L','5W40 5L','Graisse','Liquide refroid.','Nettoyant injecteur','Nettoyant essence']
const GAZ = [['3','3 kg'],['6','6 kg'],['12','12 kg'],['38','38 kg']]
const NUMFIELDS = [
  'ess_litres','ess_pu','ess_bon','ess_espece','gas_litres','gas_pu','gas_bon','gas_espece',
  'gaz_espece','superette_espece','lubrifiant_espece',
  'e1','e2','e3','e4','g1','g2','g3','g4',           // relevés 16h (contrôle)
  'e1_m','e2_m','e3_m','e4_m','g1_m','g2_m','g3_m','g4_m', // relevés d'ouverture (matin)
  'total_bon_cumul',
  'ess_stock','gas_stock','gaz_stock_3','gaz_stock_6','gaz_stock_12','gaz_stock_38',
  'gaz_vendu_3','gaz_vendu_6','gaz_vendu_12','gaz_vendu_38',
]
const METERS_16H = ['e1','e2','e3','e4','g1','g2','g3','g4']
const EMPTY = Object.fromEntries([...NUMFIELDS.map(k => [k, '']), ['note', '']])

export default function Submit() {
  const { session, isAdmin, isPompiste, isVendeuse } = useAuth()
  const { stationId, current } = useStation()
  const [params] = useSearchParams()
  const [date, setDate] = useState(params.get('date') || today())
  const [moment, setMoment] = useState(defaultMoment())
  const [showAll, setShowAll] = useState(!!params.get('date'))
  const [f, setF] = useState(EMPTY)
  const [lub, setLub] = useState({})
  const [expenses, setExpenses] = useState([])
  const [deposits, setDeposits] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [attachments, setAttachments] = useState([])   // photos déjà envoyées
  const [newPhotos, setNewPhotos] = useState([])        // {file, categorie}
  const [pendingOrders, setPendingOrders] = useState([]) // commandes carburant à réceptionner
  const [recvOrder, setRecvOrder] = useState({})         // {orderId: {cuve_avant, cuve_apres, quantite_recue}}
  const [recvTotals, setRecvTotals] = useState({})       // {orderId: {quantite_recue_total, reste, complet}}
  const [meterPhotos, setMeterPhotos] = useState({})     // {champCompteur: {file, label}}
  const [lubTypes, setLubTypes] = useState(LUB_TYPES)    // références lubrifiant (dynamiques)
  const [settings, setSettings] = useState({ essence_pv: 725, gasoil_pv: 750, marge_unitaire: 25 })
  const [prods, setProds] = useState([])                 // catalogue supérette/autre (vendeuse)
  const [sales, setSales] = useState([])                 // lignes de vente du jour : {product_id, nom, quantite, prix_vente}
  const [pick, setPick] = useState('')                   // produit sélectionné dans la liste déroulante
  const [showNew, setShowNew] = useState(false)
  const [newProd, setNewProd] = useState({ nom: '', prix_achat: '', prix_vente: '' })
  const [prevMorning, setPrevMorning] = useState(null) // index compteur matin du dernier jour saisi
  const [meterWarn, setMeterWarn] = useState('')       // avertissement index incohérent
  const [forceMeter, setForceMeter] = useState(false)  // forcer malgré l'avertissement
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')

  useEffect(() => { supabase.from('settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => data && setSettings(data)) }, [])
  useEffect(() => { supabase.from('suppliers').select('id,nom,categorie').order('nom').then(({ data }) => setSuppliers(data || [])) }, [])
  useEffect(() => { supabase.from('products').select('nom').eq('categorie', 'lubrifiant').eq('actif', true).order('ordre').then(({ data }) => { if (data && data.length) setLubTypes(data.map(x => x.nom)) }) }, [])
  useEffect(() => { if (stationId) load(date) }, [date, stationId])

  // Index compteur MATIN du dernier jour saisi avant `date` — sert de garde-fou
  // (l'index d'une pompe ne peut que monter ; sinon décalage de l'écart compteur).
  useEffect(() => {
    if (!stationId || isVendeuse) return
    setForceMeter(false); setMeterWarn('')
    supabase.from('daily_reports')
      .select('report_date,e1_m,e2_m,e3_m,e4_m,g1_m,g2_m,g3_m,g4_m')
      .eq('station_id', stationId).lt('report_date', date)
      .order('report_date', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        if (!data) { setPrevMorning(null); return }
        setPrevMorning({
          ess: N(data.e1_m) + N(data.e2_m) + N(data.e3_m) + N(data.e4_m),
          gas: N(data.g1_m) + N(data.g2_m) + N(data.g3_m) + N(data.g4_m),
          date: data.report_date,
        })
      })
  }, [stationId, date, isVendeuse])

  // Vendeuse : catalogue supérette (produits validés) + lignes de vente déjà saisies pour la journée
  useEffect(() => {
    if (!isVendeuse) return
    supabase.from('products').select('*').in('categorie', ['superette', 'autre']).eq('actif', true).eq('statut', 'valide').order('nom')
      .then(({ data }) => setProds(data || []))
  }, [isVendeuse])
  useEffect(() => {
    if (!isVendeuse || !stationId) return
    supabase.from('superette_sales').select('*').eq('station_id', stationId).eq('report_date', date).order('id')
      .then(({ data }) => setSales((data || []).map(r => ({ product_id: r.product_id, nom: r.nom, quantite: String(r.quantite ?? ''), prix_vente: String(r.prix_vente ?? '') }))))
  }, [isVendeuse, stationId, date])

  async function load(d) {
    setMsg(''); setErr('')
    // Les 6 requêtes du jour sont lancées EN PARALLÈLE (avant : en série ≈ 6× la latence réseau).
    const [r, ex, dep, dl, at, po, rt] = await Promise.all([
      supabase.from('daily_reports').select('*').eq('report_date', d).eq('station_id', stationId).maybeSingle(),
      supabase.from('expenses').select('*').eq('report_date', d).eq('station_id', stationId),
      supabase.from('deposits').select('*').eq('report_date', d).eq('station_id', stationId),
      supabase.from('deliveries').select('*').eq('report_date', d).eq('station_id', stationId),
      supabase.from('attachments').select('*').eq('report_date', d).eq('station_id', stationId).order('id'),
      supabase.from('fuel_orders').select('*').eq('station_id', stationId).in('statut', ['validee', 'lancee', 'partielle']).order('created_at'),
      supabase.from('v_order_reception').select('*').eq('station_id', stationId),
    ])
    if (r.data) { const c = { ...EMPTY }; Object.keys(EMPTY).forEach(k => c[k] = r.data[k] ?? ''); setF(c); setLub(r.data.lubrifiant_stock || {}) }
    else { setF({ ...EMPTY, ess_pu: settings.essence_pv, gas_pu: settings.gasoil_pv }); setLub({}) }
    setExpenses(ex.data || [])
    setDeposits(dep.data || [])
    setDeliveries(dl.data || [])
    setAttachments(at.data || [])
    setNewPhotos([])
    setPendingOrders(po.data || [])
    const tmap = {}; for (const x of (rt.data || [])) tmap[x.order_id] = x; setRecvTotals(tmap)
    setRecvOrder({})
    setMeterPhotos({})
  }

  // champ compteur avec photo-preuve par pompe
  const meterField = (k, label) => (
    <div>
      <label>{label}</label>
      <input type="text" inputMode="decimal" value={f[k]} onChange={e => set(k, e.target.value)} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0 0', fontSize: 11.5, color: 'var(--primary)', cursor: 'pointer' }}>
        📷 {meterPhotos[k]?.file ? '✓ photo' : 'photo'}
        <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={e => setMeterPhotos(p => ({ ...p, [k]: e.target.files[0] ? { file: e.target.files[0], label } : undefined }))} />
      </label>
    </div>
  )

  async function receptionOrder(o) {
    const r = recvOrder[o.id] || {}
    const recu = numFR(r.quantite_recue)
    if (!recu || recu <= 0) { setErr('Renseigne les litres effectivement reçus (> 0).'); return }
    if (r.cuve_avant === '' || r.cuve_apres === '' || r.cuve_avant == null || r.cuve_apres == null) { setErr('Renseigne cuve avant ET après pour la réception.'); return }
    if (!r._file) { setErr('📷 Photo obligatoire pour valider la réception (bon de livraison / jauge).'); return }
    const prix = o.produit === 'gasoil' ? Number(settings.gasoil_pa || 730) : Number(settings.essence_pa || 705)
    // photo de réception
    const path = `${stationId}/reception/${date}/${Date.now()}_${r._file.name.replace(/[^\w.\-]/g, '_')}`
    const { error: up } = await supabase.storage.from(BORDEREAUX_BUCKET).upload(path, await compressImage(r._file)); if (up) { setErr(up.message); return }
    // 1) enregistre CETTE réception partielle
    const { error: eIns } = await supabase.from('order_receptions').insert({
      order_id: o.id, station_id: stationId, report_date: date, quantite_recue: recu,
      cuve_avant: numFR(r.cuve_avant), cuve_apres: numFR(r.cuve_apres),
      prix_achat: prix, montant: recu * prix, photo_path: path, created_by: session.user.id })
    if (eIns) { setErr(eIns.message); return }
    await supabase.from('attachments').insert({ station_id: stationId, report_date: date, categorie: 'reception', note: `${o.produit} — reçu ${recu} L / ${N(o.quantite_commandee)} L commandés`, photo_path: path, created_by: session.user.id })
    // 2) recalcule le cumul reçu + statut (partielle / recue) à la marge près
    const dejaRecu = N(recvTotals[o.id]?.quantite_recue_total)
    const total = dejaRecu + recu
    const marge = N(o.quantite_commandee) * (Number(settings.taux_perte_acceptable) || 5) / 100
    const complet = total >= N(o.quantite_commandee) - marge
    const { error } = await supabase.from('fuel_orders').update({
      statut: complet ? 'recue' : 'partielle',
      cuve_avant: o.cuve_avant != null ? o.cuve_avant : numFR(r.cuve_avant),   // fixé à la 1re réception
      cuve_apres: numFR(r.cuve_apres),                                          // dernier niveau connu
      report_date: date, prix_achat: prix, montant: total * prix,
      recu_by: session.user.id, recu_at: new Date().toISOString() }).eq('id', o.id)
    if (error) { setErr(error.message); return }
    // 3) stock cuve = niveau après cette réception
    const sf = o.produit === 'gasoil' ? 'gas_stock' : 'ess_stock'
    await supabase.from('daily_reports').upsert({ station_id: stationId, report_date: date, [sf]: numFR(r.cuve_apres), created_by: session.user.id }, { onConflict: 'station_id,report_date' })
    setMsg(complet ? '✅ Commande entièrement reçue — stock cuve mis à jour' : `Réception partielle enregistrée ✓ (${total.toLocaleString('fr-FR')} / ${N(o.quantite_commandee).toLocaleString('fr-FR')} L)`); load(date)
  }

  // un compteur a-t-il déjà sa photo (nouvelle ou déjà enregistrée) ?
  const meterHasPhoto = (k, label) => !!meterPhotos[k]?.file || attachments.some(a => a.categorie === 'compteur' && (a.note || '').startsWith(label))

  const photoUrl = (path) => supabase.storage.from(BORDEREAUX_BUCKET).getPublicUrl(path).data.publicUrl
  function addFiles(e) {
    const files = Array.from(e.target.files || [])
    setNewPhotos(p => [...p, ...files.map(file => ({ file, categorie: 'compteur' }))])
    e.target.value = ''
  }
  async function delAttachment(a) {
    await supabase.from('attachments').delete().eq('id', a.id)
    setAttachments(p => p.filter(x => x.id !== a.id))
  }

  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const cashDeclare = N(f.ess_espece)+N(f.gas_espece)+N(f.gaz_espece)+N(f.superette_espece)+N(f.lubrifiant_espece)
  const totDepense = expenses.reduce((s, e) => s + N(e.montant), 0)
  const totVerse = deposits.reduce((s, d) => s + N(d.montant), 0)
  const totLivr = deliveries.reduce((s, d) => s + N(d.montant), 0)
  const aVerser = cashDeclare - totDepense
  const ecart = aVerser - totVerse
  const marge = (N(f.ess_litres) + N(f.gas_litres)) * N(settings.marge_unitaire)
  const show = (m) => showAll || moment === m
  const locked = !isAdmin && date < daysAgoIso(30)   // gérant/pompiste/vendeuse : passé verrouillé (>1 mois)

  async function save() {
    if (!stationId) { setErr('Aucune station sélectionnée.'); return }
    if (locked) { setErr('🔒 Journée verrouillée : seul l\'administrateur peut modifier un jour de plus d\'un mois.'); return }
    // 16h obligatoire : les 8 relevés doivent être remplis pour l'envoi de 16h
    if (moment === 'apres-midi' && METERS_16H.some(k => f[k] === '' || f[k] === null || f[k] === undefined)) {
      setErr('⚠️ Relevés 16 h obligatoires : remplis les 8 index des pompes (E1–E4, G1–G4) avant d\'envoyer.')
      window.scrollTo({ top: 0, behavior: 'smooth' }); return
    }
    // justificatifs obligatoires : photo pour chaque dépense EN ESPÈCES
    // (la catégorie CARBURANT = prélèvement carburant du propriétaire, non-cash → pas de reçu).
    if (expenses.some(e => N(e.montant) > 0 && (e.categorie || '').toUpperCase() !== 'CARBURANT' && !e.photo_path && !e._file)) {
      setErr('⚠️ Photo du justificatif obligatoire pour chaque dépense en espèces.'); return
    }
    if (deposits.some(d => N(d.montant) > 0 && !d.photo_path && !d._file)) {
      setErr('⚠️ Photo du bordereau obligatoire pour chaque versement.'); return
    }
    if (deposits.some(d => N(d.montant) > 0 && (!d.periode_debut || !d.periode_fin))) {
      setErr('⚠️ Indique la période concernée (du… au…) pour chaque versement.'); return
    }
    if (deposits.some(d => N(d.montant) > 0 && d.periode_debut > d.periode_fin)) {
      setErr('⚠️ La date de début d\'un versement doit être avant sa date de fin.'); return
    }
    // photo obligatoire pour chaque compteur saisi (du moment)
    const meterSets = []
    if (moment === 'matin' || showAll) meterSets.push(['e1_m', 'Essence 1'], ['e2_m', 'Essence 2'], ['e3_m', 'Essence 3'], ['e4_m', 'Essence 4'], ['g1_m', 'Gasoil 1'], ['g2_m', 'Gasoil 2'], ['g3_m', 'Gasoil 3'], ['g4_m', 'Gasoil 4'])
    if (moment === 'apres-midi' || showAll) meterSets.push(['e1', 'Pompe E1'], ['e2', 'Pompe E2'], ['e3', 'Pompe E3'], ['e4', 'Pompe E4'], ['g1', 'Pompe G1'], ['g2', 'Pompe G2'], ['g3', 'Pompe G3'], ['g4', 'Pompe G4'])
    const missM = meterSets.find(([k, label]) => f[k] !== '' && f[k] != null && !meterHasPhoto(k, label))
    if (missM) { setErr(`⚠️ Photo obligatoire pour le compteur ${missM[1]} (bouton 📷).`); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    // Garde-fou décalage compteur : l'index du matin doit être > au dernier jour saisi.
    if ((moment === 'matin' || showAll) && prevMorning && !forceMeter) {
      const essNow = N(f.e1_m) + N(f.e2_m) + N(f.e3_m) + N(f.e4_m)
      const gasNow = N(f.g1_m) + N(f.g2_m) + N(f.g3_m) + N(f.g4_m)
      const parts = []
      if (essNow > 0 && prevMorning.ess > 0 && essNow <= prevMorning.ess) parts.push(`essence ${Math.round(essNow)} ≤ ${Math.round(prevMorning.ess)}`)
      if (gasNow > 0 && prevMorning.gas > 0 && gasNow <= prevMorning.gas) parts.push(`gasoil ${Math.round(gasNow)} ≤ ${Math.round(prevMorning.gas)}`)
      if (parts.length) {
        setMeterWarn(`Index du matin ${parts.join(' et ')} — relevé du ${frDate(prevMorning.date)}. Un index de pompe ne peut que MONTER : sans ça, l'écart compteur sera décalé d'un jour.`)
        setErr('⚠️ Relevé compteur du matin incohérent — voir la section « Relevés compteurs à l\'ouverture » plus bas.')
        window.scrollTo({ top: 0, behavior: 'smooth' }); return
      }
    }
    setBusy(true); setErr(''); setMsg('')
    const sid = stationId
    try {
      const payload = { report_date: date, station_id: sid, created_by: session.user.id, lubrifiant_stock: Object.keys(lub).length ? lub : null }
      NUMFIELDS.forEach(k => payload[k] = f[k] === '' ? null : numFR(f[k]))
      payload.note = f.note || null
      const { error: e1 } = await supabase.from('daily_reports').upsert(payload, { onConflict: 'station_id,report_date' })
      if (e1) throw e1

      await supabase.from('expenses').delete().eq('report_date', date).eq('station_id', sid)
      const exRows = []
      for (const e of expenses) {
        if (N(e.montant) <= 0) continue
        let photo_path = e.photo_path || null
        if (e._file) {
          const path = `${sid}/depenses/${date}/${Date.now()}_${e._file.name.replace(/[^\w.\-]/g, '_')}`
          const { error: up } = await supabase.storage.from(BORDEREAUX_BUCKET).upload(path, await compressImage(e._file)); if (up) throw up
          photo_path = path
        }
        const isCarb = (e.categorie || '').toUpperCase() === 'CARBURANT'
        const row = { report_date: date, station_id: sid, categorie: e.categorie || "AUTRE", montant: numFR(e.montant),
          motif: e.motif || (isCarb ? 'Carburant / déplacement propriétaire' : null),
          justificatif: true, photo_path, created_by: session.user.id }
        // non_cash n'est envoyé QUE pour le carburant/déplacement → les autres dépenses
        // continuent de fonctionner même si la migration v36 n'est pas encore exécutée.
        if (isCarb) row.non_cash = true
        exRows.push(row)
      }
      if (exRows.length) { const { error } = await supabase.from('expenses').insert(exRows); if (error) throw error }

      await supabase.from('deliveries').delete().eq('report_date', date).eq('station_id', sid)
      const lvRows = deliveries.filter(d => N(d.quantite) > 0 || N(d.montant) > 0).map(d => ({
        report_date: date, station_id: sid, type: d.type || 'autre', quantite: d.quantite ? numFR(d.quantite) : null,
        unite: d.unite || null, pu_achat: d.pu_achat ? numFR(d.pu_achat) : null,
        montant: d.montant ? numFR(d.montant) : null, fournisseur: d.fournisseur || null,
        supplier_id: d.supplier_id ? Number(d.supplier_id) : null, note: d.note || null, created_by: session.user.id }))
      if (lvRows.length) { const { error } = await supabase.from('deliveries').insert(lvRows); if (error) throw error }

      await supabase.from('deposits').delete().eq('report_date', date).eq('station_id', sid)
      const depRows = []
      for (const d of deposits) {
        if (N(d.montant) <= 0) continue
        let photo_path = d.photo_path || null
        if (d._file) {
          const path = `${sid}/${date}/${Date.now()}_${d._file.name.replace(/[^\w.\-]/g, '_')}`
          const { error: up } = await supabase.storage.from(BORDEREAUX_BUCKET).upload(path, await compressImage(d._file))
          if (up) throw up
          photo_path = path
        }
        depRows.push({ report_date: date, station_id: sid, pole: d.pole || "carburant", montant: numFR(d.montant),
          periode_debut: d.periode_debut || null, periode_fin: d.periode_fin || null,
          deposit_date: d.periode_fin || null, photo_path, created_by: session.user.id })
      }
      if (depRows.length) { const { error } = await supabase.from('deposits').insert(depRows); if (error) throw error }
      // photos-preuves envoyées
      for (const np of newPhotos) {
        const path = `${sid}/photos/${date}/${Date.now()}_${np.file.name.replace(/[^\w.\-]/g, '_')}`
        const { error: up } = await supabase.storage.from(BORDEREAUX_BUCKET).upload(path, await compressImage(np.file))
        if (up) throw up
        const { error: ai } = await supabase.from('attachments').insert({
          station_id: sid, report_date: date, categorie: np.categorie || 'autre', photo_path: path, created_by: session.user.id })
        if (ai) throw ai
      }
      // photos des compteurs (une par pompe)
      for (const [k, mp] of Object.entries(meterPhotos)) {
        if (!mp?.file) continue
        const path = `${sid}/compteurs/${date}/${k}_${Date.now()}_${mp.file.name.replace(/[^\w.\-]/g, '_')}`
        const { error: up } = await supabase.storage.from(BORDEREAUX_BUCKET).upload(path, await compressImage(mp.file))
        if (up) throw up
        const { error: ai } = await supabase.from('attachments').insert({
          station_id: sid, report_date: date, categorie: 'compteur', note: `${mp.label} — index ${f[k] || '?'}`, photo_path: path, created_by: session.user.id })
        if (ai) throw ai
      }

      // NB : plus de sortie automatique pour le GAZ / LUBRIFIANT.
      // Le stock est DÉCLARÉ chaque jour (gaz_stock_*, lubrifiant_stock) ; la sortie
      // (consommation) est DÉDUITE de deux relevés consécutifs par la vue v_sorties_deduites :
      //   sortie(J) = stock_déclaré(J-1) + entrées(J) − stock_déclaré(J).
      // On nettoie d'éventuelles anciennes sorties auto gaz/lubrifiant (doublons → stock négatif).
      await supabase.from('stock_movements').delete()
        .eq('station_id', sid).eq('date_mouvement', date).eq('source', 'vente')
        .in('categorie', ['gaz', 'lubrifiant'])
      // Supérette : suivie en VALEUR (pas de comptage déclaré) → sortie au coût de revient.
      await supabase.from('stock_movements').delete()
        .eq('station_id', sid).eq('date_mouvement', date).eq('source', 'vente').eq('categorie', 'superette')
      const tauxSup = N(settings.taux_superette) || 8
      const cogs = numFR(f.superette_espece) ? Math.round(numFR(f.superette_espece) * (1 - tauxSup / 100)) : 0
      if (cogs) await supabase.from('stock_movements').insert([{ station_id: sid, categorie: 'superette', type: 'sortie', valeur: cogs, source: 'vente', note: 'coût de revient', date_mouvement: date, created_by: session.user.id }])

      await supabase.from('submissions').insert({ report_date: date, station_id: sid, moment, created_by: session.user.id })

      setMsg(`✅ Enregistré ! (${momentLabel(moment)} — ${date})`)
      load(date)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) { setErr(e.message || String(e)) } finally { setBusy(false) }
  }

  // ===== VENDEUSE : ventes supérette par produit =====
  const lineMontant = (s) => N(s.quantite) * N(s.prix_vente)
  const salesTotal = sales.reduce((a, s) => a + lineMontant(s), 0)
  const updLine = (i, k, v) => setSales(p => p.map((s, j) => j === i ? { ...s, [k]: v } : s))
  const removeLine = (i) => setSales(p => p.filter((_, j) => j !== i))
  function addLineFromPick() {
    const p = prods.find(x => String(x.id) === String(pick))
    if (!p) return
    setSales(s => [...s, { product_id: p.id, nom: p.nom, quantite: '1', prix_vente: p.prix_vente != null ? String(p.prix_vente) : '' }])
    setPick('')
  }
  async function addNewProduct() {
    const nom = (newProd.nom || '').trim()
    if (!nom) { setErr('Donne un nom au produit.'); return }
    setErr('')
    const payload = {
      categorie: 'superette', nom, unite: 'unité',
      prix_achat: numFR(newProd.prix_achat), prix_vente: numFR(newProd.prix_vente),
      statut: 'en_attente', actif: true, station_id: stationId, created_by: session.user.id, ordre: 100,
    }
    let { data, error } = await supabase.from('products').insert(payload).select().single()
    if (error && /duplicate|unique/i.test(error.message)) {
      const ex = await supabase.from('products').select('*').eq('categorie', 'superette').eq('nom', nom).maybeSingle()
      data = ex.data
    } else if (error) { setErr(error.message); return }
    if (!data) { setErr('Produit introuvable après ajout.'); return }
    setProds(p => [...p.filter(x => x.id !== data.id), data])
    setSales(s => [...s, { product_id: data.id, nom: data.nom, quantite: '1', prix_vente: data.prix_vente != null ? String(data.prix_vente) : (newProd.prix_vente || '') }])
    setNewProd({ nom: '', prix_achat: '', prix_vente: '' }); setShowNew(false)
  }

  async function saveVendeuse() {
    if (!stationId) { setErr('Aucune station sélectionnée.'); return }
    if (locked) { setErr('🔒 Journée verrouillée (plus d\'un mois).'); return }
    const lines = sales.filter(s => N(s.quantite) > 0)
    setBusy(true); setErr(''); setMsg('')
    try {
      const { error } = await supabase.from('daily_reports').upsert(
        { station_id: stationId, report_date: date, superette_espece: salesTotal, created_by: session.user.id },
        { onConflict: 'station_id,report_date' })
      if (error) throw error
      // Remplace les lignes du jour (idempotent → la vendeuse peut re-saisir/corriger)
      await supabase.from('superette_sales').delete().eq('station_id', stationId).eq('report_date', date)
      if (lines.length) {
        const { error: si } = await supabase.from('superette_sales').insert(lines.map(s => ({
          station_id: stationId, report_date: date, product_id: s.product_id, nom: s.nom,
          quantite: N(s.quantite), prix_vente: N(s.prix_vente), montant: lineMontant(s), created_by: session.user.id,
        })))
        if (si) throw si
      }
      await supabase.from('submissions').insert({ report_date: date, station_id: stationId, moment: 'superette', created_by: session.user.id })
      setMsg('✅ Ventes supérette enregistrées')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) { setErr(e.message || String(e)) } finally { setBusy(false) }
  }

  // ===== VENDEUSE : accès à la Saisie du jour, UNIQUEMENT la partie supérette =====
  if (isVendeuse) return (
    <div>
      <div className="card">
        <label>📅 Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} max={today()} />
      </div>
      {err && <div className="err">{err}</div>}
      {msg && <div className="ok">{msg}</div>}
      {locked && <div className="err">🔒 Journée verrouillée (plus d'un mois). Seul l'administrateur peut la corriger.</div>}
      <div className="card">
        <h2>🛒 Produits vendus — supérette</h2>
        <p className="hint">Choisis un produit dans la liste, mets la <b>quantité</b> et le <b>prix de vente</b>. Si un produit n'existe pas encore, ajoute-le : l'administrateur le validera ensuite.</p>

        {sales.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Produit</th><th className="num" style={{ width: 70 }}>Qté</th><th className="num" style={{ width: 100 }}>Prix (F)</th><th className="num" style={{ width: 90 }}>Total</th><th></th></tr></thead>
              <tbody>
                {sales.map((s, i) => (
                  <tr key={i}>
                    <td>{s.nom}</td>
                    <td><input type="text" inputMode="decimal" value={s.quantite} onChange={e => updLine(i, 'quantite', e.target.value)} style={{ width: 60, textAlign: 'right' }} /></td>
                    <td><input type="text" inputMode="decimal" value={s.prix_vente} onChange={e => updLine(i, 'prix_vente', e.target.value)} style={{ width: 90, textAlign: 'right' }} /></td>
                    <td className="num">{fcfa(lineMontant(s))}</td>
                    <td><button className="btn sec small" onClick={() => removeLine(i)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!sales.length && <p className="muted">Aucune vente saisie pour le moment.</p>}

        <div className="row" style={{ marginTop: 12, gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>Ajouter un produit de la liste</label>
            <select value={pick} onChange={e => setPick(e.target.value)}>
              <option value="">— choisir —</option>
              {prods.map(p => <option key={p.id} value={p.id}>{p.nom}{p.prix_vente != null ? ` (${fcfa(p.prix_vente)})` : ''}</option>)}
            </select>
          </div>
          <button className="btn small" onClick={addLineFromPick} disabled={!pick}>+ Ajouter</button>
        </div>

        <div style={{ marginTop: 10 }}>
          {!showNew
            ? <button className="btn sec small" onClick={() => setShowNew(true)}>➕ Produit absent de la liste</button>
            : (
              <div className="card" style={{ background: 'var(--bg-soft, #f7f7f9)', marginTop: 4 }}>
                <label>Nouveau produit (à valider par l'admin)</label>
                <input value={newProd.nom} onChange={e => setNewProd({ ...newProd, nom: e.target.value })} placeholder="ex : Eau 1,5L" />
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <div style={{ flex: 1 }}><label>Prix d'achat (F)</label><input type="text" inputMode="decimal" value={newProd.prix_achat} onChange={e => setNewProd({ ...newProd, prix_achat: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label>Prix de vente (F)</label><input type="text" inputMode="decimal" value={newProd.prix_vente} onChange={e => setNewProd({ ...newProd, prix_vente: e.target.value })} /></div>
                </div>
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <button className="btn small" onClick={addNewProduct}>Ajouter & vendre</button>
                  <button className="btn sec small" onClick={() => { setShowNew(false); setNewProd({ nom: '', prix_achat: '', prix_vente: '' }) }}>Annuler</button>
                </div>
              </div>
            )}
        </div>
      </div>

      <div className="card" style={{ position: 'sticky', bottom: 0, boxShadow: '0 -2px 12px rgba(0,0,0,.08)' }}>
        <div className="grid kpis"><Sum label="Recette supérette" v={salesTotal} strong /></div>
        <div style={{ height: 10 }} />
        <button className="btn big-save" onClick={saveVendeuse} disabled={busy || locked}>{busy ? 'Enregistrement…' : locked ? '🔒 Verrouillé' : '✅ Envoyer'}</button>
      </div>
    </div>
  )

  return (
    <div>
      {/* ---- En-tête : date + moment ---- */}
      <div className="card">
        <label>📅 Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} max={today()} />
        <p className="hint" style={{ marginTop: 8 }}>Choisis le moment de l'envoi. On ne te montre que ce qu'il faut remplir.</p>
        <div className="moment-tiles">
          <Tile emo="🌅" t="Matin (8h)" d="Stock + ouverture" active={moment === 'matin'} onClick={() => setMoment('matin')} />
          <Tile emo="🕓" t="16 h" d="Ventes & compteurs" active={moment === 'apres-midi'} onClick={() => setMoment('apres-midi')} />
          <Tile emo="🌙" t="Soir" d="Clôture & versement" active={moment === 'soir'} onClick={() => setMoment('soir')} />
        </div>
        <label className="toggle-all">
          <input type="checkbox" style={{ width: 18 }} checked={showAll} onChange={e => setShowAll(e.target.checked)} /> Tout afficher (avancé)
        </label>
      </div>

      {err && <div className="err">{err}</div>}
      {msg && <div className="ok">{msg}</div>}
      {locked && <div className="err">🔒 Journée verrouillée (plus d'un mois). Lecture seule — seul l'administrateur peut la corriger.</div>}
      {isPompiste && <div className="ok">👷 Mode pompiste : tu saisis les compteurs, le stock et les photos. Les ventes et versements sont gérés par le gérant.</div>}

      {/* ---- PHOTOS DU JOUR (vue seule, pour vérification admin) ---- */}
      {attachments.length > 0 && (
        <div className="card">
          <div className="step-head"><div className="step-num">📷</div><h2>Photos du jour</h2></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {attachments.map(a => (
              <div key={a.id} style={{ textAlign: 'center' }}>
                <a href={photoUrl(a.photo_path)} target="_blank" rel="noreferrer">
                  <img src={photoUrl(a.photo_path)} alt="" style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} /></a>
                <div className="pill" style={{ marginTop: 4 }}>{a.categorie}</div>
                {a.note && <div className="muted" style={{ fontSize: 10.5, maxWidth: 92 }}>{a.note}</div>}
                <div><button className="btn sec small" style={{ marginTop: 4 }} onClick={() => delAttachment(a)}>Suppr.</button></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- MATIN : STOCK ---- */}
      {show('matin') && (
        <div className="card">
          <Step n="1" title="🌅 Stock du matin" />
          <p className="hint">Combien reste-t-il en cuve et en boutiques ce matin ?</p>
          <div className="row">
            <div><label>Essence en cuve (litres)</label><input type="text" inputMode="decimal" value={f.ess_stock} onChange={e => set('ess_stock', e.target.value)} /></div>
            <div><label>Gasoil en cuve (litres)</label><input type="text" inputMode="decimal" value={f.gas_stock} onChange={e => set('gas_stock', e.target.value)} /></div>
          </div>
          <fieldset className="fieldset"><legend>🔢 Relevés compteurs à l'ouverture</legend>
            <p className="hint" style={{ marginTop: 0 }}>Index de chaque pompe ce matin, avec sa photo (preuve). Sert à vérifier les ventes de la veille.</p>
            <div className="row">{meterField('e1_m', 'Essence 1')}{meterField('e2_m', 'Essence 2')}</div>
            <div className="row">{meterField('e3_m', 'Essence 3')}{meterField('e4_m', 'Essence 4')}</div>
            <div className="row">{meterField('g1_m', 'Gasoil 1')}{meterField('g2_m', 'Gasoil 2')}</div>
            <div className="row">{meterField('g3_m', 'Gasoil 3')}{meterField('g4_m', 'Gasoil 4')}</div>
            {prevMorning && <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Repère — index du matin du {frDate(prevMorning.date)} : essence <b>{Math.round(prevMorning.ess).toLocaleString('fr-FR')}</b>, gasoil <b>{Math.round(prevMorning.gas).toLocaleString('fr-FR')}</b>. Le nouvel index doit être supérieur.</p>}
            {meterWarn && (
              <div className="err" style={{ marginTop: 8 }}>
                ⚠️ {meterWarn}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <input type="checkbox" checked={forceMeter} onChange={e => { setForceMeter(e.target.checked); if (e.target.checked) { setMeterWarn(''); setErr('') } }} />
                  Forcer l'envoi (l'index est correct malgré tout)
                </label>
              </div>
            )}
          </fieldset>
          <fieldset className="fieldset"><legend>🔥 Bouteilles de gaz en stock</legend>
            {GAZ.map(([k, lab]) => (
              <div key={k} style={{ marginBottom: 8 }}><label>{lab}</label>
                <Stepper value={f['gaz_stock_' + k]} onChange={v => set('gaz_stock_' + k, v)} /></div>
            ))}
          </fieldset>
          <fieldset className="fieldset"><legend>🛢️ Lubrifiants en stock</legend>
            <div className="lub-grid">
              {lubTypes.map(t => (
                <div className="lub-row" key={t}>
                  <span className="name">{t}</span>
                  <input type="text" inputMode="numeric" value={lub[t] ?? ''} placeholder="0"
                    onChange={e => setLub(p => ({ ...p, [t]: e.target.value === '' ? undefined : Number(e.target.value) }))} />
                </div>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {/* ---- 16h : VENTES + COMPTEURS ---- */}
      {show('apres-midi') && (<>
        {!isPompiste && <div className="card">
          <Step n="2" title="⛽ Ventes carburant (de la veille)" />
          <p className="hint">Ce sont les ventes du jour écoulé. Saisis les litres et sépare Bon / Espèces (l'admin vérifie ensuite avec les compteurs).</p>
          <fieldset className="fieldset"><legend>Essence — {settings.essence_pv} F/L</legend>
            <div className="row-3">
              <div><label>Litres</label><input type="text" inputMode="decimal" value={f.ess_litres} onChange={e => set('ess_litres', e.target.value)} /></div>
              <div><label>Prix / L</label><input type="text" inputMode="decimal" value={f.ess_pu} onChange={e => set('ess_pu', e.target.value)} /></div>
              <div><label>Vente à bon</label><input type="text" inputMode="decimal" value={f.ess_bon} onChange={e => set('ess_bon', e.target.value)} /></div>
            </div>
            <label>Vente en espèces</label><input type="text" inputMode="decimal" value={f.ess_espece} onChange={e => set('ess_espece', e.target.value)} />
          </fieldset>
          <fieldset className="fieldset"><legend>Gasoil — {settings.gasoil_pv} F/L</legend>
            <div className="row-3">
              <div><label>Litres</label><input type="text" inputMode="decimal" value={f.gas_litres} onChange={e => set('gas_litres', e.target.value)} /></div>
              <div><label>Prix / L</label><input type="text" inputMode="decimal" value={f.gas_pu} onChange={e => set('gas_pu', e.target.value)} /></div>
              <div><label>Vente à bon</label><input type="text" inputMode="decimal" value={f.gas_bon} onChange={e => set('gas_bon', e.target.value)} /></div>
            </div>
            <label>Vente en espèces</label><input type="text" inputMode="decimal" value={f.gas_espece} onChange={e => set('gas_espece', e.target.value)} />
          </fieldset>
          <div className="ok">Marge carburant estimée : <b>{fcfa(marge)}</b> ({settings.marge_unitaire} F/L)</div>
        </div>}

        <div className="card">
          <Step n="3" title="🔢 Relevés 16 h — obligatoire" />
          <p className="hint">Index de chaque pompe à 16 h, avec sa photo (preuve). Ce relevé est <b>obligatoire</b>.</p>
          <fieldset className="fieldset"><legend>Essence</legend>
            <div className="row">{meterField('e1', 'Pompe E1')}{meterField('e2', 'Pompe E2')}</div>
            <div className="row">{meterField('e3', 'Pompe E3')}{meterField('e4', 'Pompe E4')}</div>
          </fieldset>
          <fieldset className="fieldset"><legend>Gasoil</legend>
            <div className="row">{meterField('g1', 'Pompe G1')}{meterField('g2', 'Pompe G2')}</div>
            <div className="row">{meterField('g3', 'Pompe G3')}{meterField('g4', 'Pompe G4')}</div>
          </fieldset>
        </div>

        {!isPompiste && <div className="card">
          <Step n="4" title="🔥 Gaz & autres ventes" />
          <p className="hint">Bouteilles vendues aujourd'hui, et recettes en espèces des autres pôles.</p>
          <fieldset className="fieldset"><legend>Bouteilles de gaz vendues</legend>
            {GAZ.map(([k, lab]) => (
              <div key={k} style={{ marginBottom: 8 }}><label>{lab}</label>
                <Stepper value={f['gaz_vendu_' + k]} onChange={v => set('gaz_vendu_' + k, v)} /></div>
            ))}
          </fieldset>
          <div className="row-3">
            <div><label>Espèces gaz</label><input type="text" inputMode="decimal" value={f.gaz_espece} onChange={e => set('gaz_espece', e.target.value)} /></div>
            <div><label>Espèces supérette</label><input type="text" inputMode="decimal" value={f.superette_espece} onChange={e => set('superette_espece', e.target.value)} /></div>
            <div><label>Espèces lubrifiant</label><input type="text" inputMode="decimal" value={f.lubrifiant_espece} onChange={e => set('lubrifiant_espece', e.target.value)} /></div>
          </div>
          <label>Total des bons en cours (cumul)</label><input type="text" inputMode="decimal" value={f.total_bon_cumul} onChange={e => set('total_bon_cumul', e.target.value)} />
        </div>}
      </>)}

      {/* ---- RÉCEPTION COMMANDES : affichage PARTAGÉ avec « Commandes », à tout moment ---- */}
      {!isPompiste && !isVendeuse && <OrderReception stationId={stationId} date={date} settings={settings} onDone={() => load(date)} />}

      {/* ---- SOIR : ACHATS / DÉPENSES / VERSEMENTS ---- */}
      {show('soir') && !isPompiste && (<>
        <div className="card">
          <Step n="6" title="🛒 Achats hors carburant" />
          <p className="hint">Gaz, lubrifiant, supérette, autre — avec fournisseur. (Le carburant se réceptionne via les commandes ci-dessus.)</p>
          {deliveries.map((d, i) => (
            <fieldset className="fieldset" key={i}>
              <div className="row">
                <div><label>Type</label>
                  <select value={d.type || 'gaz'} onChange={e => upd(setDeliveries, i, 'type', e.target.value)}>
                    <option value="gaz">Gaz</option><option value="lubrifiant">Lubrifiant</option>
                    <option value="superette">Supérette</option><option value="autre">Autre</option></select></div>
                <div><label>Quantité</label><input type="text" inputMode="decimal" value={d.quantite || ''} onChange={e => upd(setDeliveries, i, 'quantite', e.target.value)} /></div>
              </div>
              <div className="row">
                <div><label>Unité</label><select value={d.unite || 'litres'} onChange={e => upd(setDeliveries, i, 'unite', e.target.value)}>
                  <option>litres</option><option>bouteilles</option><option>cartons</option><option>unité</option></select></div>
                <div><label>Coût total</label><input type="text" inputMode="decimal" value={d.montant || ''} onChange={e => upd(setDeliveries, i, 'montant', e.target.value)} /></div>
              </div>
              <label>Fournisseur {(d.type === 'essence' || d.type === 'gasoil') ? '(carburant : fournisseur unique)' : ''}</label>
              {suppliers.length > 0
                ? <select value={d.supplier_id || ''} onChange={e => upd(setDeliveries, i, 'supplier_id', e.target.value)}>
                    <option value="">— choisir —</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.nom} ({s.categorie})</option>)}</select>
                : <input value={d.fournisseur || ''} onChange={e => upd(setDeliveries, i, 'fournisseur', e.target.value)} placeholder="nom du fournisseur" />}
              <button className="btn sec small" style={{ marginTop: 8 }} onClick={() => rm(setDeliveries, i)}>Retirer</button>
            </fieldset>
          ))}
          <button className="addbtn" onClick={() => setDeliveries(p => [...p, { type: 'gaz', unite: 'bouteilles' }])}>+ Ajouter un achat</button>
        </div>

        <div className="card">
          <Step n="7" title="💸 Dépenses en espèces" />
          <p className="hint">Argent sorti de la caisse (électricité SBEE, achats…). Coche « justificatif » si tu as le reçu.</p>
          {expenses.map((e, i) => (
            <fieldset className="fieldset" key={i}>
              <div className="row">
                <div><label>Type</label><select value={e.categorie || 'SBEE'} onChange={ev => upd(setExpenses, i, 'categorie', ev.target.value)}>
                  <option value="SBEE">SBEE</option><option value="SUPERETTE">SUPERETTE</option><option value="CARBURANT">Carburant / déplacement (propriétaire)</option><option value="AUTRE">AUTRE</option></select></div>
                <div><label>Montant</label><input type="text" inputMode="decimal" value={e.montant || ''} onChange={ev => upd(setExpenses, i, 'montant', ev.target.value)} /></div>
              </div>
              <label>Motif</label><input value={e.motif || ''} onChange={ev => upd(setExpenses, i, 'motif', ev.target.value)} placeholder="ex : recharge électricité" />
              {(e.categorie || '').toUpperCase() === 'CARBURANT' ? (
                <p className="hint" style={{ marginTop: 6 }}>🚗 Prélèvement carburant du propriétaire : <b>charge non-cash</b> (aucun paiement en espèces). Pas de reçu requis ; remonte chaque mois au Point financier sous « Carburant / déplacement (auto) » et n'est pas décompté du cash à verser.</p>
              ) : (<>
                <label>📷 Photo du justificatif (obligatoire)</label>
                <input type="file" accept="image/*" capture="environment" onChange={ev => upd(setExpenses, i, '_file', ev.target.files[0])} />
                {e.photo_path && !e._file && <p className="muted" style={{ fontSize: 12 }}>Justificatif enregistré ✓</p>}
                {e._file && <p className="muted" style={{ fontSize: 12 }}>✓ {e._file.name}</p>}
              </>)}
              <button className="btn sec small" style={{ marginTop: 8 }} onClick={() => rm(setExpenses, i)}>Retirer</button>
            </fieldset>
          ))}
          <button className="addbtn" onClick={() => setExpenses(p => [...p, { categorie: 'SBEE', montant: '' }])}>+ Ajouter une dépense</button>
        </div>

        <div className="card">
          <Step n="8" title="🏦 Versement en banque" />
          <p className="hint">Prends la photo du bordereau juste après le dépôt. Un versement peut couvrir <b>plusieurs jours de recette</b> : indique la <b>période concernée</b> (du… au…). Le système additionnera les recettes de cette période pour vérifier que ça correspond.</p>
          {deposits.map((d, i) => (
            <fieldset className="fieldset" key={i}>
              <div className="row">
                <div><label>Source (pôle) *</label><select value={d.pole || 'carburant'} onChange={ev => upd(setDeposits, i, 'pole', ev.target.value)}>
                  <option value="carburant">Carburant</option><option value="gaz_lubrifiant">Gaz + Lubrifiant</option><option value="gaz">Gaz seul</option><option value="lubrifiant">Lubrifiant seul</option><option value="superette">Supérette</option></select></div>
                <div><label>Montant versé *</label><input type="text" inputMode="decimal" value={d.montant || ''} onChange={ev => upd(setDeposits, i, 'montant', ev.target.value)} /></div>
              </div>
              <div className="row">
                <div><label>📅 Période concernée — du *</label>
                  <input type="date" max={date} value={d.periode_debut || ''} onChange={ev => upd(setDeposits, i, 'periode_debut', ev.target.value)} /></div>
                <div><label>… au *</label>
                  <input type="date" max={date} value={d.periode_fin || ''} onChange={ev => upd(setDeposits, i, 'periode_fin', ev.target.value)} /></div>
              </div>
              {d.periode_debut && d.periode_fin && d.periode_debut !== d.periode_fin &&
                <p className="muted" style={{ fontSize: 12 }}>↩︎ Versement cumulé sur {frDate(d.periode_debut)} → {frDate(d.periode_fin)}</p>}
              <label>📷 Photo du bordereau *</label>
              <input type="file" accept="image/*" capture="environment" onChange={ev => upd(setDeposits, i, '_file', ev.target.files[0])} />
              {d.photo_path && !d._file && <p className="muted" style={{ fontSize: 12 }}>Photo déjà enregistrée ✓</p>}
              <button className="btn sec small" style={{ marginTop: 8 }} onClick={() => rm(setDeposits, i)}>Retirer</button>
            </fieldset>
          ))}
          <button className="addbtn" onClick={() => setDeposits(p => [...p, { pole: 'carburant', periode_debut: date, periode_fin: date }])}>+ Ajouter un versement</button>
        </div>
      </>)}

      {/* ---- RÉCAP + ENREGISTRER ---- */}
      <div className="card" style={{ position: 'sticky', bottom: 0, boxShadow: '0 -2px 12px rgba(0,0,0,.08)' }}>
        <div className="grid kpis">
          <Sum label="Recette espèces (jour)" v={cashDeclare} />
          <Sum label="Dépenses (jour)" v={totDepense} />
          <Sum label="À verser (jour)" v={aVerser} strong />
          <Sum label="Versé saisi ce jour" v={totVerse} />
        </div>
        <p className="hint" style={{ marginTop: 8 }}>ℹ️ Un versement peut couvrir plusieurs jours : l'écart réel (recette − versé) est calculé <b>par pôle et par période</b> côté administration, pas ici.</p>
        <div style={{ height: 10 }} />
        <button className="btn big-save" onClick={save} disabled={busy || locked}>{busy ? 'Enregistrement…' : locked ? '🔒 Verrouillé' : `✅ Envoyer (${momentLabel(moment)})`}</button>
      </div>
    </div>
  )

  function upd(setter, i, k, v) { setter(p => p.map((x, j) => j === i ? { ...x, [k]: v } : x)) }
  function rm(setter, i) { setter(p => p.filter((_, j) => j !== i)) }
}

function defaultMoment() { const h = new Date().getHours(); return h < 12 ? 'matin' : h < 18 ? 'apres-midi' : 'soir' }
function daysAgoIso(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
function momentLabel(m) { return m === 'matin' ? 'Matin' : m === 'apres-midi' ? '16 h' : m === 'soir' ? 'Soir' : m }

function Tile({ emo, t, d, active, onClick }) {
  return (<div className={'moment-tile' + (active ? ' active' : '')} onClick={onClick}>
    <div className="emo">{emo}</div><div className="t">{t}</div><div className="d">{d}</div></div>)
}
function Step({ n, title }) { return (<div className="step-head"><div className="step-num">{n}</div><h2>{title}</h2></div>) }
function Stepper({ value, onChange }) {
  const dec = () => onChange(String(Math.max(0, (Number(value) || 0) - 1)))
  const inc = () => onChange(String((Number(value) || 0) + 1))
  return (<div className="stepper">
    <button type="button" onClick={dec}>−</button>
    <input type="text" inputMode="numeric" value={value} placeholder="0" onChange={e => onChange(e.target.value)} />
    <button type="button" onClick={inc}>+</button></div>)
}
function Sum({ label, v, strong, danger }) {
  return (<div className="kpi"><div className="label">{label}</div>
    <div className="value" style={{ fontSize: 18, color: danger ? 'var(--danger)' : strong ? 'var(--primary)' : 'inherit' }}>{fcfa(v)}</div></div>)
}
