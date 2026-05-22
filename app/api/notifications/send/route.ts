import { NextRequest, NextResponse } from 'next/server'
import { getEmailTemplate } from '@/lib/notifications'
import type { TypeNotification } from '@/lib/supabase'

// Clé Resend — uniquement côté serveur
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const FROM_EMAIL     = process.env.FROM_EMAIL || 'KLô Immobilier <noreply@klo.immo>'

interface SendNotificationRequest {
  to:      string          // email du destinataire
  type:    TypeNotification
  data: {
    nom?:     string
    terrain?: string
    montant?: string
    motif?:   string
    numero?:  string
  }
}

export async function POST(req: NextRequest) {
  const body: SendNotificationRequest = await req.json()
  const { to, type, data } = body

  if (!to || !type) {
    return NextResponse.json({ error: 'Paramètres manquants (to, type)' }, { status: 400 })
  }

  // ── Mode démo (pas de clé Resend) ────────────────────────────────────────
  if (!RESEND_API_KEY) {
    console.log('[notifications/send] Mode démo — email simulé:', { to, type, data })
    return NextResponse.json({ ok: true, demo: true, message: `Email simulé → ${to}` })
  }

  // ── Envoi via Resend REST API ─────────────────────────────────────────────
  try {
    const template = getEmailTemplate(type, data)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      [to],
        subject: template.subject,
        html:    template.html,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      console.error('[notifications/send] Resend error:', result)
      return NextResponse.json({ error: result.message || 'Erreur Resend' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, id: result.id })
  } catch (err) {
    console.error('[notifications/send] fetch error:', err)
    return NextResponse.json({ error: 'Erreur réseau' }, { status: 500 })
  }
}
