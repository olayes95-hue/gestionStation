import { useEffect, useState } from 'react'
import { supabase, BORDEREAUX_BUCKET } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useStation } from '../lib/station.jsx'
import { fcfa, frDate, numFR, today } from '../lib/format'
import { ORDER_STATUS_TONES } from '../lib/tones'
import { N, receptionner as receptionnerCommande, cumulStatus, packagingSplit } from '../lib/orderReception'
import { Panel } from '../ds/octane/components/core/Panel.jsx'
import { Button } from '../ds/octane/components/core/Button.jsx'
import { Badge } from '../ds/octane/components/core/Badge.jsx'
import { Tag } from '../ds/octane/components/core/Tag.jsx'
import { Field } from '../ds/octane/components/forms/Field.jsx'
import { Input } from '../ds/octane/components/forms/Input.jsx'
import { Select } from '../ds/octane/components/forms/Select.jsx'
import { Checkbox } from '../ds/octane/components/forms/Checkbox.jsx'
import { AlertBanner } from '../ds/octane/components/feedback/AlertBanner.jsx'
import { Drawer, DrawerRow } from '../ds/octane/components/feedback/Drawer.jsx'
import { IconButton } from '../ds/octane/components/core/IconButton.jsx'
import { DataTable } from '../ds/octane/components/data/DataTable.jsx'
import { Pagination } from '../ds/octane/components/data/Pagination.jsx'
import { EvidenceUpload } from '../ds/octane/components/evidence/EvidenceUpload.jsx'
import { Kpi } from '../lib/Kpi.jsx'
const CATS = [['carburant', 'Carburant'], ['gaz', 'Gaz'], ['lubrifiant', 'Lubrifiant'], ['superette', 'Supérette']]
// Lignes carburant par défaut (essence + gasoil commandés simultanément).
const carbRows = () => [{ produit: 'essence', qte: '', bons: '', cheque: '', ref: '' }, { produit: 'gasoil', qte: '', bons: '', cheque: '', ref: '' }]
const blankNf = () => ({ categorie: 'carburant', mode_paiement: 'cheque', rows: carbRows(), lignes: [{ article: '', qte: '' }], montant_paiement: '', date_proposition: today(), note: '' })

export default function Orders() {
  const { session, isAdmin, isPompiste, can } = useAuth()
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
  const [fStatut, setFStatut] = useState('tous'); const [fCat, setFCat] = useState('tous')
  // Filtre par défaut : mois en cours (plus lisible qu'un historique complet non filtré).
  const now = new Date()
  const [year, setYear] = useState(String(now.getFullYear())); const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState('')
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('')
  const [matinWarn, setMatinWarn] = useState('')
  const [bonsRestant, setBonsRestant] = useState(0)
  const [openCombos, setOpenCombos] = useState(false)
  const [detailId, setDetailId] = useState(null)   // id de la commande ouverte dans le panneau de détail
  const [receptions, setReceptions] = useState([])   // historique des réceptions PARTIELLES de la commande ouverte
  const [editRecId, setEditRecId] = useState(null)   // id de la réception en cours de correction (admin)
  const [editRecForm, setEditRecForm] = useState({})
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(25)

  // Historique des réceptions (order_receptions) de la commande ouverte — jusqu'ici invisible dans
  // l'app une fois la commande soldée : seul le cumul (v_order_reception) et le dernier cuve_avant/
  // après (stampés sur fuel_orders) restaient consultables, les réceptions PARTIELLES individuelles
  // (dates, quantités, photos de chaque passage du camion) disparaissaient de la vue.
  useEffect(() => {
    if (!detailId) { setReceptions([]); return }
    supabase.from('order_receptions').select('*').eq('order_id', detailId).order('report_date')
      .then(({ data }) => setReceptions(data || []))
  }, [detailId])

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

  // Réception — logique partagée avec « Saisie du jour » (OrderReception.jsx) via lib/orderReception.js,
  // pour n'avoir qu'un seul endroit à maintenir pour le garde-fou d'écart et les écritures en base.
  async function receptionner(o) {
    const r = recv[o.id] || {}
    setErr(''); setMatinWarn('')
    try {
      const deja = N(recvTotals[o.id]?.quantite_recue_total)
      const result = await receptionnerCommande({ supabase, bucket: BORDEREAUX_BUCKET, stationId, session, order: o, recv: r, settings, deja })
      if (result.warnEcart) { setRecv(p => ({ ...p, [o.id]: { ...r, warnEcart: result.warnEcart } })); return }
      setRecv(p => ({ ...p, [o.id]: undefined }))
      flash(result.complet ? 'Commande soldée — stock mis à jour' : `Réception partielle (${result.total.toLocaleString('fr-FR')}/${N(o.quantite_commandee).toLocaleString('fr-FR')})`)
      if (result.matinManquant) setMatinWarn("Le relevé du matin de ce jour n'est pas encore saisi — fais-le dès que possible : sans ça, il risque de capter le niveau APRÈS cette livraison au lieu d'avant, et de fausser le contrôle anti-coulage.")
      load()
    } catch (e) { setErr(e.message || String(e)) }
  }
  async function delOrder(o) { await supabase.from('fuel_orders').delete().eq('id', o.id); load() }

  // Recalcule les champs stampés sur fuel_orders (statut, cuve_avant/après, montant, report_date)
  // à partir des réceptions restantes — nécessaire après une correction/suppression admin, sinon
  // ces champs (écrits une seule fois par receptionner(), cf. lib/orderReception.js) restent
  // périmés par rapport aux order_receptions réellement en base. Même seuil de "complet" que
  // receptionner() (marge = taux de perte acceptable), pour rester cohérent avec une saisie normale.
  async function resyncOrderFromReceptions(o) {
    const { data } = await supabase.from('order_receptions').select('*').eq('order_id', o.id).order('report_date')
    const list = data || []
    const cat = o.categorie || 'carburant'
    if (!list.length) {
      await supabase.from('fuel_orders').update({ statut: 'lancee', cuve_avant: null, cuve_apres: null, montant: null, report_date: null, recu_by: null, recu_at: null }).eq('id', o.id)
    } else {
      const total = list.reduce((s, r) => s + N(r.quantite_recue), 0)
      const marge = N(o.quantite_commandee) * (N(settings.taux_perte_acceptable) || 5) / 100
      const complet = total >= N(o.quantite_commandee) - marge
      const last = list[list.length - 1]
      const patch = { statut: complet ? 'recue' : 'partielle', report_date: last.report_date }
      if (cat === 'carburant') {
        const withCuve = list.filter(r => r.cuve_avant != null && r.cuve_apres != null)
        patch.cuve_avant = withCuve.length ? withCuve[0].cuve_avant : null
        patch.cuve_apres = withCuve.length ? withCuve[withCuve.length - 1].cuve_apres : null
        patch.prix_achat = last.prix_achat ?? o.prix_achat
        patch.montant = total * N(patch.prix_achat)
      }
      await supabase.from('fuel_orders').update(patch).eq('id', o.id)
    }
    setReceptions(list)
    load()
  }

  function startEditRec(r) {
    setEditRecId(r.id)
    setEditRecForm({ quantite_recue: String(N(r.quantite_recue)), cuve_avant: r.cuve_avant != null ? String(N(r.cuve_avant)) : '', cuve_apres: r.cuve_apres != null ? String(N(r.cuve_apres)) : '', date: r.report_date })
  }
  async function saveEditRec(o, r) {
    const f = editRecForm
    const patch = { quantite_recue: N(f.quantite_recue), report_date: f.date }
    if ((o.categorie || 'carburant') === 'carburant') {
      patch.cuve_avant = N(f.cuve_avant); patch.cuve_apres = N(f.cuve_apres)
      patch.montant = N(f.quantite_recue) * N(r.prix_achat)
    }
    const { error } = await supabase.from('order_receptions').update(patch).eq('id', r.id)
    if (error) { setErr(error.message); return }
    setEditRecId(null)
    await resyncOrderFromReceptions(o)
    flash('Réception corrigée')
  }
  async function deleteRec(o, r) {
    const { error } = await supabase.from('order_receptions').delete().eq('id', r.id)
    if (error) { setErr(error.message); return }
    await resyncOrderFromReceptions(o)
    flash('Réception supprimée')
  }

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
  const orderYears = [...new Set([...orders.map(o => dateOf(o).slice(0, 4)).filter(Boolean), String(now.getFullYear())])].sort()

  const inPeriod = (d) => {
    if (!d) return true
    if (dateFrom && dateTo) return d >= dateFrom && d <= dateTo
    if (year !== 'all' && d.slice(0, 4) !== year) return false
    if (month !== 'all' && d.slice(5, 7) !== month) return false
    return true
  }
  const resetFilters = () => { setYear('all'); setMonth('all'); setDateFrom(''); setDateTo(''); setFCat('tous'); setFStatut('tous') }
  const filtersActive = year !== 'all' || month !== 'all' || dateFrom || dateTo || fCat !== 'tous' || fStatut !== 'tous'

  // « À réceptionner » : liste toujours complète, peu importe le mois de lancement ou la catégorie —
  // une commande lancée peut être livrée bien après le mois où elle a été proposée/lancée, et il ne faut
  // jamais la perdre de vue derrière un filtre de période ou de catégorie.
  const shown = fStatut === 'a_receptionner'
    ? orders.filter(o => o.statut === 'lancee' || o.statut === 'partielle')
    : orders.filter(o =>
        inPeriod(dateOf(o)) &&
        (fStatut === 'tous' || o.statut === fStatut) &&
        (fCat === 'tous' || (o.categorie || 'carburant') === fCat))
  const totalMontant = shown.reduce((s, o) => s + orderMontant(o), 0)
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize))
  const pageClamped = Math.min(page, pageCount)
  const pageRows = shown.slice((pageClamped - 1) * pageSize, pageClamped * pageSize)
  useEffect(() => { setPage(1) }, [fStatut, fCat, year, month, dateFrom, dateTo])

  // Compte des commandes qui attendent une action, tous statuts confondus — résumé en haut de page.
  const nbAValider = count('proposee')
  const nbALancer = count('validee')
  const nbAReceptionner = count('lancee') + count('partielle')

  // Montant total des commandes en cours (pas encore soldées ni refusées), par pôle — détaillé
  // par étape (à valider / à lancer / à réceptionner) plutôt qu'un simple compteur, pour voir
  // tout de suite combien reste bloqué à valider vs déjà engagé en livraison.
  const EN_COURS_STATUTS = ['proposee', 'validee', 'lancee', 'partielle']
  const ETAPE_LABEL = { proposee: 'à valider', validee: 'à lancer', lancee: 'à réceptionner', partielle: 'à réceptionner' }
  const commandesEnCoursParPole = CATS.map(([key, label]) => {
    const os = orders.filter(o => (o.categorie || 'carburant') === key && EN_COURS_STATUTS.includes(o.statut))
    const parEtape = {}
    for (const o of os) parEtape[ETAPE_LABEL[o.statut]] = (parEtape[ETAPE_LABEL[o.statut]] || 0) + orderMontant(o)
    const detail = Object.entries(parEtape).map(([etape, v]) => `${fcfa(v)} ${etape}`).join(' · ')
    return { key, label, value: os.reduce((s, o) => s + orderMontant(o), 0), nb: os.length, detail }
  })

  const columns = [
    { key: 'date_proposee', header: 'Proposée', render: o => <span style={{ whiteSpace: 'nowrap' }}>{frDate(dateOf(o))}</span> },
    { key: 'date_etape', header: 'Lancée / Reçue', render: o => (
      <span style={{ whiteSpace: 'nowrap' }}>
        {o.statut === 'recue' && o.report_date ? frDate(o.report_date) : o.date_lancement ? frDate(o.date_lancement) : '—'}
      </span>
    ) },
    { key: 'categorie', header: 'Catégorie', render: o => (CATS.find(c => c[0] === (o.categorie || 'carburant')) || [, o.categorie])[1] },
    { key: 'produit', header: 'Produit / détail', render: o => (o.categorie || 'carburant') === 'superette'
      ? <span title={(o.lignes || []).map(l => `${l.article} ×${l.qte}`).join(' · ')}>{(o.lignes || []).length} article(s)</span>
      : o.produit },
    { key: 'qte', header: 'Qté', numeric: true, align: 'right', render: o => (o.categorie || 'carburant') !== 'superette' && N(o.quantite_commandee) ? N(o.quantite_commandee).toLocaleString('fr-FR') : '—' },
    { key: 'statut', header: 'Statut', render: o => { const st = ORDER_STATUS_TONES[o.statut] || { label: o.statut, tone: 'idle' }; return <Badge tone={st.tone}>{st.label}</Badge> } },
    { key: 'actions', header: '', align: 'right', render: o => (
      <div onClick={e => e.stopPropagation()}>
        <Button size="sm" tone={['proposee', 'validee', 'lancee', 'partielle'].includes(o.statut) ? 'primary' : 'outline'} onClick={() => setDetailId(o.id)}>
          {o.statut === 'lancee' || o.statut === 'partielle' ? 'Réceptionner' : 'Détail'}
        </Button>
      </div>
    ) },
  ]

  // Délai, paiement, avancement et note : déplacés du tableau (trop dense) vers le panneau de
  // détail, ouvert au clic sur une ligne ou sur le bouton Détail/Réceptionner.
  const detailOrder = orders.find(o => o.id === detailId) || null
  function avancementInfo(o) {
    const cat = o.categorie || 'carburant'
    const livre = cat !== 'carburant' ? null
      : livreReel[o.id] != null ? livreReel[o.id]
      : (o.cuve_apres != null && o.cuve_avant != null) ? N(o.cuve_apres) - N(o.cuve_avant) : null
    const perte = livre != null ? Math.max(0, N(o.quantite_commandee) - livre) : null
    const seuil = N(o.quantite_commandee) * N(settings.taux_perte_acceptable) / 100
    const perteNA = perte != null ? Math.max(0, perte - seuil) : null
    const t = recvTotals[o.id] || {}; const deja = N(t.quantite_recue_total)
    const reste = Math.max(N(o.quantite_commandee) - deja, 0)
    return { cat, livre, perte, perteNA, deja, reste }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {msg && <AlertBanner tone="ok" title="Succès">{msg}</AlertBanner>}
      {err && <AlertBanner tone="alarm" title="Erreur">{err}</AlertBanner>}
      {matinWarn && <AlertBanner tone="warn" title="Pense au relevé du matin">{matinWarn}</AlertBanner>}

      {/* ===== À TRAITER + COMMANDES EN COURS PAR PÔLE — une seule ligne de métriques, cliquables =====
          Les 4 pôles restent toujours affichés (même à 0), pour montrer qu'il n'y a rien en cours
          plutôt que de faire disparaître la carte, ce qui se lisait comme un pôle manquant/cassé. */}
      {(nbAValider > 0 || nbALancer > 0 || nbAReceptionner > 0 || commandesEnCoursParPole.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--sp-4)' }}>
          {nbAValider > 0 && <div onClick={() => setFStatut('proposee')} style={{ cursor: 'pointer' }}><Kpi label="À valider" value={nbAValider} status="warn" /></div>}
          {nbALancer > 0 && <div onClick={() => setFStatut('validee')} style={{ cursor: 'pointer' }}><Kpi label="À lancer" value={nbALancer} status="info" /></div>}
          {nbAReceptionner > 0 && <div onClick={() => setFStatut('a_receptionner')} style={{ cursor: 'pointer' }}><Kpi label="À réceptionner" value={nbAReceptionner} status="alarm" /></div>}
          {commandesEnCoursParPole.map(p => (
            <div key={p.key} onClick={() => { setFCat(p.key); setFStatut('tous') }} style={{ cursor: 'pointer' }}>
              <Kpi label={p.label} value={fcfa(p.value)} sub={p.detail || 'aucune commande en cours'} status={p.nb > 0 ? 'info' : undefined} />
            </div>
          ))}
        </div>
      )}

      {can('manage_orders') && !showPropose && (
        <Button tone="primary" onClick={() => setShowPropose(true)} style={{ alignSelf: 'flex-start' }}>+ Proposer une nouvelle commande</Button>
      )}

      {can('manage_orders') && showPropose && (
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
                <Panel title="Combinaisons possibles" meta={`bons disponibles : ${fcfa(bonsRestant)}`} flush
                  bodyStyle={openCombos ? undefined : { display: 'none' }}
                  actions={<IconButton icon="chevron-down" size="sm" title={openCombos ? 'Masquer' : 'Afficher'}
                    onClick={() => setOpenCombos(v => !v)} style={{ transform: openCombos ? 'rotate(180deg)' : 'none' }} />}>
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
            <Button size="sm" tone={fCat === 'tous' ? 'primary' : 'outline'} onClick={() => setFCat('tous')}>Toutes catégories</Button>
            {CATS.map(([k, l]) => <Button key={k} size="sm" tone={fCat === k ? 'primary' : 'outline'} onClick={() => setFCat(k)}>{l}</Button>)}
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <Select size="sm" value={fStatut} onChange={e => setFStatut(e.target.value)}
              options={[['tous', 'Tous statuts'], ['proposee', `Proposées (${count('proposee')})`], ['validee', `Validées (${count('validee')})`], ['a_receptionner', `À réceptionner (${nbAReceptionner})`], ['lancee', `Lancées (${count('lancee')})`], ['partielle', `Partielles (${count('partielle')})`], ['recue', `Reçues (${count('recue')})`], ['annulee', `Refusées (${count('annulee')})`]].map(([k, l]) => ({ value: k, label: l }))} />
          </div>
        </div>
        <DataTable columns={columns} rows={pageRows} onRowClick={o => setDetailId(o.id)} />
        <Pagination page={pageClamped} pageCount={pageCount} total={shown.length} pageSize={pageSize}
          onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1) }} />
      </Panel>

      {/* ===== PANNEAU DE DÉTAIL — délai/paiement/avancement/note + actions contextuelles ===== */}
      <Drawer open={!!detailOrder} onClose={() => setDetailId(null)}
        title={detailOrder ? `${(CATS.find(c => c[0] === (detailOrder.categorie || 'carburant')) || [, detailOrder.categorie])[1]}${detailOrder.produit ? ' — ' + detailOrder.produit : ''}` : ''}
        meta={detailOrder && (ORDER_STATUS_TONES[detailOrder.statut] || {}).label}>
        {detailOrder && (() => {
          const o = detailOrder
          const cat = o.categorie || 'carburant'
          const { livre, perte, perteNA, deja, reste } = avancementInfo(o)
          const r = recv[o.id]
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
              <div>
                <DrawerRow label="Proposée le" value={frDate(dateOf(o))} />
                {o.date_lancement && <DrawerRow label="Lancée le" value={frDate(o.date_lancement)} />}
                {o.statut === 'recue' && o.report_date && <DrawerRow label="Reçue le" value={frDate(o.report_date)} />}
                <DrawerRow label="Délai lancement→réception" value={delaiJours(o) != null ? `${delaiJours(o)} j` : '—'} />
                <DrawerRow label="Paiement" mono={false} value={cat === 'carburant'
                  ? <>{fcfa(orderMontant(o))}{o.bons_base ? ` · bons ${fcfa(o.bons_base)}` : ''}{o.cheque_montant ? ` · chèque ${fcfa(o.cheque_montant)}` : ''}</>
                  : <>{o.mode_paiement || '—'} · {fcfa(o.montant_paiement)}</>} />
                {(o.statut === 'lancee' || o.statut === 'partielle') && <DrawerRow label="Avancement" value={`reçu ${deja.toLocaleString('fr-FR')}/${N(o.quantite_commandee).toLocaleString('fr-FR')} · reste ${reste.toLocaleString('fr-FR')}`} />}
                {o.statut === 'recue' && cat === 'carburant' && livre != null && (
                  <DrawerRow label="Avancement" status={perteNA > 0 ? 'alarm' : 'ok'}
                    value={`livré ${livre.toLocaleString('fr-FR')} · perte ${perte.toLocaleString('fr-FR')}${perteNA > 0 ? ` (${Math.round(perteNA).toLocaleString('fr-FR')} hors seuil)` : ' ✓'}`} />
                )}
                {o.statut === 'recue' && cat !== 'carburant' && <DrawerRow label="Avancement" value={`reçu ${deja.toLocaleString('fr-FR')}/${N(o.quantite_commandee).toLocaleString('fr-FR')}`} />}
                {o.note && <DrawerRow label="Note" mono={false} value={o.note} />}
                {cat === 'superette' && o.lignes && <DrawerRow label="Articles" mono={false} value={o.lignes.map(l => `${l.article} ×${l.qte}`).join(' · ')} />}
              </div>

              {receptions.length > 0 && (
                <div>
                  <div style={{ font: 'var(--fw-semibold) 11px/1 var(--font-ui)', textTransform: 'uppercase', letterSpacing: 'var(--ls-label)', color: 'var(--text-muted)', marginBottom: 'var(--sp-3)' }}>
                    Réceptions{receptions.length > 1 ? ` (${receptions.length} passages)` : ''}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                    {receptions.map(r => editRecId === r.id ? (
                      <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', padding: 'var(--sp-3)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-1)' }}>
                        <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
                          <Field label="Qté reçue (L)" style={{ flex: '1 1 120px' }}><Input type="text" inputMode="decimal" numeric value={editRecForm.quantite_recue} onChange={e => setEditRecForm(p => ({ ...p, quantite_recue: e.target.value }))} /></Field>
                          {cat === 'carburant' && <>
                            <Field label="Cuve avant" style={{ flex: '1 1 120px' }}><Input type="text" inputMode="decimal" numeric value={editRecForm.cuve_avant} onChange={e => setEditRecForm(p => ({ ...p, cuve_avant: e.target.value }))} /></Field>
                            <Field label="Cuve après" style={{ flex: '1 1 120px' }}><Input type="text" inputMode="decimal" numeric value={editRecForm.cuve_apres} onChange={e => setEditRecForm(p => ({ ...p, cuve_apres: e.target.value }))} /></Field>
                          </>}
                          <Field label="Date" style={{ flex: '1 1 140px' }}><Input type="date" value={editRecForm.date} max={today()} onChange={e => setEditRecForm(p => ({ ...p, date: e.target.value }))} /></Field>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                          <Button size="sm" tone="primary" onClick={() => saveEditRec(o, r)}>Enregistrer</Button>
                          <Button size="sm" onClick={() => setEditRecId(null)}>Annuler</Button>
                        </div>
                      </div>
                    ) : (
                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-1)', font: '400 12px/1.4 var(--font-ui)' }}>
                        <span style={{ color: 'var(--text-body)' }}>
                          {frDate(r.report_date)} — {N(r.quantite_recue).toLocaleString('fr-FR')} L
                          {cat === 'carburant' && r.cuve_avant != null && r.cuve_apres != null && ` (cuve ${N(r.cuve_avant).toLocaleString('fr-FR')} → ${N(r.cuve_apres).toLocaleString('fr-FR')})`}
                        </span>
                        <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
                          {r.photo_path && <a href={supabase.storage.from(BORDEREAUX_BUCKET).getPublicUrl(r.photo_path).data.publicUrl} target="_blank" rel="noreferrer">Photo</a>}
                          {isAdmin && <>
                            <Button size="sm" onClick={() => startEditRec(r)}>Modifier</Button>
                            <Button size="sm" tone="danger" onClick={() => deleteRec(o, r)}>Supprimer</Button>
                          </>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {o.statut === 'proposee' && (can('validate_orders') || can('manage_orders')) && (
                <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                  <Button tone="primary" onClick={() => { valider(o); setDetailId(null) }}>Valider</Button>
                  <Button tone="danger" onClick={() => { refuser(o); setDetailId(null) }}>Refuser</Button>
                </div>
              )}
              {o.statut === 'proposee' && !can('validate_orders') && !can('manage_orders') && <AlertBanner tone="info" title="En attente">En attente de validation par l'administrateur.</AlertBanner>}

              {o.statut === 'validee' && can('manage_orders') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                  <Field label="Date de lancement"><Input type="date" value={launch[o.id] || today()} max={today()} onChange={e => setLaunch(p => ({ ...p, [o.id]: e.target.value }))} /></Field>
                  <Button tone="primary" onClick={() => { lancer(o); setDetailId(null) }} style={{ alignSelf: 'flex-start' }}>Lancer la commande</Button>
                </div>
              )}

              {(o.statut === 'lancee' || o.statut === 'partielle') && can('manage_orders') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                  <div style={{ font: 'var(--fw-semibold) 11px/1 var(--font-ui)', textTransform: 'uppercase', letterSpacing: 'var(--ls-label)', color: 'var(--text-muted)' }}>Réceptionner</div>
                  {(() => {
                    const pr = products.find(p => p.categorie === cat && p.nom === o.produit)
                    const hasCondit = pr && N(pr.conditionnement_qte) > 0
                    if (!hasCondit) return (
                      <Field label="Qté reçue *"><Input type="text" inputMode="decimal" numeric value={r?.quantite_recue ?? (reste ? String(reste) : '')} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...(p[o.id] || { cuve_avant: '', cuve_apres: '', date: today() }), quantite_recue: e.target.value } }))} /></Field>
                    )
                    const updateSplit = (patch) => {
                      const base = r || { cuve_avant: '', cuve_apres: '', date: today() }
                      const next = { ...base, ...patch }
                      setRecv(p => ({ ...p, [o.id]: { ...next, ...packagingSplit({ pr, qteCartons: next.qteCartons, qteUnites: next.qteUnites }) } }))
                    }
                    return (
                      <Field label="Qté reçue *">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                          <Input size="sm" type="text" inputMode="numeric" numeric value={r?.qteCartons || ''} placeholder="0" style={{ width: 60 }} onChange={e => updateSplit({ qteCartons: e.target.value })} />
                          <span style={{ font: '400 11px/1 var(--font-ui)', color: 'var(--text-muted)' }}>{pr.conditionnement_nom || 'carton'}(s) +</span>
                          <Input size="sm" type="text" inputMode="numeric" numeric value={r?.qteUnites || ''} placeholder="0" style={{ width: 60 }} onChange={e => updateSplit({ qteUnites: e.target.value })} />
                          <span style={{ font: '400 11px/1 var(--font-ui)', color: 'var(--text-muted)' }}>{pr.unite || 'unité'}(s) = {r?.quantite_recue || 0}</span>
                        </div>
                      </Field>
                    )
                  })()}
                  {cat === 'carburant' && <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                    <Field label="Cuve avant"><Input type="text" inputMode="decimal" numeric value={r?.cuve_avant ?? ''} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...(p[o.id] || {}), cuve_avant: e.target.value } }))} /></Field>
                    <Field label="Cuve après"><Input type="text" inputMode="decimal" numeric value={r?.cuve_apres ?? ''} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...(p[o.id] || {}), cuve_apres: e.target.value } }))} /></Field>
                  </div>}
                  {cat === 'carburant' && (() => {
                    const s = cumulStatus({ quantiteCommandee: o.quantite_commandee, deja, recuSaisi: r?.quantite_recue, tauxPerteAcceptable: settings.taux_perte_acceptable })
                    return (
                      <p style={{ font: '400 11px/1.4 var(--font-ui)', color: s.dansLaNorme ? 'var(--state-ok)' : 'var(--state-alarm)', margin: 0 }}>
                        Cumul avec cette réception : {Math.round(s.cumul).toLocaleString('fr-FR')} / {Math.round(s.commande).toLocaleString('fr-FR')} L —
                        {s.dansLaNorme ? ' dans la norme' : ` hors norme (${Math.round(s.perteNa).toLocaleString('fr-FR')} L au-delà du seuil toléré)`}
                      </p>
                    )
                  })()}
                  <Field label="Date"><Input type="date" value={r?.date || today()} max={today()} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...(p[o.id] || {}), date: e.target.value } }))} /></Field>
                  {r?.warnEcart && (
                    <AlertBanner tone="warn" title="Écart détecté">
                      {r.warnEcart}
                      <Checkbox label="Forcer (c'est correct malgré tout)" checked={!!r.forceEcart} onChange={v => setRecv(p => ({ ...p, [o.id]: { ...r, forceEcart: v, warnEcart: v ? '' : r.warnEcart } }))} style={{ marginTop: 'var(--sp-3)' }} />
                    </AlertBanner>
                  )}
                  <EvidenceUpload label={r?._file ? r._file.name : 'Photo (bon de livraison) — facultatif'} multiple={false} onFiles={files => setRecv(p => ({ ...p, [o.id]: { ...(p[o.id] || {}), _file: files[0] } }))} />
                  <Button tone="primary" onClick={() => receptionner(o)} style={{ alignSelf: 'flex-start' }}>Valider la réception</Button>
                </div>
              )}

              {isAdmin && <Button tone="danger" onClick={() => { delOrder(o); setDetailId(null) }} style={{ alignSelf: 'flex-start' }}>Supprimer la commande</Button>}
            </div>
          )
        })()}
      </Drawer>
    </div>
  )
}
