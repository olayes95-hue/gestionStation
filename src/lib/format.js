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

