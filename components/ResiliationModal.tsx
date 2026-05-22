'use client'

import { useState } from 'react'
import { supabase, IS_DEMO, calculerRemboursementResiliation, type Contrat, type Terrain, type Profil } from '@/lib/supabase'
import { formatPrice } from '@/lib/currency'

interface ResiliationModalProps {
  contrat:    Contrat & { terrain: Terrain; clientNom: string }
  adminProfil: Profil
  montantVerse: number    // total payé jusqu'ici (acompte + mensualités)
  onClose:    () => void
  onSuccess:  (contratId: string) => void
  showToast:  (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function ResiliationModal({
  contrat, adminProfil, montantVerse, onClose, onSuccess, showToast
}: ResiliationModalProps) {
  const [motif, setMotif]     = useState('')
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const remboursement = calculerRemboursementResiliation(montantVerse, contrat.prix_total)
  const penalite      = Math.max(0, montantVerse - remboursement)
  const dateChoixLimite = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  async function handleResilier() {
    if (!motif.trim()) { showToast('Le motif est obligatoire', 'error'); return }
    if (!confirm)      { setConfirm(true); return }
    setLoading(true)

    const now = new Date().toISOString()

    if (!IS_DEMO) {
      // 1. Résilier le contrat
      const { error } = await supabase.from('contrats').update({
        statut:              'resilie',
        date_resiliation:    now,
        date_limite_choix:   dateChoixLimite.toISOString(),
      }).eq('id', contrat.id)

      if (error) { showToast('Erreur lors de la résiliation', 'error'); setLoading(false); return }

      // 2. Libérer le terrain
      await supabase.from('terrains').update({ statut: 'dispo' }).eq('id', contrat.terrain_id)

      // 3. Annuler les paiements futurs
      await supabase.from('paiements')
        .update({ statut: 'a_venir' }) // laisser tel quel, juste ne plus relancer
        .eq('contrat_id', contrat.id)
        .eq('statut', 'a_venir')

      // 4. Notification client
      await supabase.from('notifications').insert({
        profil_id:  contrat.profil_id,
        contrat_id: contrat.id,
        type:       'resiliation',
        canal:      'app',
        message:    `Votre contrat pour ${contrat.terrain.nom} a été résilié. Vous avez 30 jours pour choisir entre remboursement ou crédit.`,
        statut:     'envoye',
        lu:         false,
        date_envoi: now,
      })

      // 5. Journal d'audit
      await supabase.from('journal_audit').insert({
        admin_id:          adminProfil.id,
        action:            'resiliation_contrat',
        entite_concernee:  'contrats',
        entite_id:         contrat.id,
        motif:             motif.trim(),
        donnees_avant:     { statut: 'actif' },
        donnees_apres:     { statut: 'resilie', date_resiliation: now },
      })
    }

    setLoading(false)
    onSuccess(contrat.id)
  }

  return (
    <div className="overlay-bg" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--muted)' }}>✕</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <div>
            <div className="section-label">Action irréversible</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, margin: 0 }}>
              Résilier ce contrat
            </h2>
          </div>
        </div>

        {/* Info contrat */}
        <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          {[
            { label: 'Terrain',       val: contrat.terrain.nom },
            { label: 'Client',        val: contrat.clientNom },
            { label: 'Montant versé', val: formatPrice(montantVerse, 'XOF') },
            { label: 'Prix total',    val: formatPrice(contrat.prix_total, 'XOF') },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
              <span style={{ color: 'var(--muted)' }}>{r.label}</span>
              <span style={{ fontWeight: 500 }}>{r.val}</span>
            </div>
          ))}
        </div>

        {/* Calcul résiliation */}
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 12 }}>Conséquences financières</div>
          {[
            { label: 'Montant versé',        val: formatPrice(montantVerse, 'XOF'),     color: 'var(--text)' },
            { label: 'Pénalité (15% prix)',  val: `− ${formatPrice(penalite, 'XOF')}`, color: '#dc2626' },
            { label: 'Remboursement max (A)', val: formatPrice(remboursement, 'XOF'),   color: '#d97706', bold: true },
            { label: 'Crédit possible (B)',   val: formatPrice(montantVerse, 'XOF'),    color: '#1D9E75', bold: true },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
              <span style={{ color: 'var(--muted)' }}>{r.label}</span>
              <span style={{ fontWeight: r.bold ? 700 : 500, color: r.color }}>{r.val}</span>
            </div>
          ))}
          <div style={{ marginTop: 10, fontSize: 12, color: '#dc2626', borderTop: '1px solid #fecaca', paddingTop: 8 }}>
            Le client aura <strong>30 jours</strong> (jusqu'au {dateChoixLimite.toLocaleDateString('fr-FR')}) pour choisir son option.
          </div>
        </div>

        {/* Motif */}
        <div style={{ marginBottom: 20 }}>
          <label className="label">Motif de résiliation <span style={{ color: '#dc2626' }}>*</span></label>
          <textarea
            className="input" rows={3}
            placeholder="Ex: Retards de paiement répétés (3+ mois), client injoignable malgré relances..."
            value={motif} onChange={e => setMotif(e.target.value)}
            style={{ resize: 'vertical' }}
          />
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Ce motif sera visible dans le journal d'audit et envoyé au client.
          </p>
        </div>

        {/* Confirmation */}
        {confirm && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13, color: '#dc2626', lineHeight: 1.6 }}>
            ⚠️ <strong>Confirmez-vous la résiliation ?</strong> Cette action est irréversible.
            Le terrain sera remis en vente et le client sera notifié immédiatement.
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-outline" onClick={onClose} style={{ flex: 1 }} disabled={loading}>
            Annuler
          </button>
          <button
            onClick={handleResilier}
            disabled={loading || !motif.trim()}
            style={{
              flex: 1, padding: '12px', border: 'none', borderRadius: 10, cursor: 'pointer',
              background: confirm ? '#dc2626' : '#d97706', color: 'white',
              fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-body)',
              opacity: !motif.trim() ? 0.6 : 1, transition: 'background 0.2s',
            }}
          >
            {loading ? '⏳ Traitement...' : confirm ? '✕ Confirmer la résiliation' : 'Continuer →'}
          </button>
        </div>

        {IS_DEMO && (
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
            Mode démo — la résiliation est simulée localement.
          </p>
        )}
      </div>
    </div>
  )
}
