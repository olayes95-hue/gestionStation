export const fcfa = (n) =>
  (n === null || n === undefined || n === '' || isNaN(n))
    ? '—'
    : Math.round(Number(n)).toLocaleString('fr-FR') + ' F'

export const num = (n) =>
  (n === null || n === undefined || n === '' || isNaN(n))
    ? '—'
    : Number(n).toLocaleString('fr-FR')

export const today = () => new Date().toISOString().slice(0, 10)

// Normalise un nombre saisi "à la française" : le point = séparateur de milliers (ignoré),
// l'espace = séparateur de milliers (ignoré), la virgule = décimale.
// Ex : "527.966" -> 527966 · "4.277.213" -> 4277213 · "10,5" -> 10.5
export const numFR = (v) => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(String(v).replace(/\s/g, '').replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}

export const frDate = (iso) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export const ALERT_LABELS = {
  VERSEMENT_MANQUANT:   { label: 'Versement manquant',      color: '#c0392b' },
  VERSEMENT_INCOMPLET:  { label: 'Versement incomplet',     color: '#c0392b' },
  ECART_CAISSE:         { label: 'Écart de caisse',         color: '#e67e22' },
  DEPENSE_NON_JUSTIFIEE:{ label: 'Dépense non justifiée',   color: '#e67e22' },
  ECART_COMPTEUR:       { label: 'Écart compteur',          color: '#e67e22' },
  RELEVE_COMPTEUR_MANQUANT: { label: 'Relevé compteur non mis à jour', color: '#8e44ad' },
  DONNEES_INCOHERENTES: { label: 'Données compteur/cuve à vérifier', color: '#8e44ad' },
  STOCK_BAS:            { label: 'Stock bas carburant',     color: '#c0392b' },
  STOCK_BAS_GAZ:        { label: 'Stock bas gaz',           color: '#e67e22' },
  STOCK_BAS_LUBRIFIANT: { label: 'Stock bas lubrifiant',    color: '#e67e22' },
  ECART_STOCK:          { label: 'Écart de cuve (coulage ?)', color: '#c0392b' },
  PERTE_LIVRAISON:      { label: 'Perte livraison > 5%',    color: '#c0392b' },
  BONS_INEXPLIQUES:     { label: 'Bons disparus (inexpliqué)', color: '#c0392b' },
  ECART_INVENTAIRE:     { label: 'Écart d\'inventaire',      color: '#c0392b' },
  POINT_MANQUANT:       { label: 'Point du jour manquant',  color: '#8e44ad' },
}
