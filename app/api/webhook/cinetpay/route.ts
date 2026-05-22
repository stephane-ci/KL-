import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getIp } from '@/lib/rateLimit'

// Client admin créé à la demande (lazily) pour éviter les erreurs au build
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

/**
 * Vérifie la signature HMAC-SHA256 du webhook CinetPay.
 * CinetPay signe la payload avec CINETPAY_SECRET (si configuré).
 * Format : sha256(JSON.stringify(body) + secret)
 */
async function verifyWebhookSignature(body: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return true // pas de clé = démo, on laisse passer

  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const sigBytes = Buffer.from(signature, 'hex')
    return crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(body))
  } catch {
    return false
  }
}

/**
 * POST /api/webhook/cinetpay
 * CinetPay notifie cette URL à chaque changement de statut de paiement.
 * Format payload CinetPay v2 :
 *   cpm_trans_id, cpm_result ("00" = succès), cpm_amount, cpm_payment_date,
 *   cpm_phone_num, cpm_payment_config (ex: "CREDIT_CARD", "MOBILE_MONEY")
 */
export async function POST(req: NextRequest) {
  // Rate limit : max 120 appels/min depuis une IP (protection contre le flood)
  const ip = getIp(req)
  const limit = rateLimit(`webhook:${ip}`, { max: 120, windowMs: 60_000 })
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })
  }

  try {
    const rawBody = await req.text()

    // Vérification signature HMAC (si CINETPAY_WEBHOOK_SECRET configuré)
    const signature = req.headers.get('x-cinetpay-signature')
    const secret = process.env.CINETPAY_WEBHOOK_SECRET || ''
    const valid = await verifyWebhookSignature(rawBody, signature, secret)
    if (!valid) {
      console.warn('[webhook/cinetpay] signature invalide')
      return NextResponse.json({ error: 'Signature invalide' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)
    const { cpm_trans_id, cpm_result, cpm_amount, cpm_payment_date, cpm_phone_num, cpm_payment_config } = body

    // Seul cpm_result === "00" est un succès
    if (cpm_result !== '00') {
      return NextResponse.json({ status: 'ignored', reason: 'not_success' })
    }

    const paiementId = cpm_trans_id as string
    if (!paiementId) {
      return NextResponse.json({ error: 'transaction_id manquant' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Déduire le moyen de paiement depuis cpm_payment_config
    const cfg = String(cpm_payment_config || '').toUpperCase()
    const moyen = cfg.includes('CREDIT') ? 'carte'
      : cfg.includes('MOBILE') || cfg.includes('ORANGE') || cfg.includes('MTN')
        || cfg.includes('WAVE') || cfg.includes('MOOV') ? 'mobile_money'
      : 'virement'

    const operateur = cfg.includes('ORANGE') ? 'orange'
      : cfg.includes('MTN') ? 'mtn'
      : cfg.includes('WAVE') ? 'wave'
      : cfg.includes('MOOV') ? 'moov'
      : undefined

    // ── Marquer le paiement comme payé ──────────────────────────────────────
    const { data: paiement, error: errPaiement } = await supabaseAdmin
      .from('paiements')
      .update({
        statut: 'paye',
        date_paiement: cpm_payment_date || new Date().toISOString(),
        ref_transaction_api: paiementId,
        moyen,
        ...(operateur ? { operateur } : {}),
      })
      .eq('id', paiementId)
      .select('contrat_id')
      .single()

    if (errPaiement || !paiement) {
      console.error('[webhook/cinetpay] paiement introuvable:', paiementId, errPaiement)
      return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 })
    }

    const { contrat_id } = paiement

    // ── Récupérer infos contrat (profil_id) ────────────────────────────────
    const { data: contrat } = await supabaseAdmin
      .from('contrats')
      .select('profil_id, prix_total')
      .eq('id', contrat_id)
      .single()

    if (!contrat) {
      return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })
    }

    // ── Vérifier si le contrat est entièrement soldé ───────────────────────
    const { data: allPaiements } = await supabaseAdmin
      .from('paiements')
      .select('statut')
      .eq('contrat_id', contrat_id)

    const tousPayes = allPaiements?.every(p => p.statut === 'paye')
    if (tousPayes) {
      await supabaseAdmin.from('contrats')
        .update({ statut: 'solde' })
        .eq('id', contrat_id)
    }

    // ── Notification in-app ────────────────────────────────────────────────
    const montantFormate = Number(cpm_amount).toLocaleString('fr-FR')
    const notifMessage = tousPayes
      ? `🏆 Félicitations ! Votre contrat est soldé. Le titre foncier vous sera remis prochainement.`
      : `✓ Paiement de ${montantFormate} FCFA reçu${cpm_phone_num ? ` (${cpm_phone_num})` : ''}.`

    await supabaseAdmin.from('notifications').insert({
      profil_id: contrat.profil_id,
      contrat_id,
      type: tousPayes ? 'titre_disponible' : 'paiement_recu',
      canal: 'app',
      message: notifMessage,
      statut: 'envoye',
      lu: false,
      date_envoi: new Date().toISOString(),
    })

    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    console.error('[webhook/cinetpay] erreur:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
