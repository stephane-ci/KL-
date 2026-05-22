'use client'

import { useState } from 'react'
import { type Terrain, type Profil, peutReserver } from '@/lib/supabase'
import { formatPrice, convertPrice, CURRENCIES } from '@/lib/currency'
import { ReservationModal } from './LoginModal'

interface TerrainDetailProps {
  terrain: Terrain
  profil: Profil | null
  onBack: () => void
  onLoginRequired: () => void
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function TerrainDetail({ terrain, profil, onBack, onLoginRequired, showToast }: TerrainDetailProps) {
  const [imgIndex, setImgIndex] = useState(0)
  const [currency, setCurrency] = useState('XOF')
  const [showReservation, setShowReservation] = useState(false)
  const [showKycAlert, setShowKycAlert] = useState(false)

  // Calculs avec acompte_pct dynamique (20-30%, fixé par l'admin)
  const prix       = convertPrice(terrain.prix_fcfa, currency)
  const acomptePct = terrain.acompte_pct / 100
  const acompte    = prix * acomptePct
  const reste      = prix * (1 - acomptePct)
  const mensualite = reste / terrain.duree_mois

  function handleReserver() {
    if (!profil) { onLoginRequired(); return }
    if (terrain.statut !== 'dispo') { showToast('Ce terrain n\'est plus disponible', 'error'); return }
    if (!peutReserver(profil)) {
      setShowKycAlert(true)
      return
    }
    setShowReservation(true)
  }

  return (
    <div style={{ paddingTop: 80, minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Back */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 0' }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
          color: 'var(--muted)', fontSize: 14, fontFamily: 'var(--font-body)',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Retour au catalogue
        </button>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: 40 }} className="detail-grid">

          {/* ── Gauche : galerie + infos ─────────────────────── */}
          <div>
            {/* Image principale */}
            <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 12, aspectRatio: '4/3', background: '#E8E4DC' }}>
              <img
                src={terrain.images[imgIndex]}
                alt={terrain.nom}
                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.3s' }}
              />
            </div>

            {/* Miniatures */}
            {terrain.images.length > 1 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {terrain.images.map((img, i) => (
                  <button key={i} onClick={() => setImgIndex(i)} style={{
                    width: 80, height: 60, borderRadius: 8, overflow: 'hidden',
                    border: i === imgIndex ? '2px solid var(--terra)' : '2px solid transparent',
                    cursor: 'pointer', flexShrink: 0, padding: 0, background: 'none',
                    transition: 'border-color 0.2s',
                  }}>
                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="card" style={{ padding: 24, marginTop: 24 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Description</h3>
              <p style={{ color: 'var(--muted)', lineHeight: 1.8, fontSize: 15 }}>{terrain.description}</p>
            </div>

            {/* Vidéo */}
            {terrain.video_url && (
              <div className="card" style={{ padding: 24, marginTop: 16 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, marginBottom: 14 }}>
                  🎬 Vidéo du terrain
                </h3>
                <video
                  src={terrain.video_url}
                  controls playsInline
                  style={{ width: '100%', borderRadius: 10, maxHeight: 280, background: '#000', display: 'block' }}
                />
              </div>
            )}

            {/* Caractéristiques */}
            <div className="card" style={{ padding: 24, marginTop: 16 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Caractéristiques</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                {[
                  { label: 'Superficie', val: `${terrain.superficie.toLocaleString('fr-FR')} m²` },
                  { label: 'Localisation', val: terrain.localisation },
                  { label: 'Pays', val: terrain.pays },
                  { label: 'Référence', val: terrain.reference },
                  { label: 'Statut juridique', val: terrain.statut_juridique ?? (terrain.titre_foncier ? 'Titre foncier' : 'À vérifier') },
                  { label: 'Titre foncier', val: terrain.titre_foncier ? '✅ Inclus' : '⚠️ Non inclus' },
                  { label: 'Durée paiement', val: `${terrain.duree_mois} mois` },
                  { label: 'Acompte requis', val: `${terrain.acompte_pct}%` },
                ].map(spec => (
                  <div key={spec.label} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)', paddingRight: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{spec.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{spec.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Droite : prix + réservation ──────────────────── */}
          <div>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                <span className={`badge badge-${terrain.statut}`}>
                  {terrain.statut === 'dispo' ? '✓ Disponible' : terrain.statut === 'reserve' ? '⏳ Réservé' : '✗ Vendu'}
                </span>
                {terrain.titre_foncier && <span className="badge badge-dispo">📜 Titre foncier</span>}
                {terrain.statut_juridique && (
                  <span className="badge" style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                    {terrain.statut_juridique}
                  </span>
                )}
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 600, marginBottom: 6, letterSpacing: '-0.02em' }}>
                {terrain.nom}
              </h1>
              <div style={{ color: 'var(--muted)', fontSize: 15 }}>📍 {terrain.localisation}, {terrain.pays}</div>
            </div>

            {/* Sélecteur devise */}
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
              <label className="label">Afficher le prix en</label>
              <select className="input" value={currency} onChange={e => setCurrency(e.target.value)}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.symbol})</option>)}
              </select>
            </div>

            {/* Simulation paiement */}
            <div className="card" style={{ padding: 24, marginBottom: 20 }}>
              <div className="section-label" style={{ marginBottom: 20 }}>Simulation de paiement</div>

              {/* Prix total */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ color: 'var(--muted)', fontSize: 14 }}>Prix total</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600 }}>
                    {formatPrice(prix, currency)}
                  </span>
                </div>
              </div>

              {/* Acompte + mensualités */}
              <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Acompte ({terrain.acompte_pct}%)</div>
                    <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--terra)' }}>
                      {formatPrice(acompte, currency)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Puis {terrain.duree_mois} mensualités</div>
                    <div style={{ fontWeight: 700, fontSize: 20 }}>
                      {formatPrice(mensualite, currency)}
                      <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}>/mois</span>
                    </div>
                  </div>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${terrain.acompte_pct}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                  <span>Acompte {terrain.acompte_pct}%</span>
                  <span>Mensualités {100 - terrain.acompte_pct}%</span>
                </div>
              </div>

              {/* Plan des 6 premières mensualités */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Plan de paiement</div>
                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {Array.from({ length: Math.min(terrain.duree_mois, 6) }, (_, i) => {
                    const date = new Date()
                    date.setMonth(date.getMonth() + i + 1)
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                        <span style={{ color: 'var(--muted)' }}>Mensualité {i + 1} · {date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</span>
                        <span style={{ fontWeight: 500 }}>{formatPrice(mensualite, currency)}</span>
                      </div>
                    )
                  })}
                  {terrain.duree_mois > 6 && (
                    <div style={{ padding: '8px 0', textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
                      … et {terrain.duree_mois - 6} autres mensualités
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Alerte KYC */}
            {showKycAlert && profil && !peutReserver(profil) && (
              <div style={{
                padding: '16px 20px', borderRadius: 12, marginBottom: 16,
                background: profil.statut_kyc === 'en_attente' ? '#fffbeb' : '#fef2f2',
                border: `1px solid ${profil.statut_kyc === 'en_attente' ? '#fde68a' : '#fecaca'}`,
              }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4,
                  color: profil.statut_kyc === 'en_attente' ? '#d97706' : '#dc2626' }}>
                  {profil.statut_kyc === 'en_attente'
                    ? '⏳ KYC en cours de vérification'
                    : profil.statut_kyc === 'refuse'
                    ? '✕ KYC refusé — soumettez à nouveau'
                    : '🪪 Vérification d\'identité requise'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                  {profil.statut_kyc === 'en_attente'
                    ? 'Votre dossier est en cours de traitement (24-48h). Revenez bientôt !'
                    : 'Vous devez soumettre votre pièce d\'identité avant de réserver. Rendez-vous dans Mon espace.'}
                </div>
              </div>
            )}

            {/* CTA réservation */}
            <button
              className="btn btn-primary"
              onClick={handleReserver}
              disabled={terrain.statut !== 'dispo'}
              style={{ width: '100%', fontSize: 15, padding: '16px', marginBottom: 12 }}
            >
              {terrain.statut !== 'dispo'
                ? terrain.statut === 'reserve' ? '⏳ Terrain réservé' : '✗ Terrain vendu'
                : !profil
                ? '🔐 Connexion pour réserver'
                : !peutReserver(profil)
                ? '🪪 KYC requis pour réserver'
                : '🏠 Réserver ce terrain'}
            </button>

            {/* Sous-CTA informatif */}
            {!profil && terrain.statut === 'dispo' && (
              <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
                Créez un compte gratuitement pour réserver
              </p>
            )}
            {profil && !peutReserver(profil) && terrain.statut === 'dispo' && (
              <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
                Soumettez votre KYC dans{' '}
                <strong style={{ color: 'var(--terra)' }}>Mon espace → Mon profil</strong>
              </p>
            )}

            {/* Garanties */}
            <div style={{ marginTop: 16, padding: 16, background: 'var(--terra-light)', borderRadius: 12, fontSize: 13, color: 'var(--terra-dark)' }}>
              🔒 Paiement sécurisé · Titre foncier vérifié · Accompagnement inclus
            </div>
          </div>
        </div>
      </div>

      {/* Modal réservation */}
      {showReservation && profil && (
        <ReservationModal
          terrain={terrain}
          profil={profil}
          currency={currency}
          onClose={() => setShowReservation(false)}
          onSuccess={() => {
            setShowReservation(false)
            showToast('Réservation confirmée ! Vous serez contacté sous 24h.', 'success')
          }}
          showToast={showToast}
        />
      )}

      <style>{`
        @media (max-width: 768px) {
          .detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
