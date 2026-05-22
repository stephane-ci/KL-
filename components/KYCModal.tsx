'use client'

import { useState, useRef } from 'react'
import { supabase, IS_DEMO, type Profil } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────

type DocType = 'cni' | 'passeport'
type Step = 'type' | 'upload' | 'review' | 'done'

interface KYCModalProps {
  profil: Profil
  onClose: () => void
  onSuccess: () => void
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

// ── Component ──────────────────────────────────────────────────────────────

export default function KYCModal({ profil, onClose, onSuccess, showToast }: KYCModalProps) {
  const [step, setStep] = useState<Step>('type')
  const [docType, setDocType] = useState<DocType>('cni')
  const [fileRecto, setFileRecto] = useState<File | null>(null)
  const [fileVerso, setFileVerso] = useState<File | null>(null)
  const [previewRecto, setPreviewRecto] = useState('')
  const [previewVerso, setPreviewVerso] = useState('')
  const [dragOverRecto, setDragOverRecto] = useState(false)
  const [dragOverVerso, setDragOverVerso] = useState(false)
  const [uploading, setUploading] = useState(false)

  const inputRecto = useRef<HTMLInputElement>(null)
  const inputVerso = useRef<HTMLInputElement>(null)

  // ── Helpers ──────────────────────────────────────────────────────────────

  function handleFileSelect(file: File, side: 'recto' | 'verso') {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.type)) {
      showToast('Format non supporté — utilisez JPG, PNG ou PDF', 'error')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('Fichier trop lourd (max 10 Mo)', 'error')
      return
    }
    const url = URL.createObjectURL(file)
    if (side === 'recto') { setFileRecto(file); setPreviewRecto(url) }
    else { setFileVerso(file); setPreviewVerso(url) }
  }

  function canGoToReview(): boolean {
    if (!fileRecto) return false
    if (docType === 'cni' && !fileVerso) return false
    return true
  }

  async function handleSubmit() {
    setUploading(true)

    if (IS_DEMO) {
      await new Promise(r => setTimeout(r, 1200)) // simuler upload
      setStep('done')
      setUploading(false)
      return
    }

    try {
      // Upload recto
      const extRecto = fileRecto!.name.split('.').pop()
      const pathRecto = `${profil.id}/recto-${Date.now()}.${extRecto}`
      const { error: errRecto } = await supabase.storage
        .from('kyc-documents')
        .upload(pathRecto, fileRecto!, { upsert: true })
      if (errRecto) throw errRecto

      const { data: { publicUrl: urlRecto } } = supabase.storage
        .from('kyc-documents')
        .getPublicUrl(pathRecto)

      // Upload verso (CNI seulement)
      let urlVerso: string | undefined
      if (docType === 'cni' && fileVerso) {
        const extVerso = fileVerso.name.split('.').pop()
        const pathVerso = `${profil.id}/verso-${Date.now()}.${extVerso}`
        const { error: errVerso } = await supabase.storage
          .from('kyc-documents')
          .upload(pathVerso, fileVerso, { upsert: true })
        if (errVerso) throw errVerso
        const { data: { publicUrl } } = supabase.storage
          .from('kyc-documents')
          .getPublicUrl(pathVerso)
        urlVerso = publicUrl
      }

      // Insérer dans la table kyc
      const { error: errKyc } = await supabase.from('kyc').insert({
        profil_id: profil.id,
        document_type: docType,
        document_url: urlRecto,
        document_url2: urlVerso ?? null,
        statut: 'en_attente',
      })
      if (errKyc) throw errKyc

      // Mettre à jour statut_kyc dans profils
      await supabase.from('profils')
        .update({ statut_kyc: 'en_attente' })
        .eq('id', profil.id)

      setStep('done')
    } catch (err) {
      console.error(err)
      showToast('Erreur lors de l\'envoi — réessayez', 'error')
    } finally {
      setUploading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="overlay-bg" onClick={onClose}>
      <div
        className="modal-box"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 560 }}
      >
        {/* Close */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 18, color: 'var(--muted)', lineHeight: 1,
        }}>✕</button>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div className="section-label" style={{ marginBottom: 6 }}>Vérification d'identité</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, lineHeight: 1.2 }}>
            {step === 'type'   && 'Choisissez votre document'}
            {step === 'upload' && 'Photographiez votre document'}
            {step === 'review' && 'Vérifiez avant d\'envoyer'}
            {step === 'done'   && 'Dossier envoyé !'}
          </h2>
        </div>

        {/* Stepper */}
        {step !== 'done' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
            {(['type', 'upload', 'review'] as Step[]).map((s, i) => (
              <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{
                  height: 4, borderRadius: 2,
                  background: ['type', 'upload', 'review'].indexOf(step) >= i
                    ? 'var(--terra)' : 'var(--border)',
                  transition: 'background 0.3s',
                }} />
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {i + 1}. {s === 'type' ? 'Type' : s === 'upload' ? 'Upload' : 'Vérification'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Étape 1 : Type de document ─────────────────────── */}
        {step === 'type' && (
          <div>
            <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24 }}>
              Nous acceptons la <strong>Carte Nationale d'Identité</strong> (CNI) de tous les pays africains
              et le <strong>Passeport</strong> de n'importe quel pays.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
              {([
                {
                  val: 'cni' as DocType,
                  icon: '🪪',
                  label: 'Carte Nationale d\'Identité',
                  desc: 'Recto + Verso requis',
                },
                {
                  val: 'passeport' as DocType,
                  icon: '📘',
                  label: 'Passeport',
                  desc: 'Page d\'identité uniquement',
                },
              ]).map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setDocType(opt.val)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '18px 20px', borderRadius: 12, cursor: 'pointer',
                    border: `2px solid ${docType === opt.val ? 'var(--terra)' : 'var(--border)'}`,
                    background: docType === opt.val ? 'var(--terra-light)' : 'transparent',
                    textAlign: 'left', transition: 'all 0.2s',
                  }}
                >
                  <span style={{ fontSize: 32, flexShrink: 0 }}>{opt.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: docType === opt.val ? 'var(--terra)' : 'var(--text)', marginBottom: 2 }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>{opt.desc}</div>
                  </div>
                  {docType === opt.val && (
                    <span style={{ marginLeft: 'auto', color: 'var(--terra)', fontSize: 20 }}>✓</span>
                  )}
                </button>
              ))}
            </div>

            {/* Conseils */}
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16, marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
                📸 Conseils pour une bonne photo
              </div>
              <ul style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8, paddingLeft: 16, margin: 0 }}>
                <li>Document entièrement visible, sans découpe</li>
                <li>Photo nette, bien éclairée, sans reflet</li>
                <li>Formats acceptés : JPG, PNG, PDF (max 10 Mo)</li>
                <li>Pas de copie scanneuse floue</li>
              </ul>
            </div>

            <button className="btn btn-primary" onClick={() => setStep('upload')} style={{ width: '100%', padding: '13px' }}>
              Continuer →
            </button>
          </div>
        )}

        {/* ── Étape 2 : Upload ───────────────────────────────── */}
        {step === 'upload' && (
          <div>
            {/* Zone recto */}
            <div style={{ marginBottom: 20 }}>
              <label className="label">
                {docType === 'cni' ? 'Recto de votre CNI' : 'Page d\'identité du passeport'}
                {' '}<span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                ref={inputRecto} type="file" accept="image/*,.pdf"
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0], 'recto') }}
              />
              {previewRecto ? (
                <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '2px solid var(--terra)' }}>
                  {fileRecto?.type === 'application/pdf' ? (
                    <div style={{ padding: 20, background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 32 }}>📄</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{fileRecto.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{(fileRecto.size / 1024).toFixed(0)} Ko</div>
                      </div>
                    </div>
                  ) : (
                    <img src={previewRecto} alt="Recto" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
                  )}
                  <button
                    onClick={() => { setFileRecto(null); setPreviewRecto('') }}
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      background: 'rgba(0,0,0,0.6)', color: 'white',
                      border: 'none', borderRadius: '50%', width: 28, height: 28,
                      cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >✕</button>
                </div>
              ) : (
                <div
                  onClick={() => inputRecto.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOverRecto(true) }}
                  onDragLeave={() => setDragOverRecto(false)}
                  onDrop={e => { e.preventDefault(); setDragOverRecto(false); if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0], 'recto') }}
                  style={{
                    border: `2px dashed ${dragOverRecto ? 'var(--terra)' : 'var(--border)'}`,
                    borderRadius: 10, padding: '32px 16px', cursor: 'pointer',
                    textAlign: 'center', background: dragOverRecto ? 'var(--terra-light)' : 'var(--bg)',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📤</div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Cliquez ou glissez votre fichier</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>JPG, PNG ou PDF — max 10 Mo</div>
                </div>
              )}
            </div>

            {/* Zone verso (CNI seulement) */}
            {docType === 'cni' && (
              <div style={{ marginBottom: 20 }}>
                <label className="label">
                  Verso de votre CNI <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  ref={inputVerso} type="file" accept="image/*,.pdf"
                  style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0], 'verso') }}
                />
                {previewVerso ? (
                  <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '2px solid var(--terra)' }}>
                    {fileVerso?.type === 'application/pdf' ? (
                      <div style={{ padding: 20, background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 32 }}>📄</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{fileVerso.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{(fileVerso.size / 1024).toFixed(0)} Ko</div>
                        </div>
                      </div>
                    ) : (
                      <img src={previewVerso} alt="Verso" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
                    )}
                    <button
                      onClick={() => { setFileVerso(null); setPreviewVerso('') }}
                      style={{
                        position: 'absolute', top: 8, right: 8,
                        background: 'rgba(0,0,0,0.6)', color: 'white',
                        border: 'none', borderRadius: '50%', width: 28, height: 28,
                        cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >✕</button>
                  </div>
                ) : (
                  <div
                    onClick={() => inputVerso.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOverVerso(true) }}
                    onDragLeave={() => setDragOverVerso(false)}
                    onDrop={e => { e.preventDefault(); setDragOverVerso(false); if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0], 'verso') }}
                    style={{
                      border: `2px dashed ${dragOverVerso ? 'var(--terra)' : 'var(--border)'}`,
                      borderRadius: 10, padding: '32px 16px', cursor: 'pointer',
                      textAlign: 'center', background: dragOverVerso ? 'var(--terra-light)' : 'var(--bg)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📤</div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Verso de la CNI</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>JPG, PNG ou PDF — max 10 Mo</div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" onClick={() => setStep('type')} style={{ flex: 1 }}>← Retour</button>
              <button
                className="btn btn-primary"
                onClick={() => canGoToReview() && setStep('review')}
                disabled={!canGoToReview()}
                style={{ flex: 2 }}
              >
                Vérifier → {!canGoToReview() && '(document manquant)'}
              </button>
            </div>
          </div>
        )}

        {/* ── Étape 3 : Récapitulatif ────────────────────────── */}
        {step === 'review' && (
          <div>
            <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
                <span style={{ color: 'var(--muted)' }}>Type de document</span>
                <span style={{ fontWeight: 600 }}>{docType === 'cni' ? 'Carte Nationale d\'Identité' : 'Passeport'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
                <span style={{ color: 'var(--muted)' }}>Nom du titulaire</span>
                <span style={{ fontWeight: 600 }}>{profil.nom_complet}</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                    {docType === 'cni' ? 'Recto' : 'Document'}
                  </div>
                  {previewRecto && (fileRecto?.type !== 'application/pdf' ? (
                    <img src={previewRecto} alt="doc" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }} />
                  ) : (
                    <div style={{ height: 100, background: 'var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📄</div>
                  ))}
                </div>
                {docType === 'cni' && previewVerso && (
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Verso</div>
                    {fileVerso?.type !== 'application/pdf' ? (
                      <img src={previewVerso} alt="verso" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }} />
                    ) : (
                      <div style={{ height: 100, background: 'var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📄</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Avertissement */}
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
              ⚠️ En soumettant ce dossier, vous certifiez que le document est authentique et vous appartient. Toute fraude entraînera la résiliation du compte.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" onClick={() => setStep('upload')} style={{ flex: 1 }}>← Modifier</button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={uploading}
                style={{ flex: 2 }}
              >
                {uploading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                    Envoi en cours...
                  </span>
                ) : 'Envoyer mon dossier KYC'}
              </button>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── Étape 4 : Confirmation ─────────────────────────── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 12 }}>
              Dossier reçu !
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
              Votre dossier KYC a bien été soumis. Notre équipe le vérifiera sous <strong>24 à 48 heures</strong>.
              Vous serez notifié par email dès que la vérification sera complétée.
            </p>
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16, marginBottom: 28, fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text)' }}>En attendant, vous pouvez :</strong><br />
              ✓ Parcourir le catalogue de terrains<br />
              ✓ Ajouter des terrains à vos favoris<br />
              ✓ Compléter votre profil
            </div>
            <button className="btn btn-primary" onClick={() => { onSuccess(); onClose() }} style={{ width: '100%', padding: '13px' }}>
              Parfait, retour à mon espace
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
