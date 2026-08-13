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

// Reformate un nombre saisi "à la française" en insérant des espaces séparateurs de
// milliers, pour la lisibilité — pas pour le calcul (numFR reste la fonction qui compte).
// Ex : "5580591" -> "5 580 591" · "12,5" -> "12,5" · idempotent (re-formater ne change rien).
export const formatThousands = (v) => {
  if (v === '' || v === null || v === undefined) return v
  const s = String(v).replace(/\s/g, '')
  const neg = s.startsWith('-') ? '-' : ''
  const body = neg ? s.slice(1) : s
  const parts = body.replace(/\./g, '').split(',')
  const intDigits = (parts[0] || '').replace(/\D/g, '')
  if (!intDigits) return v
  const grouped = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return neg + grouped + (parts.length > 1 ? ',' + parts.slice(1).join('') : '')
}

