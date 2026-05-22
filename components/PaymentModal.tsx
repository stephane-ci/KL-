'use client'

import { useState } from 'react'
import { IS_DEMO, type Paiement, type Profil } from '@/lib/supabase'
import { formatPrice } from '@/lib/currency'
import { OPERATEURS, refVirement, type MoyenPaiementUI, type OperateurUI } from '@/lib/payment'

interface PaymentModalProps {
  paiement: Paiement
  terrainNom: string
  profil: Profil
  onClose: () => void
  onSuccess: (paiementId: string) => void
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function PaymentModal({
  paiement, terrainNom, profil, onClose, onSuccess, showToast
}: PaymentModalProps) {
  const [moyen, setMoyen]       = useState<MoyenPaiementUI>('mobile_money')
  const [operateur, setOperateur] = useState<OperateurUI>('orange')
  const [telephone, setTelephone] = useState(profil.telephone || '')
  const [loading, setLoading]   = useState(false)
  const [showVirement, setShowVirement] = useState(false)

  const isAcompte = paiement.type === 'acompte'
  const label = isAcompte
    ? 'Acompte'
    : `Mensualité · ${new Date(paiement.date_echeance).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`

  async function handlePayer() {
    if (moyen === 'virement') { setShowVirement(true); return }
    if (moyen === 'mobile_money' && !telephone.trim()) {
      showToast('Renseignez votre numéro de téléphone', 'error')
      return
    }
    setLoading(true)

    // ── Mode démo : simulation 1,5s ──────────────────────────────────────
    if (IS_DEMO) {
      await new Promise(r => setTimeout(r, 1500))
      setLoading(false)
      onSuccess(paiement.id)
      return
    }

    // ── Production : appel API init CinetPay ─────────────────────────────
    try {
      const res = await fetch('/api/payment/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paiement_id: paiement.id,
          montant: paiement.montant,
          description: `KLô — ${terrainNom} · ${label}`,
          client_nom: profil.nom_complet,
          client_email: profil.email,
          moyen,
          operateur: moyen === 'mobile_money' ? operateur : undefined,
          telephone: moyen === 'mobile_money' ? telephone : undefined,
          return_url: `${window.location.origin}?payment=success&tid=${paiement.id}`,
        }),
      })
      const data = await res.json()
      if (data.error) {
        showToast(data.error, 'error')
        setLoading(false)
        return
      }
      if (data.payment_url) {
        window.location.href = data.payment_url
        // ne pas setLoading(false) — la page va changer
        return
      }
      showToast('Erreur : URL de paiement non reçue', 'error')
    } catch {
      showToast('Erreur réseau. Réessayez.', 'error')
    }
    setLoading(false)
  }

  // ── Vue : instructions virement ─────────────────────────────────────────
  if (showVirement) {
    return (
      <div className="overlay-bg" onClick={onClose}>
        <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--muted)' }}>✕</button>

          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🏦</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600 }}>Virement bancaire</h2>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Effectuez votre virement avec ces coordonnées</p>
          </div>

          <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            {[
              { label: 'Banque',     val: 'Ecobank CI' },
              { label: 'Titulaire', val: 'KLô Immobilier SARL' },
              { label: 'IBAN',       val: 'CI123 4567 8901 2345 6789 01' },
              { label: 'BIC/SWIFT', val: 'ECOCCIAB' },
              { label: 'Montant',    val: formatPrice(paiement.montant, 'XOF') },
              { label: 'Référence obligatoire', val: refVirement(paiement.id) },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{r.label}</span>
                <span style={{
                  fontWeight: r.label === 'Référence obligatoire' || r.label === 'Montant' ? 700 : 500,
                  color: r.label === 'Référence obligatoire' ? 'var(--terra)' : 'var(--text)',
                  textAlign: 'right', marginLeft: 12,
                }}>
                  {r.val}
                </span>
              </div>
            ))}
          </div>

          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14, fontSize: 13, color: '#d97706', marginBottom: 20, lineHeight: 1.6 }}>
            ⚠️ La référence <strong>{refVirement(paiement.id)}</strong> est obligatoire pour que votre paiement soit identifié.
            Envoyez la preuve de virement à <strong>paiements@klo.immo</strong>.
          </div>

          <button className="btn btn-outline" onClick={onClose} style={{ width: '100%' }}>
            Fermer
          </button>
        </div>
      </div>
    )
  }

  // ── Vue : formulaire de paiement ────────────────────────────────────────
  return (
    <div className="overlay-bg" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--muted)' }}>✕</button>

        <div className="section-label" style={{ marginBottom: 8 }}>Paiement</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, marginBottom: 4 }}>{terrainNom}</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>{label}</p>

        {/* Montant */}
        <div style={{
          background: 'linear-gradient(135deg, var(--terra), #0d6b4e)',
          borderRadius: 12, padding: '18px 24px', marginBottom: 24,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>Montant à payer</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'white' }}>
              {formatPrice(paiement.montant, 'XOF')}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>Échéance</div>
            <div style={{ fontSize: 14, color: 'white', fontWeight: 500 }}>
              {new Date(paiement.date_echeance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            {paiement.statut === 'en_retard' && (
              <div style={{ fontSize: 12, color: '#fde68a', marginTop: 2 }}>⚠️ En retard</div>
            )}
          </div>
        </div>

        {/* Choix du moyen */}
        <div style={{ marginBottom: 20 }}>
          <label className="label" style={{ marginBottom: 10 }}>Moyen de paiement</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {([
              { val: 'mobile_money' as MoyenPaiementUI, icon: '📱', label: 'Mobile Money', desc: 'Orange, Wave, MTN, Moov' },
              { val: 'carte'        as MoyenPaiementUI, icon: '💳', label: 'Carte bancaire', desc: 'Visa, Mastercard — sécurisé' },
              { val: 'virement'     as MoyenPaiementUI, icon: '🏦', label: 'Virement bancaire', desc: 'Délai 2-3 jours ouvrés' },
            ]).map(opt => (
              <label key={opt.val} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                border: `2px solid ${moyen === opt.val ? 'var(--terra)' : 'var(--border)'}`,
                borderRadius: 10, cursor: 'pointer',
                background: moyen === opt.val ? 'var(--terra-light)' : 'transparent',
                transition: 'all 0.2s',
              }}>
                <input
                  type="radio" name="moyen" value={opt.val} checked={moyen === opt.val}
                  onChange={() => setMoyen(opt.val)}
                  style={{ accentColor: 'var(--terra)' }}
                />
                <span style={{ fontSize: 20 }}>{opt.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: moyen === opt.val ? 'var(--terra-dark)' : 'var(--text)' }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Champs Mobile Money */}
        {moyen === 'mobile_money' && (
          <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="label">Opérateur</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {OPERATEURS.map(op => (
                  <button
                    key={op.val} type="button"
                    onClick={() => setOperateur(op.val)}
                    style={{
                      padding: '10px 4px', borderRadius: 8, cursor: 'pointer',
                      border: `2px solid ${operateur === op.val ? 'var(--terra)' : 'var(--border)'}`,
                      background: operateur === op.val ? 'var(--terra-light)' : 'transparent',
                      textAlign: 'center', transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: 18 }}>{op.flag}</div>
                    <div style={{ fontSize: 10, fontWeight: operateur === op.val ? 700 : 400, color: operateur === op.val ? 'var(--terra)' : 'var(--text)', marginTop: 2 }}>
                      {op.label.split(' ')[0]}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Numéro Mobile Money</label>
              <input
                className="input" type="tel" placeholder="+225 07 00 00 00 00"
                value={telephone} onChange={e => setTelephone(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Info carte */}
        {moyen === 'carte' && (
          <div style={{
            background: 'var(--bg)', borderRadius: 10, padding: 14, marginBottom: 20,
            fontSize: 13, color: 'var(--muted)', lineHeight: 1.6,
          }}>
            💳 Vous serez redirigé vers la page de paiement sécurisée CinetPay.
            Votre carte bancaire (Visa, Mastercard) est acceptée.
          </div>
        )}

        {/* CTA */}
        <button
          className="btn btn-primary" onClick={handlePayer}
          disabled={loading} style={{ width: '100%', padding: '14px', fontSize: 15 }}
        >
          {loading
            ? (IS_DEMO ? '⏳ Simulation en cours...' : '⏳ Connexion à CinetPay...')
            : moyen === 'virement'
              ? '🏦 Voir les coordonnées bancaires'
              : moyen === 'carte'
                ? '💳 Payer par carte →'
                : `📱 Payer ${formatPrice(paiement.montant, 'XOF')} →`}
        </button>

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
          🔒 Paiement sécurisé · Certifié PCI DSS · Données chiffrées
        </div>

        {IS_DEMO && moyen !== 'virement' && (
          <div style={{ marginTop: 10, padding: 10, background: 'var(--terra-light)', borderRadius: 8, fontSize: 12, color: 'var(--terra-dark)', textAlign: 'center' }}>
            Mode démo — le paiement sera simulé instantanément.
          </div>
        )}
      </div>
    </div>
  )
}
