import { NextRequest, NextResponse } from 'next/server'
import type { InitPaymentRequest } from '@/lib/payment'
import { rateLimit, getIp } from '@/lib/rateLimit'

// Clés CinetPay — uniquement côté serveur (jamais NEXT_PUBLIC_)
const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY  || ''
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID || ''

export async function POST(req: NextRequest) {
  // Rate limit : 10 initiations de paiement par IP par minute
  const ip = getIp(req)
  const limit = rateLimit(`payment:${ip}`, { max: 10, windowMs: 60_000 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Trop de requêtes — réessayez dans une minute.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
    )
  }

  const body: InitPaymentRequest = await req.json()
  const { paiement_id, montant, description, client_nom, client_email, moyen, operateur, telephone, return_url } = body

  if (!paiement_id || !montant) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  // ── Mode démo (pas de clés CinetPay configurées) ──────────────────────────
  if (!CINETPAY_API_KEY || !CINETPAY_SITE_ID) {
    const demoUrl = `${new URL(req.url).origin}?payment=success&tid=${paiement_id}`
    return NextResponse.json({ payment_url: demoUrl })
  }

  // ── Appel CinetPay v2 ─────────────────────────────────────────────────────
  try {
    const payload: Record<string, unknown> = {
      apikey: CINETPAY_API_KEY,
      site_id: CINETPAY_SITE_ID,
      transaction_id: paiement_id,
      amount: montant,
      currency: 'XOF',
      description,
      return_url,
      notify_url: `${new URL(req.url).origin}/api/webhook/cinetpay`,
      customer_name: client_nom,
      customer_email: client_email,
      customer_phone_number: telephone || '',
    }

    // Mobile Money : passer opérateur + numéro
    if (moyen === 'mobile_money' && operateur && telephone) {
      payload.channels = operateur.toUpperCase()
    }

    const res = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (data.code !== '201') {
      return NextResponse.json({ error: data.message || 'Erreur CinetPay' }, { status: 400 })
    }

    return NextResponse.json({ payment_url: data.data?.payment_url })
  } catch {
    return NextResponse.json({ error: 'Erreur réseau CinetPay' }, { status: 500 })
  }
}
