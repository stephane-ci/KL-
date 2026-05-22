import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const IS_DEMO = !process.env.NEXT_PUBLIC_SUPABASE_URL

// ============================================================
// ENUMS
// ============================================================

export type TypeProfil        = 'local' | 'diaspora'
export type StatutKyc         = 'non_soumis' | 'en_attente' | 'valide' | 'refuse'
export type StatutTerrain     = 'dispo' | 'reserve' | 'en_cours' | 'vendu'
export type StatutContrat     = 'actif' | 'resilie' | 'solde'
export type TypePaiement      = 'acompte' | 'mensualite'
export type StatutPaiement    = 'a_venir' | 'paye' | 'en_retard'
export type MoyenPaiement     = 'mobile_money' | 'carte' | 'virement'
export type Operateur         = 'orange' | 'mtn' | 'moov' | 'wave' | 'autre'
export type TypeDocument      = 'provisoire' | 'acd' | 'autre'
export type StatutDocument    = 'actif' | 'revoque'
export type TypeNotification  =
  | 'paiement_recu' | 'relance' | 'resiliation'
  | 'kyc_valide' | 'kyc_refuse'
  | 'titre_disponible' | 'reservation_expiree'
  | 'contrat_signe' | 'bienvenue'
export type CanalNotification    = 'sms' | 'email' | 'app'
export type StatutNotification   = 'envoye' | 'echoue' | 'en_attente'
export type StatutCredit         = 'actif' | 'epuise'

// ============================================================
// PAGE (navigation interne — pas de routing Next.js)
// ============================================================

export type Page = 'accueil' | 'catalogue' | 'detail' | 'client' | 'admin' | 'cgu' | 'verify'

// ============================================================
// INTERFACES MÉTIER
// ============================================================

/** Profil utilisateur — miroir de auth.users avec données métier */
export interface Profil {
  id: string
  nom_complet: string
  email: string
  telephone?: string
  pays_residence?: string
  type_profil: TypeProfil
  statut_kyc: StatutKyc
  is_admin: boolean
  is_super_admin: boolean
  derniere_connexion?: string
  created_at: string
}

/** Terrain — propriété à vendre en échelonné */
export interface Terrain {
  id: string
  reference: string
  nom: string
  description?: string
  localisation: string
  pays: string
  superficie: number           // m²
  prix_fcfa: number            // prix total en FCFA
  acompte_pct: number          // 20-30%
  duree_mois: number           // 1-36 mois (fixé par admin)
  statut: StatutTerrain
  statut_juridique?: string
  titre_foncier: boolean
  images: string[]             // URLs Supabase Storage
  video_url?: string
  latitude?: number
  longitude?: number
  admin_id?: string
  date_reservation?: string
  created_at: string
  updated_at: string
}

/** Dossier KYC soumis par le client */
export interface KYC {
  id: string
  profil_id: string
  document_type: 'cni' | 'passeport'
  document_url: string         // URL bucket kyc-documents (restreint)
  document_url2?: string       // verso CNI
  statut: StatutKyc
  motif_refus?: string
  admin_id?: string
  date_soumission: string
  date_decision?: string
  created_at: string
}

/** Contrat de vente signé */
export interface Contrat {
  id: string
  profil_id: string
  terrain_id: string
  prix_total: number           // FCFA — figé à la signature
  acompte_verse: number        // montant acompte payé
  duree_mois: number
  mensualite_montant: number   // (prix_total - acompte) / duree_mois
  jour_prelevement: number     // 1-28, invariable
  statut: StatutContrat
  date_signature: string
  date_fin_prevue: string
  date_resiliation?: string
  option_resiliation?: 'remboursement' | 'credit'
  date_limite_choix?: string   // J+30 après résiliation
  created_at: string
  updated_at: string
  // Jointures optionnelles
  profil?: Profil
  terrain?: Terrain
  paiements?: Paiement[]
}

/** Paiement acompte ou mensualité */
export interface Paiement {
  id: string
  contrat_id: string
  type: TypePaiement
  montant: number              // FCFA
  statut: StatutPaiement
  moyen?: MoyenPaiement
  operateur?: Operateur
  ref_transaction_api?: string // ID CinetPay/Paydunya — obligatoire si reçu
  date_echeance: string
  date_paiement?: string
  numero_relance: number       // 0, 1 ou 2
  date_derniere_relance?: string
  created_at: string
}

/** Document généré (provisoire ou ACD) */
export interface Document {
  id: string
  contrat_id: string
  type: TypeDocument
  numero_unique: string        // hash aléatoire — jamais séquentiel
  qr_code_hash: string         // pour portail vérification public
  url_fichier?: string         // URL Supabase Storage
  statut: StatutDocument
  visible_client: boolean
  genere_par: string           // admin_id
  date_generation: string
  created_at: string
}

/** Notification envoyée au client */
export interface Notification {
  id: string
  profil_id: string
  contrat_id?: string
  type: TypeNotification
  canal: CanalNotification
  message: string
  statut: StatutNotification
  lu: boolean
  date_envoi?: string
  created_at: string
}

/** Crédit issu d'une résiliation (Option B) */
export interface Credit {
  id: string
  profil_id: string
  contrat_origine_id: string
  montant_total: number
  montant_utilise: number
  montant_restant: number
  statut: StatutCredit
  created_at: string
  updated_at: string
}

/**
 * @deprecated Utilisé dans Admin.tsx et EspaceClient.tsx — sera remplacé par Contrat en Phase 5
 * Réservation provisoire (avant signature du contrat)
 */
export interface Reservation {
  id: string
  terrain_id: string
  client_id: string
  date_reservation: string
  montant_acompte: number
  statut: 'en_cours' | 'validee' | 'annulee'
  terrain?: Terrain
  created_at: string
}

/** Entrée du journal d'audit (super admin) */
export interface JournalAudit {
  id: string
  admin_id: string
  action: string
  entite_concernee: string
  entite_id: string
  motif: string                // obligatoire
  donnees_avant?: Record<string, unknown>
  donnees_apres?: Record<string, unknown>
  created_at: string
  // Jointure
  admin?: Profil
}

// ============================================================
// HELPERS MÉTIER
// ============================================================

/** Calcule le montant de l'acompte en FCFA */
export function calculerAcompte(prixFcfa: number, acomptePct: number): number {
  return Math.round(prixFcfa * acomptePct / 100)
}

/** Calcule la mensualité en FCFA */
export function calculerMensualite(prixFcfa: number, acomptePct: number, dureeMois: number): number {
  const acompte = calculerAcompte(prixFcfa, acomptePct)
  return Math.round((prixFcfa - acompte) / dureeMois)
}

/** Vérifie si un utilisateur peut réserver (KYC validé) */
export function peutReserver(profil: Profil | null): boolean {
  return profil !== null && profil.statut_kyc === 'valide'
}

/** Vérifie si une réservation a expiré (> 7 jours sans contrat) */
export function reservationExpiree(dateReservation: string): boolean {
  const diff = Date.now() - new Date(dateReservation).getTime()
  return diff > 7 * 24 * 60 * 60 * 1000
}

/** Calcule le remboursement partiel en cas de résiliation (Option A) */
export function calculerRemboursementResiliation(
  montantVerse: number,
  prixTotal: number
): number {
  const penalite = Math.round(prixTotal * 0.15) // 15% du prix total
  return Math.max(0, montantVerse - penalite)
}

// ============================================================
// DONNÉES MOCK (mode démo — désactivées en production)
// ============================================================

export const MOCK_TERRAINS: Terrain[] = [
  {
    id: '1', reference: 'KL-2024-001', nom: 'Villa Corniche',
    localisation: 'Dakar, Almadies', pays: 'Sénégal',
    superficie: 500, prix_fcfa: 15000000, acompte_pct: 20, duree_mois: 24,
    statut: 'dispo', titre_foncier: true,
    statut_juridique: 'Titre foncier enregistré',
    images: ['https://picsum.photos/seed/afr1/800/500', 'https://picsum.photos/seed/afr1b/800/500'],
    description: 'Magnifique terrain en bord de mer aux Almadies. Titre foncier disponible, accès eau et électricité, vue dégagée sur l\'océan Atlantique.',
    created_at: '2024-01-15T10:00:00Z', updated_at: '2024-01-15T10:00:00Z'
  },
  {
    id: '2', reference: 'KL-2024-002', nom: 'Résidence Cocody',
    localisation: 'Abidjan, Cocody', pays: "Côte d'Ivoire",
    superficie: 800, prix_fcfa: 22000000, acompte_pct: 25, duree_mois: 36,
    statut: 'reserve', titre_foncier: true,
    statut_juridique: 'Titre foncier enregistré',
    images: ['https://picsum.photos/seed/afr2/800/500'],
    description: 'Grand terrain dans le quartier résidentiel de Cocody. Environnement calme et verdoyant, à 5 min des commodités.',
    created_at: '2024-02-01T10:00:00Z', updated_at: '2024-02-01T10:00:00Z'
  },
  {
    id: '3', reference: 'KL-2024-003', nom: 'Domaine Almadies',
    localisation: 'Dakar, Ngor', pays: 'Sénégal',
    superficie: 1200, prix_fcfa: 35000000, acompte_pct: 20, duree_mois: 36,
    statut: 'dispo', titre_foncier: true,
    statut_juridique: 'Titre foncier enregistré',
    images: ['https://picsum.photos/seed/afr3/800/500', 'https://picsum.photos/seed/afr3b/800/500', 'https://picsum.photos/seed/afr3c/800/500'],
    description: 'Vaste domaine à Ngor, vue panoramique sur l\'océan. Parfait pour projet résidentiel de prestige ou complexe touristique.',
    created_at: '2024-02-15T10:00:00Z', updated_at: '2024-02-15T10:00:00Z'
  },
  {
    id: '4', reference: 'KL-2024-004', nom: 'Plateau Central',
    localisation: 'Lomé, Adidogomé', pays: 'Togo',
    superficie: 400, prix_fcfa: 8000000, acompte_pct: 20, duree_mois: 18,
    statut: 'dispo', titre_foncier: false,
    statut_juridique: 'ACD en cours',
    images: ['https://picsum.photos/seed/afr4/800/500'],
    description: 'Terrain bien situé au cœur de Lomé, à proximité des axes principaux, commerces et transports.',
    created_at: '2024-03-01T10:00:00Z', updated_at: '2024-03-01T10:00:00Z'
  },
  {
    id: '5', reference: 'KL-2024-005', nom: 'Cité Ouaga 2000',
    localisation: 'Ouagadougou, Ouaga 2000', pays: 'Burkina Faso',
    superficie: 600, prix_fcfa: 12000000, acompte_pct: 20, duree_mois: 24,
    statut: 'vendu', titre_foncier: true,
    statut_juridique: 'Titre foncier enregistré',
    images: ['https://picsum.photos/seed/afr5/800/500'],
    description: 'Terrain dans le quartier prisé de Ouaga 2000, toutes commodités à proximité.',
    created_at: '2024-03-15T10:00:00Z', updated_at: '2024-03-15T10:00:00Z'
  },
  {
    id: '6', reference: 'KL-2024-006', nom: 'Bord de Mer Fidjrossè',
    localisation: 'Cotonou, Fidjrossè', pays: 'Bénin',
    superficie: 350, prix_fcfa: 18000000, acompte_pct: 20, duree_mois: 30,
    statut: 'dispo', titre_foncier: true,
    statut_juridique: 'Titre foncier enregistré',
    images: ['https://picsum.photos/seed/afr6/800/500', 'https://picsum.photos/seed/afr6b/800/500'],
    description: 'Rare opportunité en bord de mer à Fidjrossè. Terrain viabilisé avec accès direct à la plage.',
    created_at: '2024-04-01T10:00:00Z', updated_at: '2024-04-01T10:00:00Z'
  },
  {
    id: '7', reference: 'KL-2024-007', nom: 'Golf Club Estate',
    localisation: 'Dakar, Fann', pays: 'Sénégal',
    superficie: 900, prix_fcfa: 28000000, acompte_pct: 25, duree_mois: 36,
    statut: 'dispo', titre_foncier: true,
    statut_juridique: 'Titre foncier enregistré',
    images: ['https://picsum.photos/seed/afr7/800/500'],
    description: 'Terrain d\'exception adjacent au Golf Club de Dakar. Prestige, calme et sécurité dans un environnement privilégié.',
    created_at: '2024-04-15T10:00:00Z', updated_at: '2024-04-15T10:00:00Z'
  },
  {
    id: '8', reference: 'KL-2024-008', nom: 'Vallée Verte',
    localisation: 'Abidjan, Yopougon', pays: "Côte d'Ivoire",
    superficie: 650, prix_fcfa: 10500000, acompte_pct: 20, duree_mois: 24,
    statut: 'dispo', titre_foncier: false,
    statut_juridique: 'ACD en cours',
    images: ['https://picsum.photos/seed/afr8/800/500'],
    description: 'Terrain spacieux dans un cadre naturel préservé, idéal pour projet familial avec jardin.',
    created_at: '2024-05-01T10:00:00Z', updated_at: '2024-05-01T10:00:00Z'
  },
]

export const MOCK_PROFIL: Profil = {
  id: 'demo-user-id',
  nom_complet: 'Kofi Mensah',
  email: 'kofi.mensah@example.com',
  telephone: '+225 07 00 00 00',
  pays_residence: "Côte d'Ivoire",
  type_profil: 'local',
  statut_kyc: 'valide',
  is_admin: false,
  is_super_admin: false,
  created_at: '2024-01-01T00:00:00Z',
}

export const MOCK_CONTRATS: Contrat[] = [
  {
    id: 'c1',
    profil_id: 'demo-user-id',
    terrain_id: '1',
    prix_total: 15000000,
    acompte_verse: 3000000,
    duree_mois: 24,
    mensualite_montant: 500000,
    jour_prelevement: 5,
    statut: 'actif',
    date_signature: '2024-03-01T10:00:00Z',
    date_fin_prevue: '2026-03-01',
    created_at: '2024-03-01T10:00:00Z',
    updated_at: '2024-03-01T10:00:00Z',
    terrain: undefined,
    paiements: [],
  }
]

export const MOCK_PAIEMENTS: Paiement[] = [
  { id: 'p0', contrat_id: 'c1', type: 'acompte', montant: 3000000, statut: 'paye', moyen: 'mobile_money', operateur: 'orange', ref_transaction_api: 'TXN-001', date_echeance: '2024-03-01', date_paiement: '2024-03-01T10:00:00Z', numero_relance: 0, created_at: '2024-03-01T10:00:00Z' },
  { id: 'p1', contrat_id: 'c1', type: 'mensualite', montant: 500000, statut: 'paye', moyen: 'mobile_money', operateur: 'orange', ref_transaction_api: 'TXN-002', date_echeance: '2024-04-05', date_paiement: '2024-04-04T10:00:00Z', numero_relance: 0, created_at: '2024-03-01T10:00:00Z' },
  { id: 'p2', contrat_id: 'c1', type: 'mensualite', montant: 500000, statut: 'paye', moyen: 'mobile_money', operateur: 'wave', ref_transaction_api: 'TXN-003', date_echeance: '2024-05-05', date_paiement: '2024-05-05T10:00:00Z', numero_relance: 0, created_at: '2024-03-01T10:00:00Z' },
  { id: 'p3', contrat_id: 'c1', type: 'mensualite', montant: 500000, statut: 'en_retard', date_echeance: '2024-06-05', numero_relance: 1, created_at: '2024-03-01T10:00:00Z' },
  { id: 'p4', contrat_id: 'c1', type: 'mensualite', montant: 500000, statut: 'a_venir', date_echeance: '2024-07-05', numero_relance: 0, created_at: '2024-03-01T10:00:00Z' },
]

export const MOCK_NOTIFICATIONS: Notification[] = [
  { id: 'n1', profil_id: 'demo-user-id', contrat_id: 'c1', type: 'paiement_recu', canal: 'app', message: 'Votre paiement de 500 000 FCFA a bien été reçu.', statut: 'envoye', lu: true, date_envoi: '2024-05-05T10:00:00Z', created_at: '2024-05-05T10:00:00Z' },
  { id: 'n2', profil_id: 'demo-user-id', contrat_id: 'c1', type: 'relance', canal: 'app', message: 'Votre mensualité de juin est en retard. Merci de régulariser.', statut: 'envoye', lu: false, date_envoi: '2024-06-07T08:00:00Z', created_at: '2024-06-07T08:00:00Z' },
  { id: 'n3', profil_id: 'demo-user-id', type: 'kyc_valide', canal: 'app', message: 'Votre KYC a été validé. Vous pouvez désormais réserver un terrain.', statut: 'envoye', lu: false, date_envoi: '2024-02-20T10:00:00Z', created_at: '2024-02-20T10:00:00Z' },
]
