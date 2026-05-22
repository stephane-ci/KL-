// ── Types et helpers — intégration CinetPay ────────────────────────────────

export type MoyenPaiementUI = 'mobile_money' | 'carte' | 'virement'
export type OperateurUI = 'orange' | 'mtn' | 'moov' | 'wave'

export const OPERATEURS: {
  val: OperateurUI; label: string; flag: string; pays: string[]
}[] = [
  { val: 'orange', label: 'Orange Money', flag: '🟠', pays: ['Sénégal', "Côte d'Ivoire", 'Mali', 'Burkina Faso', 'Cameroun'] },
  { val: 'wave',   label: 'Wave',         flag: '🌊', pays: ['Sénégal', "Côte d'Ivoire"] },
  { val: 'mtn',    label: 'MTN MoMo',     flag: '🟡', pays: ["Côte d'Ivoire", 'Cameroun', 'Bénin', 'Congo'] },
  { val: 'moov',   label: 'Moov Money',   flag: '🔵', pays: ["Côte d'Ivoire", 'Togo', 'Bénin', 'Burkina Faso'] },
]

export interface InitPaymentRequest {
  paiement_id: string
  montant: number          // FCFA
  description: string
  client_nom: string
  client_email: string
  moyen: MoyenPaiementUI
  operateur?: OperateurUI
  telephone?: string
  return_url: string
}

export interface InitPaymentResponse {
  payment_url?: string
  error?: string
}

/** Référence de virement (affichée au client) */
export function refVirement(paiementId: string): string {
  return `KLO-${paiementId.slice(0, 8).toUpperCase()}`
}
