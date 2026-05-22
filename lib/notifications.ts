import type { TypeNotification, Notification } from '@/lib/supabase'

// ── Helpers temps relatif ────────────────────────────────────────────────────

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 2)  return "À l'instant"
  if (m < 60) return `${m} min`
  if (h < 24) return `${h}h`
  if (d < 7)  return `${d}j`
  return `${Math.floor(d / 7)} sem.`
}

// ── Icône et couleur par type ────────────────────────────────────────────────

export function notifIcon(type: TypeNotification): string {
  const map: Record<TypeNotification, string> = {
    paiement_recu:       '✓',
    relance:             '⚠',
    resiliation:         '✕',
    kyc_valide:          '🪪',
    kyc_refuse:          '✕',
    titre_disponible:    '🏆',
    reservation_expiree: '⏰',
    contrat_signe:       '📄',
    bienvenue:           '👋',
  }
  return map[type] ?? '•'
}

export function notifColor(type: TypeNotification): string {
  const greens  = ['paiement_recu', 'kyc_valide', 'titre_disponible', 'contrat_signe', 'bienvenue']
  const yellows = ['relance', 'reservation_expiree']
  const reds    = ['resiliation', 'kyc_refuse']
  if (greens.includes(type))  return '#1D9E75'
  if (yellows.includes(type)) return '#d97706'
  if (reds.includes(type))    return '#dc2626'
  return '#6b7280'
}

export function notifBg(type: TypeNotification): string {
  const greens  = ['paiement_recu', 'kyc_valide', 'titre_disponible', 'contrat_signe', 'bienvenue']
  const yellows = ['relance', 'reservation_expiree']
  const reds    = ['resiliation', 'kyc_refuse']
  if (greens.includes(type))  return '#f0fdf4'
  if (yellows.includes(type)) return '#fffbeb'
  if (reds.includes(type))    return '#fef2f2'
  return '#f9fafb'
}

// ── Templates email HTML ─────────────────────────────────────────────────────

interface TemplateData {
  nom?:     string
  terrain?: string
  montant?: string
  motif?:   string
  numero?:  string
  lien?:    string
}

interface EmailTemplate {
  subject: string
  html: string
}

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KLô</title></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:'DM Sans',Arial,sans-serif;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:40px 20px">
<tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
    <!-- Header -->
    <tr><td style="background:linear-gradient(135deg,#0d2b1f,#1a4a35);padding:32px 40px">
      <div style="font-family:Georgia,serif;font-size:32px;font-weight:700;color:white;letter-spacing:-0.02em">
        KL<span style="color:#1D9E75">ô</span>
      </div>
      <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-top:4px">KLô Immobilier · contact@klo.immo</div>
    </td></tr>
    <!-- Content -->
    <tr><td style="padding:40px">${content}</td></tr>
    <!-- Footer -->
    <tr><td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;line-height:1.6">
      Vous recevez cet email car vous êtes client KLô Immobilier.<br>
      Pour vous désinscrire ou gérer vos préférences : <a href="https://klo.immo" style="color:#1D9E75">klo.immo</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`
}

export function getEmailTemplate(type: TypeNotification, data: TemplateData): EmailTemplate {
  const nom = data.nom || 'cher client'
  const baseUrl = 'https://klo.immo'

  switch (type) {

    case 'paiement_recu':
      return {
        subject: `✓ Paiement de ${data.montant || ''} reçu — KLô`,
        html: emailLayout(`
          <h2 style="font-family:Georgia,serif;font-size:26px;font-weight:600;margin:0 0 16px;color:#1a4a35">Paiement reçu</h2>
          <p style="font-size:15px;line-height:1.7;color:#4b5563;margin:0 0 24px">Bonjour ${nom},</p>
          <p style="font-size:15px;line-height:1.7;color:#4b5563;margin:0 0 24px">
            Votre paiement de <strong style="color:#1D9E75">${data.montant}</strong> pour le terrain
            <strong>${data.terrain || ''}</strong> a bien été reçu et enregistré.
          </p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;margin:0 0 24px">
            <div style="font-size:28px;font-weight:700;color:#1D9E75;margin-bottom:4px">${data.montant}</div>
            <div style="font-size:13px;color:#166534">Paiement confirmé</div>
          </div>
          <a href="${baseUrl}" style="display:inline-block;background:#1D9E75;color:white;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Voir mon espace →</a>
        `),
      }

    case 'relance':
      return {
        subject: `⚠️ Rappel paiement — ${data.terrain || 'votre terrain'} — KLô`,
        html: emailLayout(`
          <h2 style="font-family:Georgia,serif;font-size:26px;font-weight:600;margin:0 0 16px;color:#d97706">Rappel de paiement</h2>
          <p style="font-size:15px;line-height:1.7;color:#4b5563;margin:0 0 24px">Bonjour ${nom},</p>
          <p style="font-size:15px;line-height:1.7;color:#4b5563;margin:0 0 24px">
            Votre mensualité de <strong>${data.montant || ''}</strong> pour le terrain
            <strong>${data.terrain || ''}</strong> est en retard.
            Merci de régulariser votre situation pour éviter une résiliation de contrat.
          </p>
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;margin:0 0 24px;font-size:13px;color:#d97706;line-height:1.6">
            ⚠️ Tout retard de plus de 30 jours peut entraîner la résiliation automatique du contrat.
          </div>
          <a href="${baseUrl}" style="display:inline-block;background:#d97706;color:white;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Régulariser maintenant →</a>
        `),
      }

    case 'kyc_valide':
      return {
        subject: '✓ Votre KYC a été validé — Vous pouvez réserver — KLô',
        html: emailLayout(`
          <h2 style="font-family:Georgia,serif;font-size:26px;font-weight:600;margin:0 0 16px;color:#1a4a35">KYC validé 🎉</h2>
          <p style="font-size:15px;line-height:1.7;color:#4b5563;margin:0 0 24px">Bonjour ${nom},</p>
          <p style="font-size:15px;line-height:1.7;color:#4b5563;margin:0 0 24px">
            Votre vérification d'identité a été <strong style="color:#1D9E75">approuvée</strong>.
            Vous pouvez désormais réserver un terrain sur KLô.
          </p>
          <div style="background:#f0fdf4;border-left:4px solid #1D9E75;padding:16px 20px;margin:0 0 24px;border-radius:0 8px 8px 0;font-size:14px;color:#166534">
            🪪 Identité vérifiée · Réservations débloquées · Paiements autorisés
          </div>
          <a href="${baseUrl}" style="display:inline-block;background:#1D9E75;color:white;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Explorer le catalogue →</a>
        `),
      }

    case 'kyc_refuse':
      return {
        subject: '⚠️ Votre KYC nécessite une correction — KLô',
        html: emailLayout(`
          <h2 style="font-family:Georgia,serif;font-size:26px;font-weight:600;margin:0 0 16px;color:#dc2626">Vérification refusée</h2>
          <p style="font-size:15px;line-height:1.7;color:#4b5563;margin:0 0 24px">Bonjour ${nom},</p>
          <p style="font-size:15px;line-height:1.7;color:#4b5563;margin:0 0 24px">
            Votre dossier KYC n'a pas pu être validé. Motif :
          </p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;margin:0 0 24px;font-size:14px;color:#dc2626;line-height:1.6">
            ${data.motif || 'Document non conforme.'}
          </div>
          <p style="font-size:14px;color:#4b5563;margin:0 0 24px">
            Vous pouvez soumettre à nouveau votre CNI ou passeport dans votre espace client.
          </p>
          <a href="${baseUrl}" style="display:inline-block;background:#1D9E75;color:white;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Soumettre à nouveau →</a>
        `),
      }

    case 'titre_disponible':
      return {
        subject: '🏆 Votre contrat est soldé — Titre disponible — KLô',
        html: emailLayout(`
          <h2 style="font-family:Georgia,serif;font-size:26px;font-weight:600;margin:0 0 16px;color:#1a4a35">Félicitations ! 🏆</h2>
          <p style="font-size:15px;line-height:1.7;color:#4b5563;margin:0 0 24px">Bonjour ${nom},</p>
          <p style="font-size:15px;line-height:1.7;color:#4b5563;margin:0 0 24px">
            Votre contrat pour le terrain <strong>${data.terrain || ''}</strong> est
            <strong style="color:#1D9E75">entièrement soldé</strong>. Votre titre foncier
            va être préparé et vous sera remis prochainement.
          </p>
          <div style="background:linear-gradient(135deg,#0d2b1f,#1a4a35);border-radius:12px;padding:28px;margin:0 0 24px;text-align:center;color:white">
            <div style="font-size:40px;margin-bottom:8px">🏆</div>
            <div style="font-family:Georgia,serif;font-size:20px;font-weight:600">${data.terrain || 'Votre terrain'}</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:4px">Propriété acquise · Titre en cours de remise</div>
          </div>
          <a href="${baseUrl}" style="display:inline-block;background:#1D9E75;color:white;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Voir mon titre →</a>
        `),
      }

    case 'contrat_signe':
      return {
        subject: `📄 Votre contrat ${data.terrain || ''} a été créé — KLô`,
        html: emailLayout(`
          <h2 style="font-family:Georgia,serif;font-size:26px;font-weight:600;margin:0 0 16px;color:#1a4a35">Contrat créé</h2>
          <p style="font-size:15px;line-height:1.7;color:#4b5563;margin:0 0 24px">Bonjour ${nom},</p>
          <p style="font-size:15px;line-height:1.7;color:#4b5563;margin:0 0 24px">
            Votre contrat de vente échelonnée pour <strong>${data.terrain || ''}</strong> a été enregistré.
            Veuillez verser l'acompte de <strong style="color:#1D9E75">${data.montant || ''}</strong> pour activer votre contrat.
          </p>
          <a href="${baseUrl}" style="display:inline-block;background:#1D9E75;color:white;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Payer l'acompte →</a>
        `),
      }

    case 'bienvenue':
      return {
        subject: 'Bienvenue sur KLô — Votre terrain vous attend 🌍',
        html: emailLayout(`
          <h2 style="font-family:Georgia,serif;font-size:26px;font-weight:600;margin:0 0 16px;color:#1a4a35">Bienvenue ${nom} !</h2>
          <p style="font-size:15px;line-height:1.7;color:#4b5563;margin:0 0 24px">
            Votre compte KLô est créé. Vous pouvez dès maintenant explorer notre catalogue de terrains en Afrique.
          </p>
          <p style="font-size:14px;color:#4b5563;margin:0 0 24px;line-height:1.7">
            <strong>Prochaine étape :</strong> soumettez votre pièce d'identité (KYC) pour débloquer les réservations.
          </p>
          <a href="${baseUrl}" style="display:inline-block;background:#1D9E75;color:white;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Explorer le catalogue →</a>
        `),
      }

    default:
      return {
        subject: 'Notification KLô',
        html: emailLayout(`<p style="font-size:15px;color:#4b5563">Bonjour ${nom}, vous avez une nouvelle notification sur KLô.</p>`),
      }
  }
}

// ── Trier par date décroissante ──────────────────────────────────────────────

export function sortNotifications(notifs: Notification[]): Notification[] {
  return [...notifs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}
