// ── Helpers documents KLô ──────────────────────────────────────────────────

/**
 * Génère un numéro de document unique non-séquentiel.
 * Format : KLO-YYYY-XXXXXXXX (8 caractères alphanumériques sans ambiguïtés)
 */
export function generateNumeroUnique(): string {
  const year = new Date().getFullYear()
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let random = ''
  for (let i = 0; i < 8; i++) {
    random += chars[Math.floor(Math.random() * chars.length)]
  }
  return `KLO-${year}-${random}`
}

/**
 * Génère un hash hexadécimal 32 caractères pour le QR code de vérification.
 * Utilise crypto.randomUUID si disponible (navigateur + Node 19+), sinon fallback.
 */
export function generateQrHash(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '')
  }
  // Fallback universel
  let hash = ''
  for (let i = 0; i < 32; i++) {
    hash += Math.floor(Math.random() * 16).toString(16)
  }
  return hash
}

/**
 * Retourne l'URL de l'image QR code (via api.qrserver.com, aucun package requis).
 * Code vert foncé KLô sur fond blanc.
 */
export function qrCodeUrl(hash: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://klo.immo'
  const verifyUrl = `${base}?verify=${hash}`
  return [
    'https://api.qrserver.com/v1/create-qr-code/',
    `?size=180x180`,
    `&data=${encodeURIComponent(verifyUrl)}`,
    `&bgcolor=ffffff&color=0d2b1f&margin=6&format=png`,
  ].join('')
}
