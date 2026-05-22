import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Middleware KLô — Authentification & sécurité.
 *
 * Routes protégées :
 *   /api/payment/*     — réservé aux utilisateurs connectés
 *   /api/notifications/* — réservé aux utilisateurs connectés
 *
 * Routes publiques (pas de vérification auth) :
 *   /api/webhook/*     — appelé par CinetPay (IP externe, signature HMAC)
 *   /api/health        — monitoring
 *   /* (pages)         — la navigation est gérée par le client (IS_DEMO + Supabase)
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname

  // ── Routes API protégées ──────────────────────────────────────────────────
  const isProtectedApi = pathname.startsWith('/api/payment') ||
                         pathname.startsWith('/api/notifications')

  if (isProtectedApi) {
    // En mode démo (pas de Supabase URL configurée), on laisse passer
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) return res

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: () => {},   // lecture seule dans le middleware
        remove: () => {},
      },
    })

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 }
      )
    }
  }

  return res
}

export const config = {
  matcher: [
    '/api/payment/:path*',
    '/api/notifications/:path*',
  ],
}
