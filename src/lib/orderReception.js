import { numFR, today } from './format'
import { compressImage } from './image'

// Logique de réception d'une commande — strictement identique entre « Saisie du jour »
// (composant OrderReception, liste de toutes les commandes en attente) et « Commandes »
// (panneau de détail d'une seule commande) : un seul endroit à maintenir pour le garde-fou
// d'écart cuve et les écritures en base (order_receptions / fuel_orders / stock / attachments).

export const N = (v) => (v ? (numFR(v) ?? 0) : 0)

export const prixAchat = (produit, settings) =>
  produit === 'gasoil' ? N(settings.gasoil_pa || 730) : N(settings.essence_pa || 705)

// Quantité déclarée reçue vs mesure physique cuve_après−cuve_avant (CETTE réception).
// Un écart important signale un relevé « cuve avant » pris trop tôt (pollué par des ventes
// avant l'arrivée réelle du camion) ou une erreur de saisie — pas forcément une vraie perte.
export function ecartWarning({ recu, cuveAvant, cuveApres, tauxPerteAcceptable, force }) {
  if (force) return null
  const cuveDelta = N(cuveApres) - N(cuveAvant)
  const ecart = Math.abs(recu - cuveDelta)
  const seuil = Math.max(recu * (N(tauxPerteAcceptable) || 5) / 100, 50)
  if (ecart <= seuil) return null
  return `Déclaré reçu ${recu.toLocaleString('fr-FR')} L, mais cuve après−avant = ${cuveDelta.toLocaleString('fr-FR')} L (écart ${Math.round(ecart).toLocaleString('fr-FR')} L). Vérifie que « cuve avant » a bien été relevée juste avant l'arrivée du camion.`
}

// Valide + écrit en base une réception (partielle ou soldante). Lève une Error pour les
// erreurs de saisie bloquantes ; renvoie { warnEcart } pour un écart à confirmer (non bloquant,
// l'appelant réaffiche le formulaire avec la case « forcer ») ; renvoie { complet, total } au succès.
export async function receptionner({ supabase, bucket, stationId, session, order, recv, settings, deja }) {
  const day = recv.date || today()
  const recu = N(recv.quantite_recue)
  if (!recu || recu <= 0) throw new Error('Renseigne la quantité effectivement reçue (> 0).')
  const cat = order.categorie || 'carburant'
  if (cat === 'carburant' && (recv.cuve_avant === '' || recv.cuve_avant == null || recv.cuve_apres === '' || recv.cuve_apres == null)) {
    throw new Error('Renseigne cuve AVANT et APRÈS.')
  }
  if (cat === 'carburant') {
    const warn = ecartWarning({ recu, cuveAvant: recv.cuve_avant, cuveApres: recv.cuve_apres, tauxPerteAcceptable: settings.taux_perte_acceptable, force: recv.forceEcart })
    if (warn) return { warnEcart: warn }
  }
  const total = N(deja) + recu
  const marge = N(order.quantite_commandee) * (N(settings.taux_perte_acceptable) || 5) / 100
  const complet = total >= N(order.quantite_commandee) - marge

  let photo_path = null
  if (recv._file) {
    photo_path = `${stationId}/reception/${day}/${order.id}_${(recv._file.name || 'photo').replace(/[^\w.\-]/g, '_')}`
    const { error: up } = await supabase.storage.from(bucket).upload(photo_path, await compressImage(recv._file))
    if (up) throw up
  }

  if (cat === 'carburant') {
    const prix = prixAchat(order.produit, settings)
    await supabase.from('order_receptions').insert({ order_id: order.id, station_id: stationId, report_date: day, quantite_recue: recu, cuve_avant: N(recv.cuve_avant), cuve_apres: N(recv.cuve_apres), prix_achat: prix, montant: recu * prix, photo_path, created_by: session.user.id })
    await supabase.from('fuel_orders').update({ statut: complet ? 'recue' : 'partielle', cuve_avant: order.cuve_avant != null ? order.cuve_avant : N(recv.cuve_avant), cuve_apres: N(recv.cuve_apres), report_date: day, prix_achat: prix, montant: total * prix, recu_by: session.user.id, recu_at: new Date().toISOString() }).eq('id', order.id)
    const sf = order.produit === 'gasoil' ? 'gas_stock' : 'ess_stock'
    await supabase.from('daily_reports').upsert({ station_id: stationId, report_date: day, [sf]: N(recv.cuve_apres), created_by: session.user.id }, { onConflict: 'station_id,report_date' })
  } else {
    await supabase.from('order_receptions').insert({ order_id: order.id, station_id: stationId, report_date: day, quantite_recue: recu, photo_path, created_by: session.user.id })
    await supabase.from('fuel_orders').update({ statut: complet ? 'recue' : 'partielle', report_date: day, recu_by: session.user.id, recu_at: new Date().toISOString() }).eq('id', order.id)
    const mvt = { station_id: stationId, categorie: cat, type: 'entree', source: 'reception', ref: 'CMD#' + order.id, date_mouvement: day, created_by: session.user.id }
    if (cat === 'superette') mvt.valeur = N(order.montant_paiement)
    else { mvt.produit = order.produit; mvt.quantite = recu }
    await supabase.from('stock_movements').insert(mvt)
  }
  if (photo_path) await supabase.from('attachments').insert({ station_id: stationId, report_date: day, categorie: 'reception', note: `${order.produit || cat} — reçu ${recu} / ${N(order.quantite_commandee)}`, photo_path, created_by: session.user.id })

  return { complet, total }
}
