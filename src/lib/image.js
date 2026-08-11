// Compresse une image AVANT envoi : redimensionne (max 1600 px) + JPEG qualité 0.7.
// Une photo de téléphone de 3–5 Mo tombe typiquement à 200–400 Ko → stockage ~10× plus léger,
// uploads plus rapides sur connexion mobile. Retourne un File (ou l'original si non-image / échec).
export async function compressImage(file, { maxDim = 1600, quality = 0.7 } = {}) {
  try {
    if (!file || !file.type || !file.type.startsWith('image/')) return file
    if (file.type === 'image/gif') return file // ne pas casser les GIF animés
    const bitmap = await createImageBitmap(file)
    let { width, height } = bitmap
    const scale = Math.min(1, maxDim / Math.max(width, height))
    width = Math.round(width * scale); height = Math.round(height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file // garde l'original s'il est déjà plus petit
    const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified || 0 })
  } catch {
    return file // en cas d'échec, on envoie l'original (jamais bloquant)
  }
}
