import { NextResponse } from 'next/server'

/**
 * GET /api/health
 * Endpoint de santé pour le monitoring (UptimeRobot, Vercel, etc.)
 * Retourne 200 si l'app tourne, avec les infos de config non-sensibles.
 */
export async function GET() {
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const hasCinetPay = Boolean(process.env.CINETPAY_API_KEY)
  const hasResend   = Boolean(process.env.RESEND_API_KEY)

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    mode: hasSupabase ? 'production' : 'demo',
    services: {
      supabase:  hasSupabase ? 'configured' : 'demo',
      cinetpay:  hasCinetPay ? 'configured' : 'demo',
      resend:    hasResend   ? 'configured' : 'demo',
    },
  })
}
