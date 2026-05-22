'use client'

import { type Document as KloDoc, type Contrat, type Terrain } from '@/lib/supabase'
import { formatPrice } from '@/lib/currency'
import { qrCodeUrl } from '@/lib/documents'

interface DocumentViewerProps {
  document: KloDoc
  contrat: Contrat
  terrain: Terrain
  clientNom: string
  onClose: () => void
}

const TYPE_LABELS: Record<KloDoc['type'], { title: string; subtitle: string; color: string }> = {
  provisoire: {
    title: 'DOCUMENT PROVISOIRE DE VENTE',
    subtitle: "Ce document atteste l'engagement d'achat et le versement de l'acompte.",
    color: '#1a4a35',
  },
  acd: {
    title: 'ATTESTATION DE CESSION DE DROITS (ACD)',
    subtitle: 'Ce document certifie la cession définitive des droits de propriété.',
    color: '#0d2b1f',
  },
  autre: {
    title: 'DOCUMENT OFFICIEL KLô',
    subtitle: '',
    color: '#1a4a35',
  },
}

export default function DocumentViewer({ document, contrat, terrain, clientNom, onClose }: DocumentViewerProps) {
  const meta = TYPE_LABELS[document.type]
  const qrUrl = qrCodeUrl(document.qr_code_hash)

  const rows = [
    { label: 'Réf. terrain',         val: terrain.reference },
    { label: 'Terrain',              val: terrain.nom },
    { label: 'Localisation',         val: `${terrain.localisation}, ${terrain.pays}` },
    { label: 'Superficie',           val: `${terrain.superficie.toLocaleString('fr-FR')} m²` },
    { label: 'Statut juridique',     val: terrain.statut_juridique || (terrain.titre_foncier ? 'Titre foncier' : 'ACD en cours') },
    { label: 'Prix total',           val: formatPrice(contrat.prix_total, 'XOF') },
    { label: 'Acompte versé',        val: formatPrice(contrat.acompte_verse, 'XOF') },
    { label: 'Mensualité',           val: `${formatPrice(contrat.mensualite_montant, 'XOF')} × ${contrat.duree_mois} mois` },
    { label: 'Date de signature',    val: new Date(contrat.date_signature).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) },
    { label: 'Fin de contrat prévue', val: new Date(contrat.date_fin_prevue).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) },
  ]

  return (
    <div className="overlay-bg" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 680, width: '95vw', background: 'white', borderRadius: 16, margin: '24px auto', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}
      >
        {/* Barre d'actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #e5e7eb', background: 'var(--bg)', borderRadius: '16px 16px 0 0' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            N° <strong style={{ color: 'var(--terra)' }}>{document.numero_unique}</strong>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => window.print()}
              className="btn btn-outline" style={{ fontSize: 13, padding: '8px 16px' }}
            >
              🖨️ Imprimer / PDF
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--muted)' }}>✕</button>
          </div>
        </div>

        {/* Document */}
        <div id="klo-document" style={{ padding: '40px 48px', fontFamily: 'var(--font-body)', color: '#1a1a1a' }}>

          {/* En-tête */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, paddingBottom: 24, borderBottom: `3px solid ${meta.color}` }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, color: meta.color, lineHeight: 1 }}>
                KL<span style={{ color: '#1D9E75' }}>ô</span>
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>KLô Immobilier SARL · contact@klo.immo</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <img
                src={qrUrl}
                alt="QR Code vérification"
                style={{ width: 80, height: 80, border: '1px solid #e5e7eb', borderRadius: 6 }}
              />
              <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 4 }}>Scanner pour vérifier</div>
            </div>
          </div>

          {/* Titre */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              display: 'inline-block', padding: '4px 16px',
              background: meta.color, color: 'white',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', borderRadius: 4, marginBottom: 12,
            }}>
              {document.type === 'provisoire' ? 'DOCUMENT PROVISOIRE' : document.type === 'acd' ? 'ATTESTATION DÉFINITIVE' : 'DOCUMENT OFFICIEL'}
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: meta.color, lineHeight: 1.2, margin: 0 }}>
              {meta.title}
            </h1>
            {meta.subtitle && (
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8, lineHeight: 1.6 }}>{meta.subtitle}</p>
            )}
          </div>

          {/* Informations */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>

            {/* Vendeur */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Vendeur</div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>KLô Immobilier SARL</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4, lineHeight: 1.6 }}>
                Abidjan, Plateau — Côte d'Ivoire<br />
                RCCM CI-ABJ-2024-B-XXXXX<br />
                contact@klo.immo
              </div>
            </div>

            {/* Acheteur */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Acheteur</div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{clientNom}</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4, lineHeight: 1.6 }}>
                KYC vérifié par KLô<br />
                Contrat n° {contrat.id.slice(0, 8).toUpperCase()}
              </div>
            </div>
          </div>

          {/* Détails du bien */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, paddingBottom: 6, borderBottom: '2px solid #f3f4f6' }}>
              Objet de la transaction
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              {rows.map(r => (
                <div key={r.label} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ fontSize: 12, color: '#6b7280', minWidth: 130, flexShrink: 0 }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Engagement */}
          <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 16, marginBottom: 28, fontSize: 13, color: '#166534', lineHeight: 1.7 }}>
            {document.type === 'provisoire'
              ? `Par ce document, KLô Immobilier certifie que ${clientNom} a effectué le versement de l'acompte de ${formatPrice(contrat.acompte_verse, 'XOF')} pour le terrain ${terrain.nom} (réf. ${terrain.reference}). Ce document provisoire est valide jusqu'à l'émission du titre foncier définitif, conditionnée au règlement intégral du contrat.`
              : `Par cette Attestation de Cession de Droits, KLô Immobilier certifie que ${clientNom} a acquis la totalité des droits de propriété sur le terrain ${terrain.nom} (réf. ${terrain.reference}) pour un montant de ${formatPrice(contrat.prix_total, 'XOF')}, intégralement réglé. La remise du titre foncier sera effectuée après enregistrement auprès des autorités compétentes.`
            }
          </div>

          {/* Signatures */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 28 }}>
            {['Représentant KLô', 'Signature acheteur'].map(s => (
              <div key={s} style={{ textAlign: 'center' }}>
                <div style={{ height: 60, borderBottom: '1px solid #d1d5db', marginBottom: 8 }} />
                <div style={{ fontSize: 12, color: '#6b7280' }}>{s}</div>
              </div>
            ))}
          </div>

          {/* Pied de page */}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af' }}>
            <span>N° {document.numero_unique} · Généré le {new Date(document.date_generation).toLocaleDateString('fr-FR')}</span>
            <span>Vérifiez ce document sur klo.immo/verify</span>
          </div>
        </div>

        {/* CSS print */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #klo-document, #klo-document * { visibility: visible; }
            #klo-document { position: absolute; left: 0; top: 0; width: 100%; padding: 20mm 25mm; }
          }
        `}</style>
      </div>
    </div>
  )
}
