import { useEffect, useState } from 'react'
import { supabase, BORDEREAUX_BUCKET } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useStation } from '../lib/station.jsx'
import { fcfa, frDate, numFR, today } from '../lib/format'
import { compressImage } from '../lib/image'

const N = (v) => (v ? (numFR(v) ?? 0) : 0)
const CATS = [['carburant', '⛽ Carburant'], ['gaz', '🔥 Gaz'], ['lubrifiant', '🛢️ Lubrifiant'], ['superette', '🛒 Supérette']]
const STATUTS = {
  proposee: { label: 'Proposée', color: '#e67e22' }, validee: { label: 'Validée', color: '#2e86c1' },
  lancee: { label: 'Lancée', color: '#8e44ad' }, partielle: { label: 'Partielle', color: '#d68910' }, recue: { label: 'Reçue', color: '#1e874b' }, annulee: { label: 'Refusée', color: '#c0392b' },
}
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
      if (sousMin) { setErr(`⚠️ Quantité minimum ${MIN_CARBURANT.toLocaleString('fr-FR')} L par produit (exigence fournisseur) — ${sousMin.produit} : ${N(sousMin.qte).toLocaleString('fr-FR')} L.`); return }
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
    if (error) setErr(error.message); else { setNf(blankNf()); setShowPropose(false); flash(toInsert.length > 1 ? `${toInsert.length} commandes proposées ✓` : 'Commande proposée ✓'); load() }
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
      flash(complet ? '✅ Commande soldée — stock mis à jour' : `Réception partielle ✓ (${total.toLocaleString('fr-FR')}/${N(o.quantite_commandee).toLocaleString('fr-FR')})`)
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

  return (
    <div>
      {msg && <div className="ok">{msg}</div>}
      {err && <div className="err">{err}</div>}

      {!isPompiste && !showPropose && (
        <button className="btn" onClick={() => setShowPropose(true)}>➕ Proposer une nouvelle commande</button>
      )}

      {!isPompiste && showPropose && <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>➕ Proposer une commande</h2>
          <button className="btn sec small" onClick={() => setShowPropose(false)}>✕ Fermer</button>
        </div>
        <form onSubmit={propose}>
          <div className="row">
            <div><label>Catégorie</label>
              <select value={nf.categorie} onChange={e => changeCat(e.target.value)}>
                {CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></div>
            <div><label>Date de proposition</label><input type="date" value={nf.date_proposition} max={today()} onChange={e => setNf({ ...nf, date_proposition: e.target.value })} /></div>
          </div>

          {nf.categorie === 'carburant' && <>
            <p className="hint">Commande simultanée essence + gasoil : renseigne la quantité de chaque produit (laisse à 0 ce que tu ne commandes pas). Une commande sera créée par produit. Minimum {MIN_CARBURANT.toLocaleString('fr-FR')} L par produit (exigence fournisseur).</p>

            {(pa('essence') === 0 || pa('gasoil') === 0) && (
              <div className="err">
                ⚠️ Prix d'achat manquant pour {[pa('essence') === 0 && 'essence', pa('gasoil') === 0 && 'gasoil'].filter(Boolean).join(' et ')} — les coûts affichés ci-dessous seront à 0 F.
                Renseigne-le dans <b>Stations &amp; équipe → Prix &amp; marge → Prix d'achat</b> avant de proposer cette commande.
              </div>
            )}

            {!bonsOn && <p className="hint" style={{ color: 'var(--warn, #b8860b)' }}>💡 Les bons sont désormais virés directement en banque : les commandes se règlent à 100 % par chèque.</p>}

            {bonsOn && (
              <div className="card" style={{ background: 'var(--bg-soft, #f7f7f9)', marginBottom: 10 }}>
                <b>💡 Combinaisons possibles</b> — bons disponibles : <b>{fcfa(bonsRestant)}</b>
                <p className="hint" style={{ marginTop: 4 }}>Pour une quantité donnée, part payée en bons (dans la limite du disponible) vs complément en chèque — calculé indépendamment pour chaque produit.</p>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th className="num">Litres</th><th className="num">Coût essence</th><th className="num">Bons</th><th className="num">Chèque</th><th></th><th className="num">Coût gasoil</th><th className="num">Bons</th><th className="num">Chèque</th><th></th></tr></thead>
                    <tbody>
                      {COMBOS.map(q => {
                        const ce = q * pa('essence'), be = Math.min(bonsRestant, ce), che = ce - be
                        const cg = q * pa('gasoil'), bg = Math.min(bonsRestant, cg), chg = cg - bg
                        return (<tr key={q}>
                          <td className="num">{q.toLocaleString('fr-FR')}</td>
                          <td className="num">{fcfa(ce)}</td><td className="num">{fcfa(be)}</td><td className="num">{fcfa(che)}</td>
                          <td><button type="button" className="btn small" onClick={() => chooseCombo('essence', q)}>Choisir</button></td>
                          <td className="num">{fcfa(cg)}</td><td className="num">{fcfa(bg)}</td><td className="num">{fcfa(chg)}</td>
                          <td><button type="button" className="btn small" onClick={() => chooseCombo('gasoil', q)}>Choisir</button></td>
                        </tr>)
                      })}
                    </tbody>
                  </table>
                  <p className="hint" style={{ marginTop: 6 }}>Si tu choisis essence ET gasoil, clique ensuite « Utiliser les bons disponibles » pour répartir correctement le pool de bons partagé entre les deux.</p>
                </div>
                <button type="button" className="btn sec small" style={{ marginTop: 8 }} onClick={applyBonsAuto}>↧ Utiliser les bons disponibles (répartir sur les quantités saisies)</button>
              </div>
            )}

            {nf.rows.map((r, i) => (
              <fieldset className="fieldset" key={r.produit} style={{ marginBottom: 8 }}>
                <b style={{ textTransform: 'capitalize' }}>{r.produit}</b>
                <div className="row-3" style={{ marginTop: 6 }}>
                  <div><label>Quantité (L)</label><input type="text" inputMode="decimal" value={r.qte} onChange={e => setRow(i, 'qte', e.target.value)} /></div>
                  {bonsOn && <div><label>Bons (base, F)</label><input type="text" inputMode="decimal" value={r.bons} onChange={e => setRow(i, 'bons', e.target.value)} /></div>}
                  <div><label>{bonsOn ? 'Complément chèque (F)' : 'Chèque (F)'}</label><input type="text" inputMode="decimal" value={r.cheque} onChange={e => setRow(i, 'cheque', e.target.value)} /></div>
                </div>
                <div className="row" style={{ marginTop: 6 }}>
                  <div><label>Réf. chèque</label><input value={r.ref} onChange={e => setRow(i, 'ref', e.target.value)} /></div>
                  <div style={{ alignSelf: 'end' }}>{N(r.qte) > 0 ? <span className="ok">Coût estimé <b>{fcfa(N(r.qte) * pa(r.produit))}</b> · financement {fcfa(N(r.bons) + N(r.cheque))}</span> : null}</div>
                </div>
                {N(r.qte) > 0 && N(r.qte) < MIN_CARBURANT && <div className="err" style={{ marginTop: 6 }}>⚠️ Minimum {MIN_CARBURANT.toLocaleString('fr-FR')} L exigé par le fournisseur.</div>}
              </fieldset>
            ))}
            {(() => { const t = nf.rows.reduce((s, r) => s + N(r.qte) * pa(r.produit), 0); return t > 0 ? <div className="ok" style={{ marginTop: 6 }}>Total commande : <b>{fcfa(t)}</b></div> : null })()}
          </>}

          {(nf.categorie === 'gaz' || nf.categorie === 'lubrifiant') && <>
            <p className="hint">Renseigne les quantités pour tous les types voulus en une seule fois. Une commande sera créée par produit avec une quantité &gt; 0.</p>
            {!nf.rows.length && <p className="muted">Aucun produit « {nf.categorie} » dans le catalogue. Ajoute-les d'abord dans « Produits & prix ».</p>}
            <div><label>Paiement</label><select value={nf.mode_paiement} onChange={e => setNf({ ...nf, mode_paiement: e.target.value })}><option value="cheque">Chèque</option><option value="especes">Espèces</option>{bonsOn && <option value="bons">Bons</option>}</select></div>
            {nf.rows.length > 0 && <div className="table-wrap" style={{ marginTop: 8 }}>
              <table>
                <thead><tr><th>Produit</th><th className="num" style={{ width: 100 }}>Quantité</th><th className="num" style={{ width: 120 }}>Montant (F)</th></tr></thead>
                <tbody>
                  {nf.rows.map((r, i) => (
                    <tr key={r.produit}>
                      <td>{r.produit}</td>
                      <td><input type="text" inputMode="decimal" value={r.qte} onChange={e => setRow(i, 'qte', e.target.value)} style={{ width: 90, textAlign: 'right' }} /></td>
                      <td><input type="text" inputMode="decimal" value={r.montant} onChange={e => setRow(i, 'montant', e.target.value)} style={{ width: 110, textAlign: 'right' }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
            {(() => { const t = nf.rows.reduce((s, r) => s + N(r.montant), 0); return t > 0 ? <div className="ok" style={{ marginTop: 6 }}>Total à payer : <b>{fcfa(t)}</b></div> : null })()}
          </>}

          {nf.categorie === 'superette' && <>
            <label>Articles</label>
            {nf.lignes.map((l, i) => (
              <div className="row" key={i} style={{ marginBottom: 6 }}>
                <div style={{ flex: 2 }}><input list="prod-sup" value={l.article} placeholder="article" onChange={e => setNf({ ...nf, lignes: nf.lignes.map((x, j) => j === i ? { ...x, article: e.target.value } : x) })} /></div>
                <div><input type="text" inputMode="decimal" value={l.qte} placeholder="qté" onChange={e => setNf({ ...nf, lignes: nf.lignes.map((x, j) => j === i ? { ...x, qte: e.target.value } : x) })} /></div>
              </div>
            ))}
            <datalist id="prod-sup">{prodOf('superette').map(p => <option key={p.id} value={p.nom} />)}</datalist>
            <button type="button" className="btn sec small" onClick={() => setNf({ ...nf, lignes: [...nf.lignes, { article: '', qte: '' }] })}>+ Article</button>
            <div className="row" style={{ marginTop: 8 }}>
              <div><label>Paiement</label><select value={nf.mode_paiement} onChange={e => setNf({ ...nf, mode_paiement: e.target.value })}><option value="cheque">Chèque</option><option value="especes">Espèces</option></select></div>
              <div><label>Montant total (F)</label><input type="text" inputMode="decimal" value={nf.montant_paiement} onChange={e => setNf({ ...nf, montant_paiement: e.target.value })} /></div>
            </div>
          </>}

          <label>Note</label><input value={nf.note} onChange={e => setNf({ ...nf, note: e.target.value })} />
          <div style={{ height: 10 }} /><button className="btn small">Proposer la commande</button>
        </form>
      </div>}

      {/* Historique des commandes : tableau filtrable (mois OU période libre, catégorie, produit, statut).
          Toutes les actions d'une commande (valider/refuser/lancer/réceptionner/supprimer) sont ici,
          contextuelles au statut et au rôle — plus de section « à réceptionner » séparée. */}
      <div className="card">
        <h2>📋 Historique des commandes</h2>
        <div className="toolbar">
          <select value={year} onChange={e => { setYear(e.target.value); setDateFrom(''); setDateTo('') }}>
            <option value="all">Toutes années</option>{orderYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={e => { setMonth(e.target.value); setDateFrom(''); setDateTo('') }}>
            <option value="all">Tous mois</option>
            {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <span className="muted" style={{ fontSize: 12 }}>ou période :</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 'auto' }} />
          <span className="muted">→</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 'auto' }} />
          {filtersActive && <button className="btn sec small" onClick={resetFilters}>Réinitialiser</button>}
        </div>
        <div className="toolbar">
          <button className={'btn small ' + (fCat === 'tous' ? '' : 'sec')} onClick={() => { setFCat('tous'); setFProduit('tous') }}>Toutes catégories</button>
          {CATS.map(([k, l]) => <button key={k} className={'btn small ' + (fCat === k ? '' : 'sec')} onClick={() => { setFCat(k); setFProduit('tous') }}>{l}</button>)}
        </div>
        <div className="toolbar">
          <select value={fProduit} onChange={e => setFProduit(e.target.value)}>
            <option value="tous">Tous produits</option>
            {produits.filter(p => fCat === 'tous' || orders.some(o => o.produit === p && (o.categorie || 'carburant') === fCat)).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {[['tous', 'Tous statuts'], ['proposee', `Proposées (${count('proposee')})`], ['validee', `Validées (${count('validee')})`], ['lancee', `Lancées (${count('lancee')})`], ['partielle', `Partielles (${count('partielle')})`], ['recue', `Reçues (${count('recue')})`], ['annulee', `Refusées (${count('annulee')})`]].map(([k, l]) =>
            <button key={k} className={'btn small ' + (fStatut === k ? '' : 'sec')} onClick={() => setFStatut(k)}>{l}</button>)}
        </div>
        <p className="hint">{shown.length} commande(s) · total {fcfa(totalMontant)}</p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dates</th><th className="num" title="Jours entre lancement et réception">Délai</th><th>Catégorie</th><th>Produit / détail</th><th className="num">Qté</th>
                <th>Statut</th><th>Paiement</th><th>Avancement</th><th>Note</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(o => {
                const cat = o.categorie || 'carburant'
                const st = STATUTS[o.statut] || { label: o.statut, color: '#666' }
                const catLabel = (CATS.find(c => c[0] === cat) || [, cat])[1]
                // Priorité à la somme PAR réception (livreReel, v40) — fiable même en cas de ventes
                // entre deux réceptions partielles ; repli sur l'ancien calcul si v40 pas encore exécutée.
                const livre = cat !== 'carburant' ? null
                  : livreReel[o.id] != null ? livreReel[o.id]
                  : (o.cuve_apres != null && o.cuve_avant != null) ? N(o.cuve_apres) - N(o.cuve_avant) : null
                const perte = livre != null ? Math.max(0, N(o.quantite_commandee) - livre) : null
                const seuil = N(o.quantite_commandee) * N(settings.taux_perte_acceptable) / 100
                const perteNA = perte != null ? Math.max(0, perte - seuil) : null
                const t = recvTotals[o.id] || {}; const deja = N(t.quantite_recue_total)
                const reste = Math.max(N(o.quantite_commandee) - deja, 0)
                return (
                  <tr key={o.id}>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      Prop. {frDate(dateOf(o))}
                      {o.date_lancement && <><br />Lanc. {frDate(o.date_lancement)}</>}
                      {o.statut === 'recue' && o.report_date && <><br />Reçue {frDate(o.report_date)}</>}
                    </td>
                    <td className="num">{delaiJours(o) != null ? `${delaiJours(o)} j` : '—'}</td>
                    <td>{catLabel}</td>
                    <td>{cat === 'superette'
                      ? <span title={(o.lignes || []).map(l => `${l.article} ×${l.qte}`).join(' · ')}>{(o.lignes || []).length} article(s)</span>
                      : o.produit}</td>
                    <td className="num">{cat !== 'superette' && N(o.quantite_commandee) ? N(o.quantite_commandee).toLocaleString('fr-FR') : '—'}</td>
                    <td><span className="badge" style={{ background: st.color }}>{st.label}</span></td>
                    <td style={{ fontSize: 12 }}>{cat === 'carburant'
                      ? <>{fcfa(orderMontant(o))}{o.bons_base ? ` · bons ${fcfa(o.bons_base)}` : ''}{o.cheque_montant ? ` · chèque ${fcfa(o.cheque_montant)}` : ''}</>
                      : <>{o.mode_paiement || '—'} · {fcfa(o.montant_paiement)}</>}</td>
                    <td style={{ fontSize: 12 }}>
                      {(o.statut === 'lancee' || o.statut === 'partielle') && <span className="pill">reçu {deja.toLocaleString('fr-FR')}/{N(o.quantite_commandee).toLocaleString('fr-FR')} · reste {reste.toLocaleString('fr-FR')}</span>}
                      {o.statut === 'recue' && cat === 'carburant' && livre != null && (
                        <span style={{ color: perteNA > 0 ? 'var(--danger)' : 'var(--ok)' }}>
                          livré {livre.toLocaleString('fr-FR')} · perte {perte.toLocaleString('fr-FR')}{perteNA > 0 ? ` ⚠️ (${Math.round(perteNA).toLocaleString('fr-FR')} hors seuil)` : ' ✓'}
                        </span>
                      )}
                      {o.statut === 'recue' && cat !== 'carburant' && <span>reçu {deja.toLocaleString('fr-FR')}/{N(o.quantite_commandee).toLocaleString('fr-FR')}</span>}
                      {!['lancee', 'partielle', 'recue'].includes(o.statut) && '—'}
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 140 }}>{o.note || ''}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {o.statut === 'proposee' && isAdmin && <><button className="btn small" onClick={() => valider(o)}>✓</button>{' '}<button className="btn sec small" onClick={() => refuser(o)}>✕</button></>}
                      {o.statut === 'proposee' && !isAdmin && <span className="muted" style={{ fontSize: 11 }}>en attente admin</span>}
                      {o.statut === 'validee' && <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input type="date" value={launch[o.id] || today()} max={today()} onChange={e => setLaunch(p => ({ ...p, [o.id]: e.target.value }))} style={{ width: 120 }} />
                        <button className="btn small" onClick={() => lancer(o)}>🚚</button>
                      </div>}
                      {(o.statut === 'lancee' || o.statut === 'partielle') && (() => {
                        const r = recv[o.id]
                        if (!r) return <button className="btn small" onClick={() => setRecv(p => ({ ...p, [o.id]: { cuve_avant: '', cuve_apres: '', date: today(), quantite_recue: reste ? String(reste) : '' } }))}>📥 Réceptionner{deja > 0 ? ' (suite)' : ''}</button>
                        return (
                          <div style={{ minWidth: 200 }}>
                            <label style={{ fontSize: 11 }}>Qté reçue *</label>
                            <input type="text" inputMode="decimal" value={r.quantite_recue || ''} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...r, quantite_recue: e.target.value } }))} />
                            {cat === 'carburant' && <div className="row" style={{ marginTop: 4 }}>
                              <div><label style={{ fontSize: 11 }}>Cuve avant</label><input type="text" inputMode="decimal" value={r.cuve_avant} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...r, cuve_avant: e.target.value } }))} /></div>
                              <div><label style={{ fontSize: 11 }}>Cuve après</label><input type="text" inputMode="decimal" value={r.cuve_apres} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...r, cuve_apres: e.target.value } }))} /></div>
                            </div>}
                            <label style={{ fontSize: 11 }}>Date</label>
                            <input type="date" value={r.date || today()} max={today()} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...r, date: e.target.value } }))} />
                            {r.warnEcart && (
                              <div className="err" style={{ marginTop: 4, fontSize: 11 }}>
                                ⚠️ {r.warnEcart}
                                <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                  <input type="checkbox" checked={!!r.forceEcart} onChange={e => setRecv(p => ({ ...p, [o.id]: { ...r, forceEcart: e.target.checked, warnEcart: e.target.checked ? '' : r.warnEcart } }))} />
                                  Forcer (c'est correct malgré tout)
                                </label>
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                              <button className="btn small" onClick={() => receptionner(o)}>Valider</button>
                              <button className="btn sec small" onClick={() => setRecv(p => ({ ...p, [o.id]: undefined }))}>Annuler</button>
                            </div>
                          </div>
                        )
                      })()}
                      {isAdmin && <><br /><button className="btn sec small" style={{ marginTop: 4 }} onClick={() => delOrder(o)}>Suppr.</button></>}
                    </td>
                  </tr>
                )
              })}
              {!shown.length && <tr><td colSpan={10} className="muted">Aucune commande pour ces filtres.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
