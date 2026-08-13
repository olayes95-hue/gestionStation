import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase, BORDEREAUX_BUCKET } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useStation } from '../lib/station.jsx'
import { fcfa, today, numFR, frDate } from '../lib/format'
import { compressImage } from '../lib/image'
import OrderReception from '../components/OrderReception.jsx'
import { Panel } from '../ds/octane/components/core/Panel.jsx'
import { Button } from '../ds/octane/components/core/Button.jsx'
import { Icon } from '../ds/octane/components/core/Icon.jsx'
import { Tag } from '../ds/octane/components/core/Tag.jsx'
import { Field } from '../ds/octane/components/forms/Field.jsx'
import { Input } from '../ds/octane/components/forms/Input.jsx'
import { Select } from '../ds/octane/components/forms/Select.jsx'
import { Checkbox } from '../ds/octane/components/forms/Checkbox.jsx'
import { NumericStepper } from '../ds/octane/components/forms/NumericStepper.jsx'
import { AlertBanner } from '../ds/octane/components/feedback/AlertBanner.jsx'
import { EvidenceThumb } from '../ds/octane/components/evidence/EvidenceThumb.jsx'
import { MetricTile } from '../ds/octane/components/data/MetricTile.jsx'

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
  const [moment, setMoment] = useState(['matin', 'apres-midi', 'soir'].includes(params.get('moment')) ? params.get('moment') : defaultMoment())
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
  const [openPhoto, setOpenPhoto] = useState({})         // {champCompteur: bool} — accordéon photo déplié
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
  const [errTarget, setErrTarget] = useState('top')
  const [submittedMoments, setSubmittedMoments] = useState(new Set())
  const [openAchats, setOpenAchats] = useState(null)     // null = auto (ouvert si déjà des lignes)
  const [openDepenses, setOpenDepenses] = useState(null)
  const [openVersements, setOpenVersements] = useState(null)
  const matinMetersRef = useRef(null)
  const apresmidiMetersRef = useRef(null)
  const expensesRef = useRef(null)
  const depositsRef = useRef(null)

  function fail(message, target = 'top', ref) {
    setErr(message); setErrTarget(target)
    if (target === 'expenses') setOpenDepenses(true)
    if (target === 'deposits') setOpenVersements(true)
    const el = ref?.current
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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
    setMsg(''); setErr(''); setErrTarget('top')
    // Les 7 requêtes du jour sont lancées EN PARALLÈLE (avant : en série ≈ 7× la latence réseau).
    const [r, ex, dep, dl, at, po, rt, sub] = await Promise.all([
      supabase.from('daily_reports').select('*').eq('report_date', d).eq('station_id', stationId).maybeSingle(),
      supabase.from('expenses').select('*').eq('report_date', d).eq('station_id', stationId),
      supabase.from('deposits').select('*').eq('report_date', d).eq('station_id', stationId),
      supabase.from('deliveries').select('*').eq('report_date', d).eq('station_id', stationId),
      supabase.from('attachments').select('*').eq('report_date', d).eq('station_id', stationId).order('id'),
      supabase.from('fuel_orders').select('*').eq('station_id', stationId).in('statut', ['validee', 'lancee', 'partielle']).order('created_at'),
      supabase.from('v_order_reception').select('*').eq('station_id', stationId),
      supabase.from('submissions').select('moment').eq('report_date', d).eq('station_id', stationId),
    ])
    setSubmittedMoments(new Set((sub.data || []).map(x => x.moment)))
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
    setOpenPhoto({})
  }

  // champ compteur avec photo-preuve par pompe — la partie photo est repliée par défaut
  // (accordéon) pour alléger la carte, et se déplie au clic pour attacher la photo.
  const meterField = (k, label) => {
    const hasPhoto = !!meterPhotos[k]?.file
    const open = !!openPhoto[k] || hasPhoto
    return (
      <Field label={label} key={k}>
        <Input type="text" inputMode="decimal" numeric value={f[k]} onChange={e => set(k, e.target.value)} />
        <div onClick={() => setOpenPhoto(p => ({ ...p, [k]: !open }))}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)', cursor: 'pointer' }}>
          <Icon name="camera" size={12} color={hasPhoto ? 'var(--state-ok)' : 'var(--text-muted)'} />
          <span style={{ font: '500 11px/1 var(--font-ui)', color: hasPhoto ? 'var(--state-ok)' : 'var(--text-muted)', flex: 1 }}>{hasPhoto ? 'Photo ✓' : 'Photo'}</span>
          <Icon name="chevron-down" size={11} color="var(--text-muted)" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
        </div>
        {open && (
          <Button type="button" size="sm" icon="camera" block
            style={{ marginTop: 'var(--sp-2)', ...(hasPhoto ? { color: 'var(--state-ok)', borderColor: 'var(--state-ok)' } : {}) }}
            onClick={() => document.getElementById(`meter-photo-${k}`)?.click()}>
            {hasPhoto ? 'Changer la photo' : 'Ajouter la photo'}
          </Button>
        )}
        <input id={`meter-photo-${k}`} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={e => setMeterPhotos(p => ({ ...p, [k]: e.target.files[0] ? { file: e.target.files[0], label } : undefined }))} />
      </Field>
    )
  }

  // regroupe une pompe essence + gasoil de la même machine (E1+G1 sur la machine 1, etc.)
  const meterMachine = (n, eKey, eLabel, gKey, gLabel) => (
    <div key={n} style={{ padding: 'var(--sp-4)', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-1)', border: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
        <Icon name="fuel" size={12} color="var(--text-muted)" />
        <span style={{ font: 'var(--fw-semibold) 10px/1 var(--font-ui)', textTransform: 'uppercase', letterSpacing: 'var(--ls-micro)', color: 'var(--text-muted)' }}>Machine {n}</span>
      </div>
      <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 110px', minWidth: 0 }}>{meterField(eKey, eLabel)}</div>
        <div style={{ flex: '1 1 110px', minWidth: 0 }}>{meterField(gKey, gLabel)}</div>
      </div>
    </div>
  )

  async function receptionOrder(o) {
    const r = recvOrder[o.id] || {}
    const recu = numFR(r.quantite_recue)
    if (!recu || recu <= 0) { setErr('Renseigne les litres effectivement reçus (> 0).'); return }
    if (r.cuve_avant === '' || r.cuve_apres === '' || r.cuve_avant == null || r.cuve_apres == null) { setErr('Renseigne cuve avant ET après pour la réception.'); return }
    if (!r._file) { setErr('Photo obligatoire pour valider la réception (bon de livraison / jauge).'); return }
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
    setMsg(complet ? 'Commande entièrement reçue — stock cuve mis à jour' : `Réception partielle enregistrée (${total.toLocaleString('fr-FR')} / ${N(o.quantite_commandee).toLocaleString('fr-FR')} L)`); load(date)
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
  const achatsOpen = openAchats ?? (deliveries.length > 0)
  const depensesOpen = openDepenses ?? (expenses.length > 0)
  const versementsOpen = openVersements ?? (deposits.length > 0)

  // Récap du footer adapté au moment actif : les KPI cash (à verser/versé) n'ont de sens
  // qu'une fois le Soir en cours de saisie ; Matin/16h ont leur propre repère pertinent.
  function footerKpis() {
    if (moment === 'matin' && !showAll) return (<>
      <MetricTile label="Essence en cuve" value={f.ess_stock !== '' ? Math.round(N(f.ess_stock)).toLocaleString('fr-FR') : '—'} unit={f.ess_stock !== '' ? 'L' : ''} />
      <MetricTile label="Gasoil en cuve" value={f.gas_stock !== '' ? Math.round(N(f.gas_stock)).toLocaleString('fr-FR') : '—'} unit={f.gas_stock !== '' ? 'L' : ''} />
      <MetricTile label="Bouteilles de gaz" value={GAZ.reduce((s, [k]) => s + N(f['gaz_stock_' + k]), 0)} unit="b." />
    </>)
    if (moment === 'apres-midi' && !showAll) return (<>
      <MetricTile label="Litres vendus" value={(N(f.ess_litres) + N(f.gas_litres)).toLocaleString('fr-FR')} unit="L" />
      <MetricTile label="Marge carburant estimée" value={fcfa(marge)} status="ok" />
    </>)
    return (<>
      <MetricTile label="Recette espèces (jour)" value={fcfa(cashDeclare)} />
      <MetricTile label="Dépenses (jour)" value={fcfa(totDepense)} />
      <MetricTile label="À verser (jour)" value={fcfa(aVerser)} status="accent" />
      <MetricTile label="Versé saisi ce jour" value={fcfa(totVerse)} />
    </>)
  }

  async function save() {
    if (!stationId) { fail('Aucune station sélectionnée.'); return }
    if (locked) { fail('Journée verrouillée : seul l\'administrateur peut modifier un jour de plus d\'un mois.'); return }
    // 16h obligatoire : les 8 relevés doivent être remplis pour l'envoi de 16h
    if (moment === 'apres-midi' && METERS_16H.some(k => f[k] === '' || f[k] === null || f[k] === undefined)) {
      fail('Relevés 16 h obligatoires : remplis les 8 index des pompes (E1–E4, G1–G4) avant d\'envoyer.', 'meters-16h', apresmidiMetersRef); return
    }
    // justificatifs obligatoires : photo pour chaque dépense EN ESPÈCES
    // (la catégorie CARBURANT = prélèvement carburant du propriétaire, non-cash → pas de reçu).
    if (expenses.some(e => N(e.montant) > 0 && (e.categorie || '').toUpperCase() !== 'CARBURANT' && !e.photo_path && !e._file)) {
      fail('Photo du justificatif obligatoire pour chaque dépense en espèces.', 'expenses', expensesRef); return
    }
    if (deposits.some(d => N(d.montant) > 0 && !d.photo_path && !d._file)) {
      fail('Photo du bordereau obligatoire pour chaque versement.', 'deposits', depositsRef); return
    }
    if (deposits.some(d => N(d.montant) > 0 && (!d.periode_debut || !d.periode_fin))) {
      fail('Indique la période concernée (du… au…) pour chaque versement.', 'deposits', depositsRef); return
    }
    if (deposits.some(d => N(d.montant) > 0 && d.periode_debut > d.periode_fin)) {
      fail('La date de début d\'un versement doit être avant sa date de fin.', 'deposits', depositsRef); return
    }
    // photo obligatoire pour chaque compteur saisi (du moment)
    const meterSets = []
    if (moment === 'matin' || showAll) meterSets.push(['e1_m', 'Essence 1'], ['e2_m', 'Essence 2'], ['e3_m', 'Essence 3'], ['e4_m', 'Essence 4'], ['g1_m', 'Gasoil 1'], ['g2_m', 'Gasoil 2'], ['g3_m', 'Gasoil 3'], ['g4_m', 'Gasoil 4'])
    if (moment === 'apres-midi' || showAll) meterSets.push(['e1', 'Pompe E1'], ['e2', 'Pompe E2'], ['e3', 'Pompe E3'], ['e4', 'Pompe E4'], ['g1', 'Pompe G1'], ['g2', 'Pompe G2'], ['g3', 'Pompe G3'], ['g4', 'Pompe G4'])
    const missM = meterSets.find(([k, label]) => f[k] !== '' && f[k] != null && !meterHasPhoto(k, label))
    if (missM) {
      const isMatinField = missM[0].endsWith('_m')
      setOpenPhoto(p => ({ ...p, [missM[0]]: true }))
      fail(`Photo obligatoire pour le compteur ${missM[1]}.`, isMatinField ? 'meters-matin' : 'meters-16h', isMatinField ? matinMetersRef : apresmidiMetersRef)
      return
    }
    // Garde-fou décalage compteur : l'index du matin doit être > au dernier jour saisi.
    if ((moment === 'matin' || showAll) && prevMorning && !forceMeter) {
      const essNow = N(f.e1_m) + N(f.e2_m) + N(f.e3_m) + N(f.e4_m)
      const gasNow = N(f.g1_m) + N(f.g2_m) + N(f.g3_m) + N(f.g4_m)
      const parts = []
      if (essNow > 0 && prevMorning.ess > 0 && essNow <= prevMorning.ess) parts.push(`essence ${Math.round(essNow)} ≤ ${Math.round(prevMorning.ess)}`)
      if (gasNow > 0 && prevMorning.gas > 0 && gasNow <= prevMorning.gas) parts.push(`gasoil ${Math.round(gasNow)} ≤ ${Math.round(prevMorning.gas)}`)
      if (parts.length) {
        setMeterWarn(`Index du matin ${parts.join(' et ')} — relevé du ${frDate(prevMorning.date)}. Un index de pompe ne peut que MONTER : sans ça, l'écart compteur sera décalé d'un jour.`)
        fail('Relevé compteur du matin incohérent — voir la section « Relevés compteurs à l\'ouverture » ci-dessus.', 'meters-matin', matinMetersRef)
        return
      }
    }
    setBusy(true); setErr(''); setErrTarget('top'); setMsg('')
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

      setMsg(`Enregistré ! (${momentLabel(moment)} — ${date})`)
      load(date)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) { fail(e.message || String(e)) } finally { setBusy(false) }
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
    if (locked) { setErr('Journée verrouillée (plus d\'un mois).'); return }
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
      setMsg('Ventes supérette enregistrées')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) { setErr(e.message || String(e)) } finally { setBusy(false) }
  }

  // ===== VENDEUSE : accès à la Saisie du jour, UNIQUEMENT la partie supérette =====
  if (isVendeuse) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      <Panel title="Date" bodyStyle={{ display: 'none' }} actions={<Input size="sm" type="date" value={date} onChange={e => setDate(e.target.value)} max={today()} />} />
      {err && <AlertBanner tone="alarm" title="Erreur">{err}</AlertBanner>}
      {msg && <AlertBanner tone="ok" title="Succès">{msg}</AlertBanner>}
      {locked && <AlertBanner tone="alarm" title="Verrouillé">Journée verrouillée (plus d'un mois). Seul l'administrateur peut la corriger.</AlertBanner>}
      <Panel title="Produits vendus — supérette">
        <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 0 }}>
          Choisis un produit dans la liste, mets la <b>quantité</b> et le <b>prix de vente</b>. Si un produit n'existe pas encore, ajoute-le : l'administrateur le validera ensuite.
        </p>

        {sales.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
            {sales.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', padding: 'var(--sp-3)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-1)', border: '1px solid var(--border-hairline)' }}>
                <span style={{ flex: 1, font: '400 13px/1.3 var(--font-ui)', color: 'var(--text-body)' }}>{s.nom}</span>
                <Input size="sm" type="text" inputMode="decimal" numeric value={s.quantite} onChange={e => updLine(i, 'quantite', e.target.value)} style={{ width: 70 }} />
                <Input size="sm" type="text" inputMode="decimal" numeric value={s.prix_vente} onChange={e => updLine(i, 'prix_vente', e.target.value)} style={{ width: 100 }} />
                <span style={{ width: 90, textAlign: 'right', font: '500 13px/1 var(--font-data)' }}>{fcfa(lineMontant(s))}</span>
                <Button size="sm" tone="danger" onClick={() => removeLine(i)}>✕</Button>
              </div>
            ))}
          </div>
        )}
        {!sales.length && <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)' }}>Aucune vente saisie pour le moment.</p>}

        <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'end', flexWrap: 'wrap' }}>
          <Field label="Ajouter un produit de la liste" style={{ flex: '1 1 200px' }}>
            <Select value={pick} onChange={e => setPick(e.target.value)} style={{ width: '100%' }}
              options={[{ value: '', label: '— choisir —' }, ...prods.map(p => ({ value: p.id, label: `${p.nom}${p.prix_vente != null ? ` (${fcfa(p.prix_vente)})` : ''}` }))]} />
          </Field>
          <Button tone="primary" onClick={addLineFromPick} disabled={!pick}>+ Ajouter</Button>
        </div>

        <div style={{ marginTop: 'var(--sp-4)' }}>
          {!showNew
            ? <Button onClick={() => setShowNew(true)}>+ Produit absent de la liste</Button>
            : (
              <div style={{ padding: 'var(--sp-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-1)', border: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                <Field label="Nouveau produit (à valider par l'admin)">
                  <Input value={newProd.nom} onChange={e => setNewProd({ ...newProd, nom: e.target.value })} placeholder="ex : Eau 1,5L" />
                </Field>
                <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                  <Field label="Prix d'achat (F)" style={{ flex: 1 }}><Input type="text" inputMode="decimal" numeric value={newProd.prix_achat} onChange={e => setNewProd({ ...newProd, prix_achat: e.target.value })} /></Field>
                  <Field label="Prix de vente (F)" style={{ flex: 1 }}><Input type="text" inputMode="decimal" numeric value={newProd.prix_vente} onChange={e => setNewProd({ ...newProd, prix_vente: e.target.value })} /></Field>
                </div>
                <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                  <Button tone="primary" onClick={addNewProduct}>Ajouter &amp; vendre</Button>
                  <Button onClick={() => { setShowNew(false); setNewProd({ nom: '', prix_achat: '', prix_vente: '' }) }}>Annuler</Button>
                </div>
              </div>
            )}
        </div>
      </Panel>

      <div style={{ position: 'sticky', bottom: 0, background: 'var(--surface-panel)', border: 'var(--border-panel)', borderRadius: 'var(--radius-1)', padding: 'var(--gutter-panel)', boxShadow: '0 -4px 16px rgba(0,0,0,.12)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <MetricTile label="Recette supérette" value={fcfa(salesTotal)} />
        <Button tone="primary" block onClick={saveVendeuse} disabled={busy || locked}>{busy ? 'Enregistrement…' : locked ? 'Verrouillé' : 'Envoyer'}</Button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      {/* ---- En-tête : date + moment ---- */}
      <Panel>
        <Field label="Date"><Input type="date" value={date} onChange={e => setDate(e.target.value)} max={today()} style={{ maxWidth: 200 }} /></Field>
        <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 'var(--sp-4) 0' }}>Choisis le moment de l'envoi. On ne te montre que ce qu'il faut remplir.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)' }}>
          <MomentTile icon="calendar-days" t="Matin (8h)" d="Stock + ouverture" active={moment === 'matin'} done={submittedMoments.has('matin')} onClick={() => setMoment('matin')} />
          <MomentTile icon="clock" t="16 h" d="Ventes &amp; compteurs" active={moment === 'apres-midi'} done={submittedMoments.has('apres-midi')} onClick={() => setMoment('apres-midi')} />
          <MomentTile icon="moon" t="Soir" d="Clôture &amp; versement" active={moment === 'soir'} done={submittedMoments.has('soir')} onClick={() => setMoment('soir')} />
        </div>
        <Checkbox label="Tout afficher (avancé)" checked={showAll} onChange={v => setShowAll(v)} style={{ marginTop: 'var(--sp-4)' }} />
      </Panel>

      {err && errTarget === 'top' && <AlertBanner tone="alarm" title="Erreur">{err}</AlertBanner>}
      {msg && <AlertBanner tone="ok" title="Succès">{msg}</AlertBanner>}
      {locked && <AlertBanner tone="alarm" title="Verrouillé">Journée verrouillée (plus d'un mois). Lecture seule — seul l'administrateur peut la corriger.</AlertBanner>}
      {isPompiste && <AlertBanner tone="info" title="Mode pompiste">Tu saisis les compteurs, le stock et les photos. Les ventes et versements sont gérés par le gérant.</AlertBanner>}

      {/* ---- PHOTOS DU JOUR (vue seule, pour vérification admin) ---- */}
      {attachments.length > 0 && (
        <Panel title="Photos du jour">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
            {attachments.map(a => (
              <EvidenceThumb key={a.id} src={photoUrl(a.photo_path)} label={a.categorie} timestamp={a.note} status="none" size={92}
                onClick={() => window.open(photoUrl(a.photo_path), '_blank')} onRemove={() => delAttachment(a)} />
            ))}
          </div>
        </Panel>
      )}

      {/* ---- MATIN : STOCK ---- */}
      {show('matin') && (
        <Panel>
          <StepHead n="1" title="Stock du matin" />
          <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)' }}>Combien reste-t-il en cuve et en boutiques ce matin ?</p>
          <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
            <Field label="Essence en cuve (litres)" style={{ flex: '1 1 180px' }}><Input type="text" inputMode="decimal" numeric value={f.ess_stock} onChange={e => set('ess_stock', e.target.value)} /></Field>
            <Field label="Gasoil en cuve (litres)" style={{ flex: '1 1 180px' }}><Input type="text" inputMode="decimal" numeric value={f.gas_stock} onChange={e => set('gas_stock', e.target.value)} /></Field>
          </div>
          <FormSection title="Relevés compteurs à l'ouverture" style={{ marginTop: 'var(--sp-4)' }} innerRef={matinMetersRef}>
            <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 0 }}>Index de chaque pompe ce matin, avec sa photo (preuve). Sert à vérifier les ventes de la veille.</p>
            {err && errTarget === 'meters-matin' && !meterWarn && <AlertBanner tone="alarm" title="Erreur" style={{ marginBottom: 'var(--sp-3)' }}>{err}</AlertBanner>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--sp-3)' }}>
              {[1, 2, 3, 4].map(n => meterMachine(n, `e${n}_m`, `Essence ${n}`, `g${n}_m`, `Gasoil ${n}`))}
            </div>
            {prevMorning && <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 'var(--sp-3)' }}>Repère — index du matin du {frDate(prevMorning.date)} : essence <b>{Math.round(prevMorning.ess).toLocaleString('fr-FR')}</b>, gasoil <b>{Math.round(prevMorning.gas).toLocaleString('fr-FR')}</b>. Le nouvel index doit être supérieur.</p>}
            {meterWarn && (
              <AlertBanner tone="alarm" title="Index incohérent" style={{ marginTop: 'var(--sp-3)' }}>
                {meterWarn}
                <Checkbox label="Forcer l'envoi (l'index est correct malgré tout)" checked={forceMeter} onChange={v => { setForceMeter(v); if (v) { setMeterWarn(''); setErr('') } }} style={{ marginTop: 'var(--sp-3)' }} />
              </AlertBanner>
            )}
          </FormSection>
          <FormSection title="Bouteilles de gaz en stock" style={{ marginTop: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {GAZ.map(([k, lab]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
                  <span style={{ flex: 1, font: '400 13px/1 var(--font-ui)', color: 'var(--text-body)' }}>{lab}</span>
                  <NumericStepper value={Number(f['gaz_stock_' + k]) || 0} onChange={v => set('gaz_stock_' + k, String(v))} suffix="b." />
                </div>
              ))}
            </div>
          </FormSection>
          <FormSection title="Lubrifiants en stock" style={{ marginTop: 'var(--sp-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--sp-3)' }}>
              {lubTypes.map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                  <span style={{ flex: 1, font: '400 12px/1.2 var(--font-ui)', color: 'var(--text-body)' }}>{t}</span>
                  <Input size="sm" type="text" inputMode="numeric" numeric value={lub[t] ?? ''} placeholder="0" style={{ width: 70 }}
                    onChange={e => setLub(p => ({ ...p, [t]: e.target.value === '' ? undefined : Number(e.target.value) }))} />
                </div>
              ))}
            </div>
          </FormSection>
        </Panel>
      )}

      {/* ---- 16h : VENTES + COMPTEURS ---- */}
      {show('apres-midi') && (<>
        {!isPompiste && <Panel>
          <StepHead n="2" title="Ventes carburant (de la veille)" />
          <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)' }}>Ce sont les ventes du jour écoulé. Saisis les litres et sépare Bon / Espèces (l'admin vérifie ensuite avec les compteurs).</p>
          <FormSection title={`Essence — ${settings.essence_pv} F/L`}>
            <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
              <Field label="Litres" style={{ flex: '1 1 140px' }}><Input type="text" inputMode="decimal" numeric value={f.ess_litres} onChange={e => set('ess_litres', e.target.value)} /></Field>
              <Field label="Prix / L" style={{ flex: '1 1 140px' }}><Input type="text" inputMode="decimal" numeric value={f.ess_pu} onChange={e => set('ess_pu', e.target.value)} /></Field>
              <Field label="Vente à bon" style={{ flex: '1 1 140px' }}><Input type="text" inputMode="decimal" numeric value={f.ess_bon} onChange={e => set('ess_bon', e.target.value)} /></Field>
            </div>
            <Field label="Vente en espèces" style={{ marginTop: 'var(--sp-3)' }}><Input type="text" inputMode="decimal" numeric value={f.ess_espece} onChange={e => set('ess_espece', e.target.value)} /></Field>
          </FormSection>
          <FormSection title={`Gasoil — ${settings.gasoil_pv} F/L`} style={{ marginTop: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
              <Field label="Litres" style={{ flex: '1 1 140px' }}><Input type="text" inputMode="decimal" numeric value={f.gas_litres} onChange={e => set('gas_litres', e.target.value)} /></Field>
              <Field label="Prix / L" style={{ flex: '1 1 140px' }}><Input type="text" inputMode="decimal" numeric value={f.gas_pu} onChange={e => set('gas_pu', e.target.value)} /></Field>
              <Field label="Vente à bon" style={{ flex: '1 1 140px' }}><Input type="text" inputMode="decimal" numeric value={f.gas_bon} onChange={e => set('gas_bon', e.target.value)} /></Field>
            </div>
            <Field label="Vente en espèces" style={{ marginTop: 'var(--sp-3)' }}><Input type="text" inputMode="decimal" numeric value={f.gas_espece} onChange={e => set('gas_espece', e.target.value)} /></Field>
          </FormSection>
          <AlertBanner tone="ok" title="Marge" style={{ marginTop: 'var(--sp-4)' }}>Marge carburant estimée : <b>{fcfa(marge)}</b> ({settings.marge_unitaire} F/L)</AlertBanner>
        </Panel>}

        <Panel sectionRef={apresmidiMetersRef}>
          <StepHead n="3" title="Relevés 16 h — obligatoire" />
          <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)' }}>Index de chaque pompe à 16 h, avec sa photo (preuve). Ce relevé est <b>obligatoire</b>.</p>
          {err && errTarget === 'meters-16h' && <AlertBanner tone="alarm" title="Erreur" style={{ marginBottom: 'var(--sp-4)' }}>{err}</AlertBanner>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--sp-3)' }}>
            {[1, 2, 3, 4].map(n => meterMachine(n, `e${n}`, `Pompe E${n}`, `g${n}`, `Pompe G${n}`))}
          </div>
        </Panel>

        {!isPompiste && <Panel>
          <StepHead n="4" title="Gaz &amp; autres ventes" />
          <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)' }}>Bouteilles vendues aujourd'hui, et recettes en espèces des autres pôles.</p>
          <FormSection title="Bouteilles de gaz vendues">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {GAZ.map(([k, lab]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
                  <span style={{ flex: 1, font: '400 13px/1 var(--font-ui)', color: 'var(--text-body)' }}>{lab}</span>
                  <NumericStepper value={Number(f['gaz_vendu_' + k]) || 0} onChange={v => set('gaz_vendu_' + k, String(v))} suffix="b." />
                </div>
              ))}
            </div>
          </FormSection>
          <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap', marginTop: 'var(--sp-4)' }}>
            <Field label="Espèces gaz" style={{ flex: '1 1 160px' }}><Input type="text" inputMode="decimal" numeric value={f.gaz_espece} onChange={e => set('gaz_espece', e.target.value)} /></Field>
            <Field label="Espèces supérette" style={{ flex: '1 1 160px' }}><Input type="text" inputMode="decimal" numeric value={f.superette_espece} onChange={e => set('superette_espece', e.target.value)} /></Field>
            <Field label="Espèces lubrifiant" style={{ flex: '1 1 160px' }}><Input type="text" inputMode="decimal" numeric value={f.lubrifiant_espece} onChange={e => set('lubrifiant_espece', e.target.value)} /></Field>
          </div>
          <Field label="Total des bons en cours (cumul)" style={{ marginTop: 'var(--sp-3)' }}><Input type="text" inputMode="decimal" numeric value={f.total_bon_cumul} onChange={e => set('total_bon_cumul', e.target.value)} /></Field>
        </Panel>}
      </>)}

      {/* ---- RÉCEPTION COMMANDES : affichage PARTAGÉ avec « Commandes », à tout moment ---- */}
      {!isPompiste && !isVendeuse && <OrderReception stationId={stationId} date={date} settings={settings} onDone={() => load(date)} />}

      {/* ---- SOIR : ACHATS / DÉPENSES / VERSEMENTS ---- */}
      {show('soir') && !isPompiste && (<>
        <Panel>
          <CollapsibleHead n="6" title="Achats hors carburant" open={achatsOpen} onToggle={() => setOpenAchats(!achatsOpen)} count={deliveries.length} total={totLivr} />
          {achatsOpen && <>
            <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)' }}>Gaz, lubrifiant, supérette, autre — avec fournisseur. (Le carburant se réceptionne via les commandes ci-dessus.)</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {deliveries.map((d, i) => (
                <div key={i} style={{ padding: 'var(--sp-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-1)', border: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                  <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                    <Field label="Type" style={{ flex: '1 1 160px' }}>
                      <Select value={d.type || 'gaz'} onChange={e => upd(setDeliveries, i, 'type', e.target.value)} style={{ width: '100%' }}
                        options={[{ value: 'gaz', label: 'Gaz' }, { value: 'lubrifiant', label: 'Lubrifiant' }, { value: 'superette', label: 'Supérette' }, { value: 'autre', label: 'Autre' }]} />
                    </Field>
                    <Field label="Quantité" style={{ flex: '1 1 140px' }}><Input type="text" inputMode="decimal" numeric value={d.quantite || ''} onChange={e => upd(setDeliveries, i, 'quantite', e.target.value)} /></Field>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                    <Field label="Unité" style={{ flex: '1 1 160px' }}>
                      <Select value={d.unite || 'litres'} onChange={e => upd(setDeliveries, i, 'unite', e.target.value)} style={{ width: '100%' }}
                        options={[{ value: 'litres', label: 'litres' }, { value: 'bouteilles', label: 'bouteilles' }, { value: 'cartons', label: 'cartons' }, { value: 'unité', label: 'unité' }]} />
                    </Field>
                    <Field label="Coût total" style={{ flex: '1 1 140px' }}><Input type="text" inputMode="decimal" numeric value={d.montant || ''} onChange={e => upd(setDeliveries, i, 'montant', e.target.value)} /></Field>
                  </div>
                  <Field label={`Fournisseur${(d.type === 'essence' || d.type === 'gasoil') ? ' (carburant : fournisseur unique)' : ''}`}>
                    {suppliers.length > 0
                      ? <Select value={d.supplier_id || ''} onChange={e => upd(setDeliveries, i, 'supplier_id', e.target.value)} style={{ width: '100%' }}
                          options={[{ value: '', label: '— choisir —' }, ...suppliers.map(s => ({ value: s.id, label: `${s.nom} (${s.categorie})` }))]} />
                      : <Input value={d.fournisseur || ''} onChange={e => upd(setDeliveries, i, 'fournisseur', e.target.value)} placeholder="nom du fournisseur" />}
                  </Field>
                  <Button size="sm" tone="danger" onClick={() => rm(setDeliveries, i)} style={{ alignSelf: 'flex-start' }}>Retirer</Button>
                </div>
              ))}
            </div>
            <Button onClick={() => setDeliveries(p => [...p, { type: 'gaz', unite: 'bouteilles' }])} style={{ marginTop: 'var(--sp-4)' }}>+ Ajouter un achat</Button>
          </>}
        </Panel>

        <Panel sectionRef={expensesRef}>
          <CollapsibleHead n="7" title="Dépenses en espèces" open={depensesOpen} onToggle={() => setOpenDepenses(!depensesOpen)} count={expenses.length} total={totDepense} />
          {depensesOpen && <>
            <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)' }}>Argent sorti de la caisse (électricité SBEE, achats…). Ajoute le justificatif si tu l'as.</p>
            {err && errTarget === 'expenses' && <AlertBanner tone="alarm" title="Erreur" style={{ marginBottom: 'var(--sp-4)' }}>{err}</AlertBanner>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {expenses.map((e, i) => (
                <div key={i} style={{ padding: 'var(--sp-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-1)', border: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                  <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                    <Field label="Type" style={{ flex: '1 1 200px' }}>
                      <Select value={e.categorie || 'SBEE'} onChange={ev => upd(setExpenses, i, 'categorie', ev.target.value)} style={{ width: '100%' }}
                        options={[{ value: 'SBEE', label: 'SBEE' }, { value: 'SUPERETTE', label: 'SUPERETTE' }, { value: 'CARBURANT', label: 'Carburant / déplacement (propriétaire)' }, { value: 'AUTRE', label: 'AUTRE' }]} />
                    </Field>
                    <Field label="Montant" style={{ flex: '1 1 140px' }}><Input type="text" inputMode="decimal" numeric value={e.montant || ''} onChange={ev => upd(setExpenses, i, 'montant', ev.target.value)} /></Field>
                  </div>
                  <Field label="Motif"><Input value={e.motif || ''} onChange={ev => upd(setExpenses, i, 'motif', ev.target.value)} placeholder="ex : recharge électricité" /></Field>
                  {(e.categorie || '').toUpperCase() === 'CARBURANT' ? (
                    <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>Prélèvement carburant du propriétaire : <b>charge non-cash</b> (aucun paiement en espèces). Pas de reçu requis ; remonte chaque mois au Point financier sous « Carburant / déplacement (auto) » et n'est pas décompté du cash à verser.</p>
                  ) : (<>
                    <Field label="Photo du justificatif (obligatoire)">
                      <Input type="file" accept="image/*" capture="environment" onChange={ev => upd(setExpenses, i, '_file', ev.target.files[0])} />
                    </Field>
                    {e.photo_path && !e._file && <p style={{ font: '400 12px/1 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>Justificatif enregistré ✓</p>}
                    {e._file && <p style={{ font: '400 12px/1 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>✓ {e._file.name}</p>}
                  </>)}
                  <Button size="sm" tone="danger" onClick={() => rm(setExpenses, i)} style={{ alignSelf: 'flex-start' }}>Retirer</Button>
                </div>
              ))}
            </div>
            <Button onClick={() => setExpenses(p => [...p, { categorie: 'SBEE', montant: '' }])} style={{ marginTop: 'var(--sp-4)' }}>+ Ajouter une dépense</Button>
          </>}
        </Panel>

        <Panel sectionRef={depositsRef}>
          <CollapsibleHead n="8" title="Versement en banque" open={versementsOpen} onToggle={() => setOpenVersements(!versementsOpen)} count={deposits.length} total={totVerse} />
          {versementsOpen && <>
            <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)' }}>Prends la photo du bordereau juste après le dépôt. Un versement peut couvrir <b>plusieurs jours de recette</b> : indique la <b>période concernée</b> (du… au…). Le système additionnera les recettes de cette période pour vérifier que ça correspond.</p>
            {err && errTarget === 'deposits' && <AlertBanner tone="alarm" title="Erreur" style={{ marginBottom: 'var(--sp-4)' }}>{err}</AlertBanner>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {deposits.map((d, i) => (
                <div key={i} style={{ padding: 'var(--sp-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-1)', border: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                  <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                    <Field label="Source (pôle) *" style={{ flex: '1 1 180px' }}>
                      <Select value={d.pole || 'carburant'} onChange={ev => upd(setDeposits, i, 'pole', ev.target.value)} style={{ width: '100%' }}
                        options={[{ value: 'carburant', label: 'Carburant' }, { value: 'gaz_lubrifiant', label: 'Gaz + Lubrifiant' }, { value: 'gaz', label: 'Gaz seul' }, { value: 'lubrifiant', label: 'Lubrifiant seul' }, { value: 'superette', label: 'Supérette' }]} />
                    </Field>
                    <Field label="Montant versé *" style={{ flex: '1 1 140px' }}><Input type="text" inputMode="decimal" numeric value={d.montant || ''} onChange={ev => upd(setDeposits, i, 'montant', ev.target.value)} /></Field>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                    <Field label="Période concernée — du *" style={{ flex: '1 1 160px' }}><Input type="date" max={date} value={d.periode_debut || ''} onChange={ev => upd(setDeposits, i, 'periode_debut', ev.target.value)} /></Field>
                    <Field label="… au *" style={{ flex: '1 1 160px' }}><Input type="date" max={date} value={d.periode_fin || ''} onChange={ev => upd(setDeposits, i, 'periode_fin', ev.target.value)} /></Field>
                  </div>
                  {d.periode_debut && d.periode_fin && d.periode_debut !== d.periode_fin &&
                    <p style={{ font: '400 12px/1 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>Versement cumulé sur {frDate(d.periode_debut)} → {frDate(d.periode_fin)}</p>}
                  <Field label="Photo du bordereau *">
                    <Input type="file" accept="image/*" capture="environment" onChange={ev => upd(setDeposits, i, '_file', ev.target.files[0])} />
                  </Field>
                  {d.photo_path && !d._file && <p style={{ font: '400 12px/1 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>Photo déjà enregistrée ✓</p>}
                  <Button size="sm" tone="danger" onClick={() => rm(setDeposits, i)} style={{ alignSelf: 'flex-start' }}>Retirer</Button>
                </div>
              ))}
            </div>
            <Button onClick={() => setDeposits(p => [...p, { pole: 'carburant', periode_debut: date, periode_fin: date }])} style={{ marginTop: 'var(--sp-4)' }}>+ Ajouter un versement</Button>
          </>}
        </Panel>
      </>)}

      {/* ---- RÉCAP + ENREGISTRER ---- */}
      <div style={{ position: 'sticky', bottom: 0, background: 'var(--surface-panel)', border: 'var(--border-panel)', borderRadius: 'var(--radius-1)', padding: 'var(--gutter-panel)', boxShadow: '0 -4px 16px rgba(0,0,0,.12)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--sp-4)' }}>
          {footerKpis()}
        </div>
        {(moment === 'soir' || showAll) && <p style={{ font: '400 11px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>Un versement peut couvrir plusieurs jours : l'écart réel (recette − versé) est calculé <b>par pôle et par période</b> côté administration, pas ici.</p>}
        <Button tone="primary" block onClick={save} disabled={busy || locked}>{busy ? 'Enregistrement…' : locked ? 'Verrouillé' : `Envoyer (${momentLabel(moment)})`}</Button>
      </div>
    </div>
  )

  function upd(setter, i, k, v) { setter(p => p.map((x, j) => j === i ? { ...x, [k]: v } : x)) }
  function rm(setter, i) { setter(p => p.filter((_, j) => j !== i)) }
}

function defaultMoment() { const h = new Date().getHours(); return h < 12 ? 'matin' : h < 18 ? 'apres-midi' : 'soir' }
function daysAgoIso(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
function momentLabel(m) { return m === 'matin' ? 'Matin' : m === 'apres-midi' ? '16 h' : m === 'soir' ? 'Soir' : m }

function MomentTile({ icon, t, d, active, done, onClick }) {
  return (
    <div onClick={onClick} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-4)', textAlign: 'center', cursor: 'pointer',
      background: active ? 'var(--accent-quiet)' : 'var(--surface-raised)', border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border-default)'), borderRadius: 'var(--radius-1)', transition: 'var(--t-control)' }}>
      {done && <span style={{ position: 'absolute', top: 'var(--sp-2)', right: 'var(--sp-2)', width: 16, height: 16, borderRadius: '50%', background: 'var(--state-ok)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="check" size={10} strokeWidth={3} />
      </span>}
      <Icon name={icon} size={18} color={active ? 'var(--accent)' : 'var(--text-muted)'} />
      <div style={{ font: 'var(--fw-semibold) 12px/1.2 var(--font-ui)', color: active ? 'var(--accent)' : 'var(--text-primary)' }}>{t}</div>
      <div style={{ font: '400 11px/1.2 var(--font-ui)', color: 'var(--text-muted)' }}>{d}</div>
    </div>
  )
}
function StepHead({ n, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-3)' }}>
      <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-quiet)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', font: 'var(--fw-semibold) 12px/1 var(--font-data)' }}>{n}</span>
      <h2 style={{ font: 'var(--fw-semibold) 14px/1.2 var(--font-ui)', color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
    </div>
  )
}
// en-tête cliquable pour replier/déplier une section — compact (compteur + total) quand fermée
function CollapsibleHead({ n, title, open, onToggle, count, total }) {
  return (
    <div onClick={onToggle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: open ? 'var(--sp-3)' : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
        <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-quiet)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', font: 'var(--fw-semibold) 12px/1 var(--font-data)' }}>{n}</span>
        <h2 style={{ font: 'var(--fw-semibold) 14px/1.2 var(--font-ui)', color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
        {count > 0 && <Tag>{count} · {fcfa(total)}</Tag>}
        <Icon name="chevron-down" size={14} color="var(--text-muted)" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </div>
    </div>
  )
}
function FormSection({ title, children, style, innerRef }) {
  return (
    <div ref={innerRef} style={{ padding: 'var(--sp-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-1)', border: '1px solid var(--border-hairline)', ...style }}>
      <div style={{ font: 'var(--fw-semibold) 11px/1 var(--font-ui)', textTransform: 'uppercase', letterSpacing: 'var(--ls-label)', color: 'var(--text-muted)', marginBottom: 'var(--sp-3)' }}>{title}</div>
      {children}
    </div>
  )
}
