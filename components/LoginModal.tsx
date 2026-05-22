'use client'

import { useState } from 'react'
import { supabase, IS_DEMO, type Profil, type Terrain, type TypeProfil } from '@/lib/supabase'
import { formatPrice, convertPrice } from '@/lib/currency'

// ── Helpers ────────────────────────────────────────────────────────────────

const PAYS_LIST = [
  'France', 'Belgique', 'Suisse', 'Canada', 'États-Unis', 'Royaume-Uni',
  'Allemagne', 'Espagne', 'Italie', 'Portugal',
  'Sénégal', "Côte d'Ivoire", 'Mali', 'Guinée', 'Cameroun', 'Congo',
  'Togo', 'Bénin', 'Burkina Faso', 'Niger', 'Gabon', 'Madagascar',
  'Maroc', 'Tunisie', 'Algérie', 'Autre',
]

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0
  if (pw.length >= 8)  score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: 'Faible', color: '#dc2626' }
  if (score <= 2) return { score, label: 'Moyen', color: '#f59e0b' }
  if (score <= 3) return { score, label: 'Bon', color: '#3b82f6' }
  return { score, label: 'Fort', color: '#1D9E75' }
}

// ── LoginModal ─────────────────────────────────────────────────────────────

type AuthMode = 'login' | 'register' | 'forgot' | 'email-sent' | 'register-step2'

interface LoginModalProps {
  onClose: () => void
  onSuccess: (profil: Profil) => void
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function LoginModal({ onClose, onSuccess, showToast }: LoginModalProps) {
  const [mode, setMode] = useState<AuthMode>('login')

  // Champs communs
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  // Champs inscription — étape 1
  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [confirmPw, setConfirmPw] = useState('')

  // Champs inscription — étape 2
  const [paysResidence, setPaysResidence] = useState('')
  const [typeProfil, setTypeProfil] = useState<TypeProfil>('local')
  const [acceptCGU, setAcceptCGU] = useState(false)

  const pwStrength = passwordStrength(password)

  // ── Connexion ──────────────────────────────────────────────────────────

  async function handleLogin() {
    if (!email || !password) { showToast('Remplissez tous les champs', 'error'); return }
    setLoading(true)

    if (IS_DEMO) {
      const mockProfil: Profil = {
        id: 'demo-user', nom_complet: 'Utilisateur Démo', email,
        telephone: '+33 6 00 00 00 00', pays_residence: 'France',
        type_profil: 'diaspora', statut_kyc: 'valide',
        is_admin: email.includes('admin'), is_super_admin: email.includes('super'),
        created_at: new Date().toISOString(),
      }
      onSuccess(mockProfil)
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      showToast('Email ou mot de passe incorrect', 'error')
      setLoading(false)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Mettre à jour la dernière connexion
      await supabase.from('profils')
        .update({ derniere_connexion: new Date().toISOString() })
        .eq('id', user.id)

      const { data: profil } = await supabase.from('profils').select('*').eq('id', user.id).single()
      if (profil) onSuccess(profil)
    }
    setLoading(false)
  }

  // ── Inscription étape 1 → étape 2 ─────────────────────────────────────

  function goToStep2() {
    if (!nom.trim()) { showToast('Entrez votre nom complet', 'error'); return }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) { showToast('Email invalide', 'error'); return }
    if (password.length < 6) { showToast('Mot de passe trop court (6 caractères min)', 'error'); return }
    if (password !== confirmPw) { showToast('Les mots de passe ne correspondent pas', 'error'); return }
    setMode('register-step2')
  }

  // ── Inscription finale ─────────────────────────────────────────────────

  async function handleRegister() {
    if (!paysResidence) { showToast('Sélectionnez votre pays de résidence', 'error'); return }
    if (!acceptCGU) { showToast("Acceptez les conditions d'utilisation", 'error'); return }
    setLoading(true)

    if (IS_DEMO) {
      const mockProfil: Profil = {
        id: 'demo-user', nom_complet: nom, email, telephone,
        pays_residence: paysResidence, type_profil: typeProfil,
        statut_kyc: 'non_soumis', is_admin: false, is_super_admin: false,
        created_at: new Date().toISOString(),
      }
      onSuccess(mockProfil)
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: {
          nom_complet: nom,
          type_profil: typeProfil,
        }
      }
    })

    if (error) { showToast(error.message, 'error'); setLoading(false); return }

    if (data.user) {
      // Compléter le profil (le trigger crée la ligne de base)
      await supabase.from('profils').upsert({
        id: data.user.id,
        nom_complet: nom,
        email,
        telephone: telephone || null,
        pays_residence: paysResidence,
        type_profil: typeProfil,
        statut_kyc: 'non_soumis',
        is_admin: false,
        is_super_admin: false,
      })

      // Si Supabase requiert une confirmation email
      if (!data.session) {
        setMode('email-sent')
        setLoading(false)
        return
      }

      const { data: profil } = await supabase.from('profils').select('*').eq('id', data.user.id).single()
      if (profil) onSuccess(profil)
    }
    setLoading(false)
  }

  // ── Mot de passe oublié ────────────────────────────────────────────────

  async function handleForgotPassword() {
    if (!email || !/\S+@\S+\.\S+/.test(email)) { showToast('Entrez votre email', 'error'); return }
    setLoading(true)
    if (!IS_DEMO) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}?reset=true`,
      })
      if (error) { showToast(error.message, 'error'); setLoading(false); return }
    }
    setMode('email-sent')
    setLoading(false)
  }

  // ── Rendu ──────────────────────────────────────────────────────────────

  return (
    <div className="overlay-bg" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>

        {/* Close */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 18, color: 'var(--muted)', lineHeight: 1,
        }}>✕</button>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, color: 'var(--text)' }}>
            KL<span style={{ color: 'var(--terra)' }}>ô</span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>
            {mode === 'login' && 'Connectez-vous à votre espace'}
            {(mode === 'register' || mode === 'register-step2') && 'Créez votre compte KLô'}
            {mode === 'forgot' && 'Réinitialiser le mot de passe'}
            {mode === 'email-sent' && 'Vérifiez votre boîte mail'}
          </div>
        </div>

        {/* ── Email envoyé ────────────────────────────────────── */}
        {mode === 'email-sent' && (
          <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📧</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, marginBottom: 12 }}>
              Email envoyé !
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
              {IS_DEMO
                ? 'En production, un email vous serait envoyé.'
                : `Un email a été envoyé à ${email}. Suivez le lien pour continuer.`}
            </p>
            <button className="btn btn-outline" onClick={() => setMode('login')} style={{ width: '100%' }}>
              Retour à la connexion
            </button>
          </div>
        )}

        {/* ── Connexion ───────────────────────────────────────── */}
        {mode === 'login' && (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 10, padding: 4, marginBottom: 24 }}>
              {(['login', 'register'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  flex: 1, padding: '9px',
                  background: mode === m ? 'white' : 'transparent',
                  border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
                  fontFamily: 'var(--font-body)', fontWeight: mode === m ? 600 : 400,
                  color: mode === m ? 'var(--text)' : 'var(--muted)',
                  boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s',
                }}>
                  {m === 'login' ? 'Connexion' : 'Inscription'}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Email</label>
                <input
                  className="input" type="email" placeholder="email@exemple.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
              </div>

              <div>
                <label className="label">Mot de passe</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input" type={showPw ? 'text' : 'password'}
                    placeholder="••••••••" value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button" onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}
                  >
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
                <div style={{ textAlign: 'right', marginTop: 6 }}>
                  <button
                    type="button" onClick={() => setMode('forgot')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--terra)', textDecoration: 'underline' }}
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              </div>

              <button
                className="btn btn-primary" onClick={handleLogin} disabled={loading}
                style={{ marginTop: 4, padding: '13px' }}
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </div>
          </>
        )}

        {/* ── Inscription étape 1 ─────────────────────────────── */}
        {mode === 'register' && (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 10, padding: 4, marginBottom: 24 }}>
              {(['login', 'register'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  flex: 1, padding: '9px',
                  background: mode === m ? 'white' : 'transparent',
                  border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
                  fontFamily: 'var(--font-body)', fontWeight: mode === m ? 600 : 400,
                  color: mode === m ? 'var(--text)' : 'var(--muted)',
                  boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s',
                }}>
                  {m === 'login' ? 'Connexion' : 'Inscription'}
                </button>
              ))}
            </div>

            {/* Progress */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--terra)' }} />
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border)' }} />
              <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Étape 1/2</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Nom complet</label>
                <input className="input" placeholder="Aminata Diallo" value={nom} onChange={e => setNom(e.target.value)} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" placeholder="email@exemple.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="label">Téléphone <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optionnel)</span></label>
                <input className="input" type="tel" placeholder="+33 6 12 34 56 78" value={telephone} onChange={e => setTelephone(e.target.value)} />
              </div>
              <div>
                <label className="label">Mot de passe</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input" type={showPw ? 'text' : 'password'}
                    placeholder="••••••••" value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button" onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}
                  >
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
                {/* Indicateur force */}
                {password.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{
                          flex: 1, height: 3, borderRadius: 2,
                          background: i <= pwStrength.score ? pwStrength.color : 'var(--border)',
                          transition: 'background 0.3s',
                        }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: pwStrength.color, fontWeight: 500 }}>
                      {pwStrength.label}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className="label">Confirmer le mot de passe</label>
                <input
                  className="input" type="password" placeholder="••••••••"
                  value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                />
                {confirmPw.length > 0 && password !== confirmPw && (
                  <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>Les mots de passe ne correspondent pas</p>
                )}
              </div>

              <button
                className="btn btn-primary" onClick={goToStep2}
                style={{ marginTop: 4, padding: '13px' }}
              >
                Continuer →
              </button>
            </div>
          </>
        )}

        {/* ── Inscription étape 2 ─────────────────────────────── */}
        {mode === 'register-step2' && (
          <>
            {/* Progress */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--terra)' }} />
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--terra)' }} />
              <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Étape 2/2</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Pays de résidence */}
              <div>
                <label className="label">Pays de résidence</label>
                <select className="input" value={paysResidence} onChange={e => setPaysResidence(e.target.value)}>
                  <option value="">Sélectionnez un pays</option>
                  {PAYS_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* Type de profil */}
              <div>
                <label className="label">Vous êtes</label>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  {([
                    { val: 'local' as TypeProfil, label: '🌍 Résident local', desc: 'Je vis en Afrique' },
                    { val: 'diaspora' as TypeProfil, label: '✈️ Diaspora', desc: "Je vis à l'étranger" },
                  ]).map(opt => (
                    <button
                      key={opt.val} type="button"
                      onClick={() => setTypeProfil(opt.val)}
                      style={{
                        flex: 1, padding: '14px 10px', borderRadius: 10, cursor: 'pointer',
                        border: `2px solid ${typeProfil === opt.val ? 'var(--terra)' : 'var(--border)'}`,
                        background: typeProfil === opt.val ? 'var(--terra-light)' : 'transparent',
                        transition: 'all 0.2s', textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: typeProfil === opt.val ? 'var(--terra)' : 'var(--text)', marginBottom: 2 }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* CGU */}
              <div style={{
                background: 'var(--bg)', borderRadius: 10, padding: 14,
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <input
                  type="checkbox" id="cgu-register" checked={acceptCGU}
                  onChange={e => setAcceptCGU(e.target.checked)}
                  style={{ width: 16, height: 16, marginTop: 2, accentColor: 'var(--terra)', flexShrink: 0 }}
                />
                <label htmlFor="cgu-register" style={{ fontSize: 13, cursor: 'pointer', lineHeight: 1.5, color: 'var(--text)' }}>
                  J'ai lu et j'accepte les{' '}
                  <a href="#" style={{ color: 'var(--terra)' }}>conditions générales d'utilisation</a>
                  {' '}et la politique de confidentialité de KLô.
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-outline" onClick={() => setMode('register')}
                  style={{ flex: 1, padding: '12px' }}
                >
                  ← Retour
                </button>
                <button
                  className="btn btn-primary" onClick={handleRegister} disabled={loading || !acceptCGU}
                  style={{ flex: 2, padding: '12px' }}
                >
                  {loading ? 'Création...' : 'Créer mon compte'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Mot de passe oublié ─────────────────────────────── */}
        {mode === 'forgot' && (
          <>
            <button
              onClick={() => setMode('login')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Retour à la connexion
            </button>

            <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
              Entrez votre email. Vous recevrez un lien pour réinitialiser votre mot de passe.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Email</label>
                <input
                  className="input" type="email" placeholder="email@exemple.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleForgotPassword()}
                />
              </div>
              <button
                className="btn btn-primary" onClick={handleForgotPassword} disabled={loading}
                style={{ padding: '13px' }}
              >
                {loading ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
              </button>
            </div>
          </>
        )}

        {/* Mode demo */}
        {IS_DEMO && mode !== 'email-sent' && (
          <div style={{ marginTop: 16, padding: 12, background: 'var(--terra-light)', borderRadius: 8, fontSize: 12, color: 'var(--terra-dark)', textAlign: 'center' }}>
            Mode démo — entrez n'importe quel email/mot de passe.<br />
            Utilisez <strong>admin@</strong> pour l'administration, <strong>super@</strong> pour super admin.
          </div>
        )}

        {/* Lien CGU */}
        {(mode === 'login' || mode === 'forgot') && (
          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
            En vous connectant, vous acceptez nos{' '}
            <button style={{ background: 'none', border: 'none', color: 'var(--terra)', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>
              conditions générales
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── ReservationModal ────────────────────────────────────────────────────────

interface ReservationModalProps {
  terrain: Terrain
  profil: Profil
  currency: string
  onClose: () => void
  onSuccess: () => void
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export function ReservationModal({ terrain, profil, currency, onClose, onSuccess, showToast }: ReservationModalProps) {
  const [acceptCGV, setAcceptCGV] = useState(false)
  const [telephone, setTelephone] = useState(profil.telephone || '')
  const [jourPrelevement, setJourPrelevement] = useState(5)
  const [loading, setLoading] = useState(false)

  // Calculs financiers — acompte_pct fixé par l'admin (20-30%)
  const acomptePct    = terrain.acompte_pct / 100
  const acompte_fcfa  = Math.round(terrain.prix_fcfa * acomptePct)
  const mensualite_fcfa = Math.round((terrain.prix_fcfa - acompte_fcfa) / terrain.duree_mois)
  const prixConverti  = convertPrice(terrain.prix_fcfa, currency)
  const acompte       = prixConverti * acomptePct
  const mensualite    = prixConverti * (1 - acomptePct) / terrain.duree_mois

  async function handleConfirmer() {
    if (!acceptCGV)  { showToast('Acceptez les conditions générales', 'error'); return }
    if (!telephone)  { showToast('Renseignez votre téléphone', 'error'); return }
    setLoading(true)

    if (!IS_DEMO) {
      // 1. Mise à jour téléphone si modifié
      if (telephone !== profil.telephone) {
        await supabase.from('profils').update({ telephone }).eq('id', profil.id)
      }

      // 2. Créer le contrat
      const today = new Date()
      const dateFin = new Date(today)
      dateFin.setMonth(dateFin.getMonth() + terrain.duree_mois)

      const { data: contrat, error: contratError } = await supabase
        .from('contrats')
        .insert({
          profil_id: profil.id,
          terrain_id: terrain.id,
          prix_total: terrain.prix_fcfa,
          acompte_verse: acompte_fcfa,
          duree_mois: terrain.duree_mois,
          mensualite_montant: mensualite_fcfa,
          jour_prelevement: jourPrelevement,
          statut: 'actif',
          date_signature: today.toISOString(),
          date_fin_prevue: dateFin.toISOString().split('T')[0],
        })
        .select()
        .single()

      if (contratError || !contrat) {
        showToast('Erreur lors de la création du contrat', 'error')
        setLoading(false)
        return
      }

      // 3. Générer tous les paiements (acompte + mensualités)
      type PaiementInsert = {
        contrat_id: string; type: 'acompte' | 'mensualite'
        montant: number; statut: 'a_venir'; date_echeance: string; numero_relance: number
      }
      const paiements: PaiementInsert[] = [
        {
          contrat_id: contrat.id, type: 'acompte',
          montant: acompte_fcfa, statut: 'a_venir',
          date_echeance: today.toISOString().split('T')[0], numero_relance: 0,
        }
      ]
      for (let i = 0; i < terrain.duree_mois; i++) {
        const date = new Date(today)
        date.setMonth(date.getMonth() + i + 1)
        // Éviter les débordements de mois (ex: 31 → 28 février)
        const maxDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
        date.setDate(Math.min(jourPrelevement, maxDay))
        paiements.push({
          contrat_id: contrat.id, type: 'mensualite',
          montant: mensualite_fcfa, statut: 'a_venir',
          date_echeance: date.toISOString().split('T')[0], numero_relance: 0,
        })
      }
      await supabase.from('paiements').insert(paiements)

      // 4. Marquer le terrain réservé
      await supabase.from('terrains').update({
        statut: 'reserve',
        date_reservation: today.toISOString(),
      }).eq('id', terrain.id)

      // 5. Notification in-app
      await supabase.from('notifications').insert({
        profil_id: profil.id,
        contrat_id: contrat.id,
        type: 'contrat_signe',
        canal: 'app',
        message: `Votre contrat pour ${terrain.nom} a été créé. Veuillez verser l'acompte de ${formatPrice(acompte, currency)}.`,
        statut: 'en_attente',
        lu: false,
      })
    }

    setLoading(false)
    onSuccess()
  }

  // Jours disponibles (1–28 pour tous les mois)
  const jours = Array.from({ length: 28 }, (_, i) => i + 1)

  return (
    <div className="overlay-bg" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--muted)' }}>✕</button>

        <div className="section-label" style={{ marginBottom: 8 }}>Réservation · Création du contrat</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 24 }}>{terrain.nom}</h2>

        {/* Récapitulatif financier */}
        <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div className="section-label" style={{ marginBottom: 14 }}>Récapitulatif financier</div>
          {[
            { label: 'Prix total', val: formatPrice(prixConverti, currency), bold: false, color: undefined },
            { label: `Acompte (${terrain.acompte_pct}%) — à verser dès aujourd'hui`, val: formatPrice(acompte, currency), bold: true, color: 'var(--terra)' },
            { label: `${terrain.duree_mois} mensualités de`, val: `${formatPrice(mensualite, currency)}/mois`, bold: false, color: undefined },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
              <span style={{ color: 'var(--muted)' }}>{row.label}</span>
              <span style={{ fontWeight: row.bold ? 700 : 500, color: row.color || 'var(--text)' }}>{row.val}</span>
            </div>
          ))}
        </div>

        {/* Jour de prélèvement */}
        <div style={{ marginBottom: 20 }}>
          <label className="label">Jour de prélèvement mensuel</label>
          <select className="input" value={jourPrelevement} onChange={e => setJourPrelevement(Number(e.target.value))}>
            {jours.map(j => (
              <option key={j} value={j}>Le {j} de chaque mois</option>
            ))}
          </select>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
            Votre mensualité de <strong>{formatPrice(mensualite, currency)}</strong> sera due le <strong>{jourPrelevement}</strong> de chaque mois.
            Ce jour est figé pour toute la durée du contrat.
          </p>
        </div>

        {/* Téléphone */}
        <div style={{ marginBottom: 20 }}>
          <label className="label">Téléphone de contact</label>
          <input className="input" placeholder="+33 6 12 34 56 78" value={telephone} onChange={e => setTelephone(e.target.value)} />
        </div>

        {/* CGV */}
        <div style={{
          background: 'var(--bg)', borderRadius: 10, padding: 16, marginBottom: 16,
          maxHeight: 130, overflowY: 'auto', fontSize: 12, color: 'var(--muted)', lineHeight: 1.7,
        }}>
          <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 8 }}>Conditions Générales de Vente</strong>
          En confirmant cette réservation, vous créez un contrat de vente échelonné pour le terrain «{terrain.nom}».
          Vous vous engagez à verser l'acompte de {terrain.acompte_pct}% du prix total ({formatPrice(acompte, currency)})
          dans les 7 jours. Les {terrain.duree_mois} mensualités suivantes seront dues chaque mois le {jourPrelevement}.
          Tout retard de plus de 30 jours peut entraîner la résiliation du contrat.
          KLô garantit la légitimité des titres fonciers vérifiés. Le titre est remis après règlement complet.
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 24 }}>
          <input type="checkbox" id="cgv" checked={acceptCGV} onChange={e => setAcceptCGV(e.target.checked)}
            style={{ width: 16, height: 16, marginTop: 2, accentColor: 'var(--terra)', flexShrink: 0 }} />
          <label htmlFor="cgv" style={{ fontSize: 13, cursor: 'pointer', color: 'var(--text)', lineHeight: 1.5 }}>
            J'ai lu et j'accepte les conditions générales de vente et le plan de paiement.
          </label>
        </div>

        <button
          className="btn btn-primary" onClick={handleConfirmer}
          disabled={loading || !acceptCGV} style={{ width: '100%', padding: '14px' }}
        >
          {loading ? '⏳ Création du contrat...' : `🏠 Confirmer — Acompte ${formatPrice(acompte, currency)}`}
        </button>

        {IS_DEMO && (
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
            Mode démo — le contrat et les paiements sont simulés localement.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Toast ────────────────────────────────────────────────────────────────────

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
}

export function Toast({ message, type }: ToastProps) {
  const colors = {
    success: { bg: '#1D9E75', icon: '✓' },
    error:   { bg: '#dc2626', icon: '✕' },
    info:    { bg: '#1a4a35', icon: 'ℹ' },
  }
  const c = colors[type]
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: c.bg, color: 'white', padding: '12px 20px', borderRadius: 12,
      display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 500,
      boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 9999,
      animation: 'slideUp 0.3s ease', whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: '50%',
        background: 'rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
      }}>{c.icon}</span>
      {message}
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateX(-50%) translateY(12px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }`}</style>
    </div>
  )
}

// ── WAChat ────────────────────────────────────────────────────────────────────

export function WAChat() {
  return (
    <a
      href="https://wa.me/33600000000?text=Bonjour%20KLô%2C%20je%20suis%20intéressé%20par%20un%20terrain"
      target="_blank" rel="noopener noreferrer"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 40,
        width: 56, height: 56, borderRadius: '50%',
        background: '#25D366', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(37,211,102,0.4)',
        textDecoration: 'none', transition: 'transform 0.2s, box-shadow 0.2s', fontSize: 26,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(37,211,102,0.5)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(37,211,102,0.4)' }}
      title="Nous contacter sur WhatsApp"
    >
      <svg width="26" height="26" viewBox="0 0 26 26" fill="white">
        <path d="M13 1C6.373 1 1 6.373 1 13c0 2.226.58 4.314 1.594 6.12L1 25l6.106-1.563A11.94 11.94 0 0013 25c6.627 0 12-5.373 12-12S19.627 1 13 1zm0 21.818a9.782 9.782 0 01-5.004-1.373l-.357-.213-3.616.926.96-3.51-.235-.373A9.818 9.818 0 1113 22.818zm5.38-7.35c-.294-.148-1.74-.858-2.01-.955-.27-.098-.467-.147-.663.147-.197.295-.76.956-.933 1.153-.172.197-.344.222-.638.074-.294-.148-1.243-.458-2.368-1.46-.875-.78-1.465-1.745-1.637-2.04-.172-.294-.018-.453.13-.6.132-.132.294-.344.442-.516.147-.172.196-.295.294-.492.098-.197.049-.369-.025-.517-.074-.147-.663-1.599-.908-2.19-.24-.575-.482-.497-.663-.506l-.565-.01c-.196 0-.516.074-.786.369-.27.295-1.032 1.01-1.032 2.462 0 1.452 1.057 2.855 1.204 3.052.148.197 2.08 3.176 5.04 4.454.705.304 1.255.486 1.684.622.708.225 1.352.193 1.862.117.568-.084 1.74-.712 1.986-1.4.245-.687.245-1.275.172-1.4-.074-.123-.27-.197-.564-.344z"/>
      </svg>
    </a>
  )
}

// ── CGU ────────────────────────────────────────────────────────────────────────

interface CGUProps {
  onBack: () => void
}

export function CGU({ onBack }: CGUProps) {
  return (
    <div style={{ paddingTop: 80, minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Retour
        </button>

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 600, marginBottom: 8, letterSpacing: '-0.02em' }}>
          Conditions Générales d'Utilisation
        </h1>
        <p style={{ color: 'var(--muted)', marginBottom: 48, fontSize: 14 }}>Dernière mise à jour : janvier 2024</p>

        {[
          { titre: '1. Objet', contenu: "Les présentes Conditions Générales d'Utilisation (CGU) régissent l'utilisation de la plateforme KLô, dédiée à la mise en relation entre la diaspora africaine et des vendeurs de terrains en Afrique. En utilisant notre service, vous acceptez intégralement les présentes conditions." },
          { titre: '2. Services proposés', contenu: "KLô propose un service de présentation et de réservation de terrains situés en Afrique. Les terrains présentés disposent de titres fonciers vérifiés (lorsque mentionné). KLô facilite le paiement échelonné selon les modalités définies par l'administration." },
          { titre: "3. Inscription et compte utilisateur", contenu: "L'inscription est gratuite et ouverte à toute personne majeure. Vous êtes responsable de la confidentialité de vos identifiants. Toute activité réalisée depuis votre compte est sous votre responsabilité." },
          { titre: '4. Modalités de réservation et de paiement', contenu: "La réservation d'un terrain nécessite le versement d'un acompte dont le pourcentage est défini par terrain (entre 20% et 30% du prix total). Le solde est réglé en mensualités selon la durée définie. Tout retard de paiement supérieur à 30 jours peut entraîner la résiliation du contrat." },
          { titre: '5. Titre foncier', contenu: "KLô garantit la légitimité des titres fonciers pour les terrains mentionnés «Titre Foncier inclus». Le titre foncier est remis à l'acheteur après règlement intégral du prix de vente." },
          { titre: "6. KYC et vérification d'identité", contenu: "Pour réserver un terrain, vous devez soumettre un document d'identité (CNI ou passeport) pour vérification. Cette étape est obligatoire conformément à la réglementation BCEAO. Les documents sont traités de manière sécurisée et confidentielle." },
          { titre: '7. Protection des données', contenu: "Vos données personnelles sont traitées conformément à la réglementation ARTCI. Elles sont utilisées uniquement pour la gestion de votre compte et le suivi de vos réservations. Vous disposez d'un droit d'accès, de rectification et de suppression de vos données." },
          { titre: '8. Droit applicable', contenu: "Les présentes CGU sont régies par le droit ivoirien. En cas de litige, les parties s'engagent à rechercher une solution amiable avant tout recours judiciaire." },
        ].map(section => (
          <div key={section.titre} style={{ marginBottom: 36 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>{section.titre}</h2>
            <p style={{ color: 'var(--muted)', lineHeight: 1.8, fontSize: 15 }}>{section.contenu}</p>
          </div>
        ))}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, fontSize: 14, color: 'var(--muted)' }}>
          Pour toute question : <a href="mailto:contact@klo.immo" style={{ color: 'var(--terra)' }}>contact@klo.immo</a>
        </div>
      </div>
    </div>
  )
}
