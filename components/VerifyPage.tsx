'use client'

import { useState, useEffect } from 'react'
import { supabase, IS_DEMO, type Document as KloDoc } from '@/lib/supabase'
import { qrCodeUrl } from '@/lib/documents'

interface VerifyPageProps {
  hash: string
  onBack: () => void
}

type VerifyState = 'loading' | 'valid' | 'invalid' | 'revoked'

// Données mock pour la vérification en mode démo
const MOCK_VERIFY = {
  numero_unique: 'KLO-2024-DEMO1234',
  type: 'provisoire' as const,
  date_generation: '2024-03-01T10:00:00Z',
  statut: 'actif' as const,
  terrain: { nom: 'Villa Corniche', reference: 'KL-2024-001', localisation: 'Dakar, Almadies', pays: 'Sénégal' },
  clientNom: 'K. M***ah', // masqué par défaut
}

interface VerifyResult {
  numero_unique: string
  type: KloDoc['type']
  date_generation: string
  statut: KloDoc['statut']
  terrain: { nom: string; reference: string; localisation: string; pays: string }
  clientNom: string
}

export default function VerifyPage({ hash, onBack }: VerifyPageProps) {
  const [state, setState] = useState<VerifyState>('loading')
  const [result, setResult] = useState<VerifyResult | null>(null)

  useEffect(() => {
    verifyDocument()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash])

  async function verifyDocument() {
    setState('loading')

    if (IS_DEMO) {
      // Simulation 800ms
      await new Promise(r => setTimeout(r, 800))
      // Hash démo → valide, tout autre → invalide
      if (hash.length >= 16) {
        setResult(MOCK_VERIFY)
        setState('valid')
      } else {
        setState('invalid')
      }
      return
    }

    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          numero_unique, type, date_generation, statut,
          contrat:contrats(
            profil:profils(nom_complet),
            terrain:terrains(nom, reference, localisation, pays)
          )
        `)
        .eq('qr_code_hash', hash)
        .single()

      if (error || !data) {
        setState('invalid')
        return
      }

      if (data.statut === 'revoque') {
        setState('revoked')
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contrat = (data as any).contrat
      const nom: string = contrat?.profil?.nom_complet || 'Client KLô'
      // Masquer le nom (initiale + astérisques)
      const parts = nom.split(' ')
      const clientNom = parts.map((p: string) => p[0] + '***').join(' ')

      setResult({
        numero_unique: data.numero_unique,
        type: data.type,
        date_generation: data.date_generation,
        statut: data.statut,
        terrain: contrat?.terrain || { nom: '—', reference: '—', localisation: '—', pays: '—' },
        clientNom,
      })
      setState('valid')
    } catch {
      setState('invalid')
    }
  }

  const typeLabel: Record<KloDoc['type'], string> = {
    provisoire: 'Document provisoire de vente',
    acd:        'Attestation de Cession de Droits',
    autre:      'Document officiel',
  }

  return (
    <div style={{ paddingTop: 80, minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0d2b1f, #1a4a35)', padding: '48px 24px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 20 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Retour
          </button>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: 'white' }}>
            KL<span style={{ color: '#1D9E75' }}>ô</span> · Portail de vérification
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 8 }}>
            Authentification des documents officiels KLô Immobilier
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px' }}>

        {/* Chargement */}
        {state === 'loading' && (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>Vérification en cours...</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>Consultation de la base de données sécurisée KLô</div>
          </div>
        )}

        {/* Document valide */}
        {state === 'valid' && result && (
          <div>
            <div style={{
              background: '#f0fdf4', border: '2px solid #1D9E75', borderRadius: 16,
              padding: 32, marginBottom: 24, display: 'flex', gap: 20, alignItems: 'flex-start',
            }}>
              <div style={{ fontSize: 48, flexShrink: 0 }}>✅</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 20, color: '#166534', marginBottom: 4 }}>Document authentique</div>
                <p style={{ fontSize: 14, color: '#166534', lineHeight: 1.6 }}>
                  Ce document a été émis par KLô Immobilier et son authenticité est confirmée.
                </p>
              </div>
            </div>

            <div className="card" style={{ padding: 28, marginBottom: 20 }}>
              <div className="section-label" style={{ marginBottom: 16 }}>Informations du document</div>
              {[
                { label: 'Numéro unique',   val: result.numero_unique },
                { label: 'Type',            val: typeLabel[result.type] },
                { label: 'Date d\'émission', val: new Date(result.date_generation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) },
                { label: 'Statut',          val: result.statut === 'actif' ? '✓ Actif' : '✕ Révoqué' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                  <span style={{ color: 'var(--muted)' }}>{r.label}</span>
                  <span style={{ fontWeight: 600 }}>{r.val}</span>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: 28, marginBottom: 20 }}>
              <div className="section-label" style={{ marginBottom: 16 }}>Bien concerné</div>
              {[
                { label: 'Terrain',       val: result.terrain.nom },
                { label: 'Référence',     val: result.terrain.reference },
                { label: 'Localisation', val: `${result.terrain.localisation}, ${result.terrain.pays}` },
                { label: 'Acheteur',      val: result.clientNom },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                  <span style={{ color: 'var(--muted)' }}>{r.label}</span>
                  <span style={{ fontWeight: 600 }}>{r.val}</span>
                </div>
              ))}
            </div>

            <div style={{ padding: '14px 20px', background: 'var(--terra-light)', borderRadius: 12, fontSize: 13, color: 'var(--terra-dark)', display: 'flex', alignItems: 'center', gap: 10 }}>
              🔒 Vérification effectuée le {new Date().toLocaleString('fr-FR')} · Résultat non modifiable
            </div>
          </div>
        )}

        {/* Document invalide */}
        {state === 'invalid' && (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 12, color: '#dc2626' }}>
              Document non trouvé
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.7, maxWidth: 400, margin: '0 auto 24px' }}>
              Ce code QR ne correspond à aucun document officiel KLô.
              Il se peut que le document soit falsifié ou que le lien soit expiré.
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              Pour signaler une fraude : <strong style={{ color: 'var(--terra)' }}>securite@klo.immo</strong>
            </p>
          </div>
        )}

        {/* Document révoqué */}
        {state === 'revoked' && (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 12, color: '#d97706' }}>
              Document révoqué
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.7, maxWidth: 400, margin: '0 auto 24px' }}>
              Ce document a été révoqué par KLô Immobilier et n'est plus valide.
              Contactez votre conseiller pour obtenir le document mis à jour.
            </p>
          </div>
        )}

        {IS_DEMO && (
          <div style={{ marginTop: 20, padding: 14, background: 'var(--terra-light)', borderRadius: 10, fontSize: 12, color: 'var(--terra-dark)', textAlign: 'center' }}>
            Mode démo — tout QR code de ≥ 16 caractères est considéré valide.
          </div>
        )}
      </div>
    </div>
  )
}
