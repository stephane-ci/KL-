'use client'

import { useState, useEffect } from 'react'
import {
  supabase, IS_DEMO, calculerRemboursementResiliation,
  type Profil, type Contrat, type Paiement, type Terrain, type Document as KloDoc,
  MOCK_CONTRATS, MOCK_PAIEMENTS, MOCK_TERRAINS,
} from '@/lib/supabase'
import { qrCodeUrl } from '@/lib/documents'
import { formatPrice } from '@/lib/currency'
import KYCModal from '@/components/KYCModal'
import PaymentModal from '@/components/PaymentModal'

interface EspaceClientProps {
  profil: Profil
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

type Tab = 'contrats' | 'paiements' | 'profil'

type ContratAvecDetails = Contrat & { terrain: Terrain; paiements: Paiement[]; documents?: KloDoc[] }

// ── Données mock (mode démo) ─────────────────────────────────────────────────
const MOCK_DATA: ContratAvecDetails[] = MOCK_CONTRATS.map(c => ({
  ...c,
  terrain: MOCK_TERRAINS.find(t => t.id === c.terrain_id) ?? MOCK_TERRAINS[0],
  paiements: MOCK_PAIEMENTS.filter(p => p.contrat_id === c.id)
    .sort((a, b) => new Date(a.date_echeance).getTime() - new Date(b.date_echeance).getTime()),
}))

const PAYS_LIST = [
  'France', 'Belgique', 'Suisse', 'Canada', 'États-Unis', 'Royaume-Uni',
  'Allemagne', 'Espagne', 'Italie', 'Portugal',
  'Sénégal', "Côte d'Ivoire", 'Mali', 'Guinée', 'Cameroun', 'Congo',
  'Togo', 'Bénin', 'Burkina Faso', 'Niger', 'Gabon', 'Maroc', 'Tunisie', 'Algérie', 'Autre',
]

export default function EspaceClient({ profil, showToast }: EspaceClientProps) {
  const [tab, setTab] = useState<Tab>('contrats')
  const [contrats, setContrats] = useState<ContratAvecDetails[]>(MOCK_DATA)
  const [loading, setLoading] = useState(!IS_DEMO)
  const [editProfil, setEditProfil] = useState({
    nom_complet: profil.nom_complet,
    telephone: profil.telephone || '',
    pays_residence: profil.pays_residence || '',
    type_profil: profil.type_profil,
  })
  const [savingProfil, setSavingProfil] = useState(false)
  const [showKYC, setShowKYC] = useState(false)
  const [kycStatut, setKycStatut] = useState(profil.statut_kyc)
  const [paymentTarget, setPaymentTarget] = useState<{ paiement: Paiement; terrainNom: string } | null>(null)

  useEffect(() => {
    if (!IS_DEMO) fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase
      .from('contrats')
      .select('*, terrain:terrains(*), paiements(*), documents(*)')
      .eq('profil_id', profil.id)
      .order('created_at', { ascending: false })

    if (data) {
      const enriched: ContratAvecDetails[] = data.map((c: ContratAvecDetails) => ({
        ...c,
        paiements: (c.paiements ?? []).sort(
          (a: Paiement, b: Paiement) =>
            new Date(a.date_echeance).getTime() - new Date(b.date_echeance).getTime()
        ),
      }))
      setContrats(enriched)
    }
    setLoading(false)
  }

  function handlePaymentSuccess(paiementId: string) {
    // Mise à jour optimiste de l'état local (IS_DEMO + production post-redirect)
    setContrats(prev => prev.map(c => ({
      ...c,
      paiements: c.paiements.map(p =>
        p.id === paiementId
          ? { ...p, statut: 'paye' as const, date_paiement: new Date().toISOString() }
          : p
      ),
    })))
    setPaymentTarget(null)
    showToast('✓ Paiement enregistré avec succès !', 'success')
    // En production, rafraîchir les données depuis Supabase
    if (!IS_DEMO) fetchData()
  }

  async function handleChoixResiliation(contrat: ContratAvecDetails, choix: 'remboursement' | 'credit') {
    const montantVerse = contrat.paiements.filter(p => p.statut === 'paye').reduce((s, p) => s + p.montant, 0)
    const remboursement = calculerRemboursementResiliation(montantVerse, contrat.prix_total)

    if (!IS_DEMO) {
      const now = new Date().toISOString()

      if (choix === 'credit') {
        // Créer un crédit client
        await supabase.from('credits').insert({
          profil_id: profil.id,
          contrat_id: contrat.id,
          montant: montantVerse,
          motif: `Résiliation contrat ${contrat.terrain.nom} — Option crédit`,
          statut: 'actif',
          date_expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: now,
        })
      }

      // Mettre à jour le contrat : stocker le choix
      await supabase.from('contrats').update({
        choix_resiliation: choix,
        date_choix_resiliation: now,
      }).eq('id', contrat.id)

      // Notification
      await supabase.from('notifications').insert({
        profil_id: profil.id,
        contrat_id: contrat.id,
        type: choix === 'credit' ? 'paiement_recu' : 'resiliation',
        canal: 'app',
        message: choix === 'credit'
          ? `Votre crédit de ${new Intl.NumberFormat('fr-FR').format(montantVerse)} FCFA est disponible pour votre prochain achat.`
          : `Votre demande de remboursement de ${new Intl.NumberFormat('fr-FR').format(remboursement)} FCFA a été enregistrée.`,
        statut: 'envoye',
        lu: false,
        date_envoi: now,
      })
    }

    // Mise à jour locale
    setContrats(prev => prev.map(c =>
      c.id === contrat.id ? { ...c, choix_resiliation: choix } : c
    ))

    showToast(
      choix === 'credit'
        ? `Crédit de ${new Intl.NumberFormat('fr-FR').format(montantVerse)} FCFA activé ✓`
        : `Remboursement de ${new Intl.NumberFormat('fr-FR').format(remboursement)} FCFA demandé ✓`,
      'success'
    )
  }

  async function saveProfil() {
    setSavingProfil(true)
    if (!IS_DEMO) {
      const { error } = await supabase.from('profils').update({
        nom_complet: editProfil.nom_complet,
        telephone: editProfil.telephone || null,
        pays_residence: editProfil.pays_residence || null,
        type_profil: editProfil.type_profil,
      }).eq('id', profil.id)
      if (error) { showToast('Erreur lors de la sauvegarde', 'error'); setSavingProfil(false); return }
    }
    showToast('Profil mis à jour', 'success')
    setSavingProfil(false)
  }

  // ── Stats dashboard ──────────────────────────────────────────────────────────
  const totalPaye = contrats.reduce((sum, c) =>
    sum + c.paiements.filter(p => p.statut === 'paye').reduce((s, p) => s + p.montant, 0), 0)

  const prochainPaiement = contrats
    .flatMap(c => c.paiements.filter(p => p.statut === 'a_venir'))
    .sort((a, b) => new Date(a.date_echeance).getTime() - new Date(b.date_echeance).getTime())[0]

  const nbRetard = contrats.flatMap(c => c.paiements).filter(p => p.statut === 'en_retard').length

  // ── Rendu ────────────────────────────────────────────────────────────────────

  return (
    <>
      <div style={{ paddingTop: 80, minHeight: '100vh', background: 'var(--bg)' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #0d2b1f, #1a4a35)', padding: '48px 24px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div className="section-label" style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Tableau de bord</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 600, color: 'white', marginBottom: 8, letterSpacing: '-0.02em' }}>
              Bonjour, {profil.nom_complet.split(' ')[0]}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{profil.email}</p>
              {/* Badge KYC */}
              <span style={{
                padding: '3px 10px', borderRadius: 100, fontSize: 12, fontWeight: 500,
                background: kycStatut === 'valide' ? 'rgba(29,158,117,0.3)' : kycStatut === 'en_attente' ? 'rgba(245,158,11,0.3)' : 'rgba(220,38,38,0.3)',
                color: kycStatut === 'valide' ? '#6ee7b7' : kycStatut === 'en_attente' ? '#fde68a' : '#fca5a5',
                border: `1px solid ${kycStatut === 'valide' ? 'rgba(29,158,117,0.5)' : kycStatut === 'en_attente' ? 'rgba(245,158,11,0.5)' : 'rgba(220,38,38,0.5)'}`,
              }}>
                {kycStatut === 'valide' ? '✓ KYC validé' : kycStatut === 'en_attente' ? '⏳ KYC en cours' : kycStatut === 'refuse' ? '✕ KYC refusé' : '⚠ KYC requis'}
              </span>
              <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 12, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                {profil.type_profil === 'diaspora' ? '✈️ Diaspora' : '🌍 Résident local'}
              </span>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginTop: 32 }}>
              {[
                { label: 'Contrats actifs', val: contrats.filter(c => c.statut === 'actif').length, icon: '📄' },
                { label: 'Total payé', val: formatPrice(totalPaye, 'XOF'), icon: '💳' },
                { label: 'En retard', val: nbRetard, icon: '⚠️', alert: nbRetard > 0 },
                {
                  label: 'Prochain paiement',
                  val: prochainPaiement
                    ? new Date(prochainPaiement.date_echeance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                    : '—',
                  icon: '📅',
                },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px',
                  border: s.alert ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.1)',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: s.alert ? '#fca5a5' : 'white' }}>
                    {s.val}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 0 }}>
            {([
              { id: 'contrats',  label: '📄 Mes contrats' },
              { id: 'paiements', label: '💳 Mes paiements' },
              { id: 'profil',    label: '👤 Mon profil' },
            ] as { id: Tab; label: string }[]).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '16px 20px', fontSize: 14, fontFamily: 'var(--font-body)',
                color: tab === t.id ? 'var(--terra)' : 'var(--muted)',
                borderBottom: tab === t.id ? '2px solid var(--terra)' : '2px solid transparent',
                fontWeight: tab === t.id ? 600 : 400,
                transition: 'all 0.2s',
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

          {/* ── Onglet Contrats ──────────────────────────────────────────── */}
          {tab === 'contrats' && (
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>Chargement...
                </div>
              ) : contrats.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 80, color: 'var(--muted)' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
                  <div style={{ fontSize: 18, marginBottom: 8 }}>Aucun contrat</div>
                  <p style={{ fontSize: 14 }}>Explorez le catalogue et réservez votre premier terrain.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {contrats.map(c => {
                    const mensualitesPaye = c.paiements.filter(p => p.type === 'mensualite' && p.statut === 'paye').length
                    const pct = c.duree_mois > 0 ? (mensualitesPaye / c.duree_mois) * 100 : 0
                    const retard = c.paiements.filter(p => p.statut === 'en_retard').length
                    const acomptePaye = c.paiements.find(p => p.type === 'acompte' && p.statut === 'paye')
                    const totalVerseCalc = c.paiements
                      .filter(p => p.statut === 'paye')
                      .reduce((s, p) => s + p.montant, 0)

                    return (
                      <div key={c.id} className="card" style={{ padding: 24 }}>
                        {/* En-tête */}
                        <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
                          {c.terrain.images[0] && (
                            <img
                              src={c.terrain.images[0]} alt={c.terrain.nom}
                              style={{ width: 100, height: 75, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }}
                            />
                          )}
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>
                                {c.terrain.nom}
                              </h3>
                              <span className={`badge ${c.statut === 'actif' ? 'badge-dispo' : c.statut === 'solde' ? 'badge-reserve' : 'badge-vendu'}`}>
                                {c.statut === 'actif' ? '✓ Actif' : c.statut === 'solde' ? '🏆 Soldé' : '✕ Résilié'}
                              </span>
                              {retard > 0 && (
                                <span className="badge badge-vendu">⚠️ {retard} en retard</span>
                              )}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
                              📍 {c.terrain.localisation} · Réf : {c.terrain.reference}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                              Signé le {new Date(c.date_signature).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>Total versé</div>
                            <div style={{ fontWeight: 700, color: 'var(--terra)', fontSize: 17 }}>
                              {formatPrice(totalVerseCalc, 'XOF')}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                              sur {formatPrice(c.prix_total, 'XOF')}
                            </div>
                          </div>
                        </div>

                        {/* Détails contrat */}
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                          {[
                            { label: 'Mensualité', val: formatPrice(c.mensualite_montant, 'XOF') + '/mois' },
                            { label: 'Prélèvement', val: `Le ${c.jour_prelevement} du mois` },
                            { label: 'Fin prévue', val: new Date(c.date_fin_prevue).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) },
                            { label: 'Acompte', val: acomptePaye ? '✅ Versé' : '⏳ À verser' },
                          ].map(item => (
                            <div key={item.label} style={{
                              flex: '1 1 100px', padding: '10px 14px',
                              background: 'var(--bg)', borderRadius: 8, minWidth: 100,
                            }}>
                              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{item.label}</div>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{item.val}</div>
                            </div>
                          ))}
                        </div>

                        {/* CTA acompte non versé */}
                        {!acomptePaye && (() => {
                          const acomptePmt = c.paiements.find(p => p.type === 'acompte')
                          return acomptePmt ? (
                            <div style={{
                              marginBottom: 16, padding: '12px 16px',
                              background: '#fffbeb', border: '1px solid #fde68a',
                              borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                            }}>
                              <div style={{ fontSize: 13, color: '#d97706' }}>
                                ⚠️ <strong>Acompte non versé</strong> — {formatPrice(acomptePmt.montant, 'XOF')} à régler pour activer votre contrat.
                              </div>
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: 13, padding: '8px 16px', whiteSpace: 'nowrap' }}
                                onClick={() => setPaymentTarget({ paiement: acomptePmt, terrainNom: c.terrain.nom })}
                              >
                                Payer l'acompte →
                              </button>
                            </div>
                          ) : null
                        })()}

                        {/* Barre de progression */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                            <span>Progression des mensualités</span>
                            <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                              {mensualitesPaye}/{c.duree_mois} mensualités payées
                            </span>
                          </div>
                          <div className="progress-track">
                            <div className="progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, textAlign: 'right' }}>
                            {Math.round(pct)}% remboursé
                          </div>
                        </div>

                        {/* Documents disponibles */}
                        {c.documents && c.documents.filter(d => d.visible_client && d.statut === 'actif').length > 0 && (
                          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                              📜 Documents disponibles
                            </div>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              {c.documents.filter(d => d.visible_client && d.statut === 'actif').map(d => (
                                <a
                                  key={d.id}
                                  href={`?verify=${d.qr_code_hash}`}
                                  target="_blank" rel="noopener noreferrer"
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                                    background: 'var(--terra-light)', borderRadius: 8, textDecoration: 'none',
                                    border: '1px solid var(--terra)', color: 'var(--terra-dark)',
                                    fontSize: 13, fontWeight: 500,
                                  }}
                                >
                                  {d.type === 'acd' ? '🏆' : '📄'}
                                  {d.type === 'acd' ? 'ACD' : 'Doc. provisoire'}
                                  <span style={{ fontSize: 11, opacity: 0.7 }}>· {d.numero_unique}</span>
                                  <img
                                    src={qrCodeUrl(d.qr_code_hash)}
                                    alt="QR"
                                    style={{ width: 28, height: 28, borderRadius: 4 }}
                                  />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Choix résiliation */}
                        {c.statut === 'resilie' && (() => {
                          const montantVerse = totalVerseCalc
                          const remboursement = calculerRemboursementResiliation(montantVerse, c.prix_total)
                          const dateLimit = c.date_limite_choix ? new Date(c.date_limite_choix) : null
                          const expired = dateLimit ? dateLimit < new Date() : false
                          const choixFait = (c as ContratAvecDetails & { choix_resiliation?: string }).choix_resiliation

                          if (choixFait) {
                            return (
                              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                                <div style={{ padding: '14px 18px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, fontSize: 13, color: '#166534' }}>
                                  ✓ <strong>Choix enregistré :</strong>{' '}
                                  {choixFait === 'credit'
                                    ? `Crédit de ${new Intl.NumberFormat('fr-FR').format(montantVerse)} FCFA disponible pour votre prochain achat.`
                                    : `Remboursement de ${new Intl.NumberFormat('fr-FR').format(remboursement)} FCFA en cours de traitement.`}
                                </div>
                              </div>
                            )
                          }

                          return (
                            <div style={{ marginTop: 16, borderTop: '1px solid #fecaca', paddingTop: 14 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 12 }}>
                                ⚠️ Contrat résilié — Choisissez votre option
                                {dateLimit && !expired && (
                                  <span style={{ fontSize: 11, fontWeight: 400, color: '#d97706', marginLeft: 8 }}>
                                    (avant le {dateLimit.toLocaleDateString('fr-FR')})
                                  </span>
                                )}
                              </div>

                              {expired ? (
                                <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626' }}>
                                  Le délai de 30 jours est dépassé. Contactez-nous pour traiter votre dossier.
                                </div>
                              ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                  {/* Option A : Remboursement */}
                                  <div style={{ padding: '16px 18px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#d97706', marginBottom: 6 }}>Option A — Remboursement</div>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                                      {new Intl.NumberFormat('fr-FR').format(remboursement)} FCFA
                                    </div>
                                    <div style={{ fontSize: 12, color: '#d97706', marginBottom: 14, lineHeight: 1.5 }}>
                                      Versé sur votre compte après déduction de la pénalité de 15%.
                                    </div>
                                    <button
                                      onClick={() => handleChoixResiliation(c, 'remboursement')}
                                      style={{ width: '100%', padding: '9px', background: '#d97706', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)' }}
                                    >
                                      Choisir A →
                                    </button>
                                  </div>

                                  {/* Option B : Crédit */}
                                  <div style={{ padding: '16px 18px', background: 'var(--terra-light)', border: '1px solid var(--terra)', borderRadius: 12 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--terra)', marginBottom: 6 }}>Option B — Crédit KLô ⭐</div>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--terra-dark)', marginBottom: 4 }}>
                                      {new Intl.NumberFormat('fr-FR').format(montantVerse)} FCFA
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--terra)', marginBottom: 14, lineHeight: 1.5 }}>
                                      Montant intégral utilisable pour un futur achat (sans pénalité).
                                    </div>
                                    <button
                                      onClick={() => handleChoixResiliation(c, 'credit')}
                                      style={{ width: '100%', padding: '9px', background: 'var(--terra)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)' }}
                                    >
                                      Choisir B →
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Onglet Paiements ─────────────────────────────────────────── */}
          {tab === 'paiements' && (
            <div>
              {contrats.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 80, color: 'var(--muted)' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>💳</div>
                  <div style={{ fontSize: 18 }}>Aucun paiement</div>
                </div>
              ) : (
                contrats.map(c => (
                  <div key={c.id} style={{ marginBottom: 36 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>
                        {c.terrain.nom}
                        <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted)', marginLeft: 10 }}>
                          {c.terrain.reference}
                        </span>
                      </h3>
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                        Prélèvement le <strong>{c.jour_prelevement}</strong> · Mensualité{' '}
                        <strong>{formatPrice(c.mensualite_montant, 'XOF')}</strong>
                      </div>
                    </div>

                    <div className="card" style={{ overflow: 'hidden' }}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                              {['#', 'Type', 'Échéance', 'Montant', 'Statut', 'Payé le', ''].map(h => (
                                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {c.paiements.map((p, i) => (
                              <tr key={p.id} style={{
                                borderBottom: '1px solid var(--border)',
                                background: p.statut === 'en_retard' ? 'rgba(239,68,68,0.04)' : 'transparent',
                              }}>
                                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>
                                  {p.type === 'acompte' ? '—' : i}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{
                                    fontSize: 12, fontWeight: 600,
                                    color: p.type === 'acompte' ? 'var(--terra)' : 'var(--text)',
                                  }}>
                                    {p.type === 'acompte' ? 'Acompte' : 'Mensualité'}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: 14, whiteSpace: 'nowrap' }}>
                                  {new Date(p.date_echeance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  {formatPrice(p.montant, 'XOF')}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span className={`badge ${p.statut === 'paye' ? 'badge-dispo' : p.statut === 'en_retard' ? 'badge-vendu' : 'badge-reserve'}`}>
                                    {p.statut === 'paye' ? '✓ Payé' : p.statut === 'en_retard' ? '⚠ En retard' : '⏳ À venir'}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                                  {p.date_paiement
                                    ? new Date(p.date_paiement).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                                    : '—'}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  {(p.statut === 'a_venir' || p.statut === 'en_retard') && (
                                    <button
                                      className="btn btn-primary"
                                      style={{ fontSize: 12, padding: '6px 14px', whiteSpace: 'nowrap' }}
                                      onClick={() => setPaymentTarget({ paiement: p, terrainNom: c.terrain.nom })}
                                    >
                                      Payer
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Onglet Profil ────────────────────────────────────────────── */}
          {tab === 'profil' && (
            <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Bannière KYC */}
              {kycStatut !== 'valide' && (
                <div style={{
                  padding: '16px 20px', borderRadius: 12,
                  background: kycStatut === 'refuse' ? '#fef2f2' : kycStatut === 'en_attente' ? '#fffbeb' : '#f0fdf4',
                  border: `1px solid ${kycStatut === 'refuse' ? '#fecaca' : kycStatut === 'en_attente' ? '#fde68a' : '#bbf7d0'}`,
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                }}>
                  <span style={{ fontSize: 24, flexShrink: 0 }}>
                    {kycStatut === 'refuse' ? '❌' : kycStatut === 'en_attente' ? '⏳' : '📋'}
                  </span>
                  <div>
                    <div style={{
                      fontWeight: 600, fontSize: 14, marginBottom: 4,
                      color: kycStatut === 'refuse' ? '#dc2626' : kycStatut === 'en_attente' ? '#d97706' : '#166534',
                    }}>
                      {kycStatut === 'refuse' ? 'KYC refusé — soumettez à nouveau' :
                       kycStatut === 'en_attente' ? 'KYC en cours de vérification' :
                       'Vérification KYC requise pour réserver'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                      {kycStatut === 'refuse'
                        ? 'Votre document a été refusé. Soumettez une CNI ou un passeport valide.'
                        : kycStatut === 'en_attente'
                        ? 'Votre document est en cours de vérification (24-48h). Vous serez notifié.'
                        : "Soumettez une pièce d'identité (CNI ou passeport) pour réserver un terrain."}
                    </div>
                    {(kycStatut === 'non_soumis' || kycStatut === 'refuse') && (
                      <button
                        className="btn btn-primary"
                        style={{ marginTop: 12, fontSize: 13, padding: '8px 16px' }}
                        onClick={() => setShowKYC(true)}
                      >
                        Soumettre mon KYC →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Formulaire profil */}
              <div className="card" style={{ padding: 32 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Mon profil</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label className="label">Nom complet</label>
                    <input className="input" value={editProfil.nom_complet}
                      onChange={e => setEditProfil(v => ({ ...v, nom_complet: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input className="input" value={profil.email} disabled style={{ opacity: 0.6 }} />
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>L'email ne peut pas être modifié ici.</p>
                  </div>
                  <div>
                    <label className="label">Téléphone</label>
                    <input className="input" type="tel" placeholder="+33 6 12 34 56 78"
                      value={editProfil.telephone}
                      onChange={e => setEditProfil(v => ({ ...v, telephone: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Pays de résidence</label>
                    <select className="input" value={editProfil.pays_residence}
                      onChange={e => setEditProfil(v => ({ ...v, pays_residence: e.target.value }))}>
                      <option value="">Sélectionnez un pays</option>
                      {PAYS_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Type de compte</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {([
                        { val: 'local', label: '🌍 Résident local' },
                        { val: 'diaspora', label: '✈️ Diaspora' },
                      ] as const).map(opt => (
                        <div key={opt.val}
                          onClick={() => setEditProfil(v => ({ ...v, type_profil: opt.val }))}
                          style={{
                            flex: 1, padding: '10px', borderRadius: 8, textAlign: 'center', cursor: 'pointer',
                            border: `2px solid ${editProfil.type_profil === opt.val ? 'var(--terra)' : 'var(--border)'}`,
                            background: editProfil.type_profil === opt.val ? 'var(--terra-light)' : 'transparent',
                            fontSize: 13, fontWeight: editProfil.type_profil === opt.val ? 600 : 400,
                            color: editProfil.type_profil === opt.val ? 'var(--terra)' : 'var(--text)',
                          }}>
                          {opt.label}
                        </div>
                      ))}
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={saveProfil} disabled={savingProfil} style={{ marginTop: 8 }}>
                    {savingProfil ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
                  </button>
                </div>
              </div>

              {/* Sécurité */}
              <div className="card" style={{ padding: 24, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 20 }}>🔒</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Sécurité du compte</div>
                  <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 12 }}>
                    Pour modifier votre mot de passe, déconnectez-vous et utilisez «Mot de passe oublié».
                  </p>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Compte créé le {new Date(profil.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {paymentTarget && (
        <PaymentModal
          paiement={paymentTarget.paiement}
          terrainNom={paymentTarget.terrainNom}
          profil={profil}
          onClose={() => setPaymentTarget(null)}
          onSuccess={handlePaymentSuccess}
          showToast={showToast}
        />
      )}

      {/* KYC Modal */}
      {showKYC && (
        <KYCModal
          profil={profil}
          onClose={() => setShowKYC(false)}
          onSuccess={() => {
            setKycStatut('en_attente')
            showToast('Dossier KYC envoyé — vérification sous 24-48h', 'success')
          }}
          showToast={showToast}
        />
      )}
    </>
  )
}
