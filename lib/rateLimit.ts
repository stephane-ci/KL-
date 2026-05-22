/**
 * Rate limiter in-memory simple pour les API routes Next.js.
 * Pas de Redis requis — convient pour un seul nœud / Vercel serverless.
 * Chaque instance de fonction a sa propre map (reset au cold start).
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

interface RateLimitOptions {
  /** Nombre maximal de requêtes autorisées dans la fenêtre */
  max: number
  /** Durée de la fenêtre en millisecondes (défaut : 60 000 = 1 min) */
  windowMs?: number
}

interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
}

/**
 * Vérifie si la clé `key` a dépassé la limite.
 * @param key   Clé unique (ex. IP + route)
 * @param opts  max, windowMs
 */
export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const { max, windowMs = 60_000 } = opts
  const now = Date.now()

  let entry = store.get(key)

  // Fenêtre expirée ou première requête
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs }
    store.set(key, entry)
    return { ok: true, remaining: max - 1, resetAt: entry.resetAt }
  }

  entry.count++
  const remaining = Math.max(0, max - entry.count)
  return { ok: entry.count <= max, remaining, resetAt: entry.resetAt }
}

/**
 * Extrait l'IP depuis les headers Next.js / Vercel.
 */
export function getIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

// ── Nettoyage périodique pour éviter les fuites mémoire ─────────────────────
// (uniquement en dev — en prod Vercel chaque lambda a sa propre mémoire)
if (process.env.NODE_ENV !== 'production') {
  setInterval(() => {
    const now = Date.now()
    store.forEach((entry, key) => {
      if (now > entry.resetAt) store.delete(key)
    })
  }, 5 * 60 * 1000)
}
