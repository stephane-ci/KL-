'use client'

import { useState, useEffect } from 'react'
import { supabase, IS_DEMO, MOCK_TERRAINS, MOCK_CONTRATS, MOCK_PROFIL, type Profil, type Terrain, type Reservation, type Paiement, type KYC, type Document as KloDoc, type Contrat, type JournalAudit } from '@/lib/supabase'
import { formatPrice } from '@/lib/currency'
import { generateNumeroUnique, generateQrHash } from '@/lib/documents'
import DocumentViewer from '@/components/DocumentViewer'
import ResiliationModal from '@/components/ResiliationModal'

interface AdminProps {
  profil: Profil
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

type Tab = 'dashboard' | 'terrains' | 'reservations' | 'alertes' | 'kyc' | 'documents' | 'audit' | 'parametres'
type KycEntry = KYC & { profil?: Profil }
type ContratEntry = Contrat & { terrain: Terrain; clientNom: string }

const MOCK_KYC: KycEntry[] = [
  {
    id: 'k1', profil_id: 'u1', document_type: 'cni',
    document_url: 'https://picsum.photos/seed/cni1/400/250',
    document_url2: 'https://picsum.photos/seed/cni1b/400/250',
    statut: 'en_attente', date_soumission: '2024-05-20T09:15:00Z',
    created_at: '2024-05-20T09:15:00Z',
    profil: { id: 'u1', nom_complet: 'Aminata Diallo', email: 'aminata@example.com', telephone: '+33 6 12 34 56 78', pays_residence: 'France', type_profil: 'diaspora', statut_kyc: 'en_attente', is_admin: false, is_super_admin: false, created_at: '2024-05-01T00:00:00Z' },
  },
  {
    id: 'k2', profil_id: 'u2', document_type: 'passeport',
    document_url: 'https://picsum.photos/seed/pp2/400/250',
    statut: 'en_attente', date_soumission: '2024-05-21T14:30:00Z',
    created_at: '2024-05-21T14:30:00Z',
    profil: { id: 'u2', nom_complet: 'Kwame Asante', email: 'kwame@example.com', telephone: '+44 20 1234 5678', pays_residence: 'Royaume-Uni', type_profil: 'diaspora', statut_kyc: 'en_attente', is_admin: false, is_super_admin: false, created_at: '2024-05-15T00:00:00Z' },
  },
  {
    id: 'k3', profil_id: 'u3', document_type: 'cni',
    document_url: 'https://picsum.photos/seed/cni3/400/250',
    statut: 'valide', date_soumission: '2024-05-10T10:00:00Z', date_decision: '2024-05-11T16:00:00Z',
    created_at: '2024-05-10T10:00:00Z',
    profil: { id: 'u3', nom_complet: 'Fatou Sow', email: 'fatou@example.com', telephone: '+221 77 000 00 00', pays_residence: 'Sénégal', type_profil: 'local', statut_kyc: 'valide', is_admin: false, is_super_admin: false, created_at: '2024-05-08T00:00:00Z' },
  },
  {
    id: 'k4', profil_id: 'u4', document_type: 'cni',
    document_url: 'https://picsum.photos/seed/cni4/400/250',
    statut: 'refuse', motif_refus: 'Document illisible — photo floue. Veuillez soumettre une photo nette.', date_soumission: '2024-05-18T11:00:00Z', date_decision: '2024-05-19T09:00:00Z',
    created_at: '2024-05-18T11:00:00Z',
    profil: { id: 'u4', nom_complet: 'Ibrahim Coulibaly', email: 'ibrahim@example.com', pays_residence: "Côte d'Ivoire", type_profil: 'local', statut_kyc: 'refuse', is_admin: false, is_super_admin: false, created_at: '2024-05-17T00:00:00Z' },
  },
]

const EMPTY_TERRAIN: Partial<Terrain> = {
  nom: '', reference: '', localisation: '', pays: 'Sénégal',
  superficie: 500, prix_fcfa: 10000000, acompte_pct: 20, duree_mois: 24,
  statut: 'dispo', statut_juridique: '', images: [], video_url: '',
  titre_foncier: true, description: '',
}

const PAYS_TERRAINS = ['Sénégal', "Côte d'Ivoire", 'Togo', 'Bénin', 'Burkina Faso', 'Mali', 'Guinée', 'Cameroun', 'Gabon', 'Congo']

export default function Admin({ profil, showToast }: AdminProps) {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [terrains, setTerrains] = useState<Terrain[]>(MOCK_TERRAINS)
  const [reservations, setReservations] = useState<(Reservation & { terrain?: Terrain; paiements?: Paiement[] })[]>([])
  const [loading, setLoading] = useState(!IS_DEMO)
  const [margeTaux, setMargeTaux] = useState(Number(process.env.NEXT_PUBLIC_MARGE_TAUX) || 5)
  const [showTerrainForm, setShowTerrainForm] = useState(false)
  const [editTerrain, setEditTerrain] = useState<Partial<Terrain>>(EMPTY_TERRAIN)
  const [saving, setSaving] = useState(false)
  const [pendingImageFiles, setPendingImageFiles] = useState<File[]>([])
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [kycList, setKycList] = useState<KycEntry[]>(IS_DEMO ? MOCK_KYC : [])
  const [selectedKyc, setSelectedKyc] = useState<KycEntry | null>(null)
  const [motifRefus, setMotifRefus] = useState('')
  const [showMotifInput, setShowMotifInput] = useState(false)
  const [kycLoading, setKycLoading] = useState(false)
  const [contratsList, setContratsList] = useState<ContratEntry[]>(
    IS_DEMO ? MOCK_CONTRATS.map(c => ({
      ...c,
      terrain: MOCK_TERRAINS.find(t => t.id === c.terrain_id) ?? MOCK_TERRAINS[0],
      clientNom: MOCK_PROFIL.nom_complet,
    })) : []
  )
  const [documents, setDocuments] = useState<KloDoc[]>([])
  const [docViewer, setDocViewer] = useState<{ doc: KloDoc; contrat: ContratEntry } | null>(null)
  const [generatingDoc, setGeneratingDoc] = useState<string | null>(null)
  const [resiliationTarget, setResiliationTarget] = useState<(ContratEntry & { montantVerse: number }) | null>(null)
  const [journal, setJournal] = useState<JournalAudit[]>(IS_DEMO ? [
    { id: 'j1', admin_id: 'admin-1', action: 'kyc_valide', entite_concernee: 'kyc', entite_id: 'k3', motif: 'Document CNI clair et valide', donnees_avant: { statut: 'en_attente' }, donnees_apres: { statut: 'valide' }, created_at: '2024-05-11T16:00:00Z', admin: { id: 'admin-1', nom_complet: 'Admin KLô', email: 'admin@klo.immo', type_profil: 'local', statut_kyc: 'valide', is_admin: true, is_super_admin: true, created_at: '2024-01-01T00:00:00Z' } },
    { id: 'j2', admin_id: 'admin-1', action: 'terrain_cree', entite_concernee: 'terrains', entite_id: '1', motif: 'Nouveau terrain ajouté au catalogue', donnees_avant: undefined, donnees_apres: { nom: 'Villa Corniche', prix: 15000000 }, created_at: '2024-01-15T10:00:00Z', admin: { id: 'admin-1', nom_complet: 'Admin KLô', email: 'admin@klo.immo', type_profil: 'local', statut_kyc: 'valide', is_admin: true, is_super_admin: true, created_at: '2024-01-01T00:00:00Z' } },
    { id: 'j3', admin_id: 'admin-1', action: 'kyc_refuse', entite_concernee: 'kyc', entite_id: 'k4', motif: 'Document illisible — photo floue', donnees_avant: { statut: 'en_attente' }, donnees_apres: { statut: 'refuse' }, created_at: '2024-05-19T09:00:00Z', admin: { id: 'admin-1', nom_complet: 'Admin KLô', email: 'admin@klo.immo', type_profil: 'local', statut_kyc: 'valide', is_admin: true, is_super_admin: true, created_at: '2024-01-01T00:00:00Z' } },
  ] : [])

  useEffect(() => {
    if (!IS_DEMO) fetchData()
    else {
      // Mock reservations
      setReservations([{
        id: 'r1', terrain_id: '1', client_id: 'u1',
        date_reservation: '2024-03-01T10:00:00Z',
        montant_acompte: 3000000, statut: 'validee',
        created_at: '2024-03-01T10:00:00Z',
        terrain: MOCK_TERRAINS[0],
        paiements: Array.from({ length: 24 }, (_, i) => ({
          id: `p${i}`, contrat_id: 'r1', type: 'mensualite' as const,
          montant: Math.round(15000000 * 0.8 / 24),
          date_echeance: new Date(2024, 3 + i, 1).toISOString().split('T')[0],
          statut: (i < 3 ? 'paye' : i === 3 ? 'en_retard' : 'a_venir') as Paiement['statut'],
          numero_relance: 0, created_at: new Date(2024, 3 + i, 1).toISOString(),
        })),
      }])
    }
  }, [])

  async function fetchData() {
    setLoading(true)
    const [{ data: t }, { data: r }, { data: c }, { data: d }, { data: j }] = await Promise.all([
      supabase.from('terrains').select('*').order('created_at', { ascending: false }),
      supabase.from('reservations').select('*, terrain:terrains(*), paiements(*)').order('created_at', { ascending: false }),
      supabase.from('contrats').select('*, terrain:terrains(*), profil:profils(nom_complet)').order('created_at', { ascending: false }),
      supabase.from('documents').select('*').order('created_at', { ascending: false }),
      supabase.from('journal_audit').select('*, admin:profils!admin_id(*)').order('created_at', { ascending: false }).limit(100),
    ])
    if (t) setTerrains(t)
    if (r) setReservations(r)
    if (c) setContratsList(c.map((x: Contrat & { terrain: Terrain; profil?: { nom_complet: string } }) => ({ ...x, clientNom: x.profil?.nom_complet || 'Client' })))
    if (d) setDocuments(d)
    if (j) setJournal(j)
    setLoading(false)
    fetchKyc()
  }

  async function fetchKyc() {
    const { data } = await supabase
      .from('kyc')
      .select('*, profil:profils(*)')
      .order('date_soumission', { ascending: false })
    if (data) setKycList(data)
  }

  async function handleValidateKyc(entry: KycEntry) {
    setKycLoading(true)
    if (!IS_DEMO) {
      await supabase.from('kyc').update({ statut: 'valide', admin_id: profil.id, date_decision: new Date().toISOString() }).eq('id', entry.id)
      await supabase.from('profils').update({ statut_kyc: 'valide' }).eq('id', entry.profil_id)
      // Notification client
      await supabase.from('notifications').insert({
        profil_id: entry.profil_id,
        type: 'kyc_valide',
        canal: 'app',
        message: 'Votre KYC a été validé ! Vous pouvez désormais réserver un terrain.',
      })
    }
    setKycList(prev => prev.map(k => k.id === entry.id ? { ...k, statut: 'valide' as const, date_decision: new Date().toISOString() } : k))
    setSelectedKyc(null)
    showToast(`KYC de ${entry.profil?.nom_complet} validé`, 'success')
    setKycLoading(false)
  }

  async function handleRejectKyc(entry: KycEntry) {
    if (!motifRefus.trim()) { showToast('Le motif de refus est obligatoire', 'error'); return }
    setKycLoading(true)
    if (!IS_DEMO) {
      await supabase.from('kyc').update({ statut: 'refuse', motif_refus: motifRefus, admin_id: profil.id, date_decision: new Date().toISOString() }).eq('id', entry.id)
      await supabase.from('profils').update({ statut_kyc: 'refuse' }).eq('id', entry.profil_id)
      // Notification client avec motif
      await supabase.from('notifications').insert({
        profil_id: entry.profil_id,
        type: 'kyc_refuse',
        canal: 'app',
        message: `Votre KYC a été refusé : ${motifRefus}. Vous pouvez soumettre à nouveau.`,
      })
    }
    setKycList(prev => prev.map(k => k.id === entry.id ? { ...k, statut: 'refuse' as const, motif_refus: motifRefus, date_decision: new Date().toISOString() } : k))
    setSelectedKyc(null)
    setShowMotifInput(false)
    setMotifRefus('')
    showToast(`KYC de ${entry.profil?.nom_complet} refusé`, 'info')
    setKycLoading(false)
  }

  async function handleGenerateDocument(contrat: ContratEntry, type: KloDoc['type']) {
    const key = `${contrat.id}-${type}`
    setGeneratingDoc(key)

    const numero_unique = generateNumeroUnique()
    const qr_code_hash  = generateQrHash()
    const now           = new Date().toISOString()

    const payload = {
      contrat_id:      contrat.id,
      type,
      numero_unique,
      qr_code_hash,
      statut:          'actif' as const,
      visible_client:  true,
      genere_par:      profil.id,
      date_generation: now,
    }

    let newDoc: KloDoc = { ...payload, id: Date.now().toString(), url_fichier: undefined, created_at: now }

    if (!IS_DEMO) {
      const { data, error } = await supabase.from('documents').insert(payload).select().single()
      if (error) { showToast('Erreur génération document', 'error'); setGeneratingDoc(null); return }
      newDoc = data
      // Notification client
      await supabase.from('notifications').insert({
        profil_id:   contrat.profil_id,
        contrat_id:  contrat.id,
        type:        type === 'acd' ? 'titre_disponible' : 'contrat_signe',
        canal:       'app',
        message:     `Votre ${type === 'acd' ? 'Attestation de Cession de Droits' : 'document provisoire'} pour ${contrat.terrain.nom} est disponible.`,
        statut:      'envoye',
        lu:          false,
        date_envoi:  now,
      })
    }

    setDocuments(prev => [newDoc, ...prev])
    setDocViewer({ doc: newDoc, contrat })
    showToast(`${type === 'acd' ? 'ACD' : 'Doc. provisoire'} généré ✓`, 'success')
    setGeneratingDoc(null)
  }

  function handleResiliationSuccess(contratId: string) {
    setContratsList(prev => prev.map(c =>
      c.id === contratId ? { ...c, statut: 'resilie' as const } : c
    ))
    setResiliationTarget(null)
    showToast('Contrat résilié — client notifié', 'success')
  }

  async function handleRevokeDocument(docId: string) {
    if (!confirm('Révoquer ce document ? Il ne sera plus valide.')) return
    if (!IS_DEMO) {
      await supabase.from('documents').update({ statut: 'revoque' }).eq('id', docId)
    }
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, statut: 'revoque' as const } : d))
    showToast('Document révoqué', 'info')
  }

  function closeForm() {
    setShowTerrainForm(false)
    setEditTerrain(EMPTY_TERRAIN)
    setPendingImageFiles([])
    setPendingVideoFile(null)
    setUploadStatus('')
  }

  async function uploadToStorage(file: File, folder: string): Promise<string> {
    const ext = file.name.split('.').pop()
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { data, error } = await supabase.storage.from('terrain-media').upload(path, file)
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from('terrain-media').getPublicUrl(data.path)
    return publicUrl
  }

  function handleImagesAdd(files: FileList | null) {
    if (!files) return
    const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    const previews = newFiles.map(f => URL.createObjectURL(f))
    setPendingImageFiles(prev => [...prev, ...newFiles])
    setEditTerrain(v => ({ ...v, images: [...(v.images || []), ...previews] }))
  }

  function removeImage(index: number) {
    const images = editTerrain.images || []
    const removed = images[index]
    if (removed?.startsWith('blob:')) {
      const blobUrls = images.filter(u => u.startsWith('blob:'))
      const blobIndex = blobUrls.indexOf(removed)
      if (blobIndex !== -1) setPendingImageFiles(prev => prev.filter((_, i) => i !== blobIndex))
    }
    setEditTerrain(v => ({ ...v, images: (v.images || []).filter((_, i) => i !== index) }))
  }

  function handleVideoAdd(file: File) {
    if (file.size > 50 * 1024 * 1024) { showToast('Vidéo trop lourde (max 50 Mo)', 'error'); return }
    if (!file.type.startsWith('video/')) { showToast('Format vidéo non supporté', 'error'); return }
    const preview = URL.createObjectURL(file)
    setPendingVideoFile(file)
    setEditTerrain(v => ({ ...v, video_url: preview }))
  }

  function removeVideo() {
    setPendingVideoFile(null)
    setEditTerrain(v => ({ ...v, video_url: '' }))
  }

  async function saveTerrain() {
    // Validation
    if (!editTerrain.nom?.trim())        { showToast('Le nom est requis', 'error'); return }
    if (!editTerrain.reference?.trim())  { showToast('La référence est requise', 'error'); return }
    if (!editTerrain.localisation?.trim()) { showToast('La localisation est requise', 'error'); return }
    if (!editTerrain.prix_fcfa || editTerrain.prix_fcfa <= 0) { showToast('Le prix est requis', 'error'); return }
    if (!editTerrain.superficie || editTerrain.superficie <= 0) { showToast('La superficie est requise', 'error'); return }

    setSaving(true)
    const finalTerrain = { ...editTerrain }

    if (!IS_DEMO) {
      // Upload photos
      if (pendingImageFiles.length > 0) {
        try {
          const uploadedUrls: string[] = []
          for (let i = 0; i < pendingImageFiles.length; i++) {
            setUploadStatus(`Envoi des photos (${i + 1}/${pendingImageFiles.length})...`)
            uploadedUrls.push(await uploadToStorage(pendingImageFiles[i], 'images'))
          }
          const existing = (finalTerrain.images || []).filter(u => !u.startsWith('blob:'))
          finalTerrain.images = [...existing, ...uploadedUrls]
        } catch {
          showToast("Erreur lors de l'upload des photos", 'error'); setSaving(false); setUploadStatus(''); return
        }
      }

      // Upload vidéo
      if (pendingVideoFile) {
        setUploadStatus('Envoi de la vidéo...')
        try {
          finalTerrain.video_url = await uploadToStorage(pendingVideoFile, 'videos')
        } catch {
          showToast("Erreur lors de l'upload de la vidéo", 'error'); setSaving(false); setUploadStatus(''); return
        }
      }

      setUploadStatus('')

      // Payload propre pour Supabase (sans champs undefined)
      const payload = {
        nom:             finalTerrain.nom,
        reference:       finalTerrain.reference,
        localisation:    finalTerrain.localisation,
        pays:            finalTerrain.pays,
        description:     finalTerrain.description ?? '',
        superficie:      finalTerrain.superficie,
        prix_fcfa:       finalTerrain.prix_fcfa,
        acompte_pct:     finalTerrain.acompte_pct ?? 20,
        duree_mois:      finalTerrain.duree_mois ?? 24,
        statut:          finalTerrain.statut ?? 'dispo',
        statut_juridique: finalTerrain.statut_juridique ?? null,
        titre_foncier:   finalTerrain.titre_foncier ?? false,
        images:          (finalTerrain.images || []).filter(u => !u.startsWith('blob:')),
        video_url:       finalTerrain.video_url || null,
        admin_id:        profil.id,
      }

      if (finalTerrain.id) {
        const { error } = await supabase.from('terrains').update(payload).eq('id', finalTerrain.id)
        if (error) { showToast('Erreur lors de la sauvegarde', 'error'); setSaving(false); return }
      } else {
        const { error } = await supabase.from('terrains').insert(payload)
        if (error) { showToast('Erreur lors de la création', 'error'); setSaving(false); return }
      }
      fetchData()
    } else {
      // Mode démo : mise à jour locale
      const now = new Date().toISOString()
      if (finalTerrain.id) {
        setTerrains(prev => prev.map(t => t.id === finalTerrain.id
          ? { ...t, ...finalTerrain, updated_at: now } as Terrain : t))
      } else {
        const newT: Terrain = {
          ...finalTerrain as Terrain,
          id: Date.now().toString(),
          acompte_pct: finalTerrain.acompte_pct ?? 20,
          images: (finalTerrain.images || []).filter(u => !u.startsWith('blob:')),
          created_at: now, updated_at: now,
        }
        setTerrains(prev => [newT, ...prev])
      }
    }

    showToast(finalTerrain.id ? 'Terrain mis à jour ✓' : 'Terrain créé ✓', 'success')
    closeForm()
    setSaving(false)
  }

  async function deleteTerrain(id: string) {
    if (!confirm('Supprimer ce terrain ?')) return
    if (!IS_DEMO) {
      await supabase.from('terrains').delete().eq('id', id)
      fetchData()
    } else {
      setTerrains(prev => prev.filter(t => t.id !== id))
    }
    showToast('Terrain supprimé')
  }

  async function updateStatutReservation(id: string, statut: Reservation['statut']) {
    if (!IS_DEMO) await supabase.from('reservations').update({ statut }).eq('id', id)
    setReservations(prev => prev.map(r => r.id === id ? { ...r, statut } : r))
    showToast('Statut mis à jour', 'success')
  }

  const stats = {
    dispo: terrains.filter(t => t.statut === 'dispo').length,
    reserve: terrains.filter(t => t.statut === 'reserve').length,
    vendu: terrains.filter(t => t.statut === 'vendu').length,
    ca: reservations.reduce((s, r) => s + r.montant_acompte, 0),
    retard: reservations.flatMap(r => r.paiements || []).filter(p => p.statut === 'en_retard').length,
  }

  const nbKycEnAttente = kycList.filter(k => k.statut === 'en_attente').length

  const TABS: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'terrains', label: '🏠 Terrains' },
    { id: 'reservations', label: '📋 Réservations' },
    { id: 'alertes', label: `⚠️ Alertes${stats.retard > 0 ? ` (${stats.retard})` : ''}` },
    { id: 'kyc', label: `🪪 KYC${nbKycEnAttente > 0 ? ` (${nbKycEnAttente})` : ''}` },
    { id: 'documents', label: '📜 Documents' },
    ...(profil.is_super_admin ? [{ id: 'audit' as Tab, label: '📋 Journal audit' }] : []),
    { id: 'parametres', label: '⚙️ Paramètres' },
  ]

  return (
    <div style={{ paddingTop: 80, minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0d2b1f, #1a4a35)', padding: '40px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="section-label" style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Administration</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 600, color: 'white', letterSpacing: '-0.02em' }}>
            Dashboard KLô
          </h1>
          {IS_DEMO && <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Mode démo — connectez Supabase pour gérer vos vraies données</div>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)', overflowX: 'auto' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 0, minWidth: 'max-content' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '16px 18px', fontSize: 14, fontFamily: 'var(--font-body)',
              color: tab === t.id ? 'var(--terra)' : 'var(--muted)',
              borderBottom: tab === t.id ? '2px solid var(--terra)' : '2px solid transparent',
              fontWeight: tab === t.id ? 600 : 400, whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Dashboard */}
        {tab === 'dashboard' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20, marginBottom: 32 }}>
              {[
                { label: 'Disponibles', val: stats.dispo, icon: '✅', color: '#1D9E75' },
                { label: 'Réservés', val: stats.reserve, icon: '⏳', color: '#d97706' },
                { label: 'Vendus', val: stats.vendu, icon: '🏆', color: '#6b7280' },
                { label: 'Total terrains', val: terrains.length, icon: '🗺️', color: '#1a4a35' },
                { label: 'KYC en attente', val: nbKycEnAttente, icon: '🪪', color: nbKycEnAttente > 0 ? '#d97706' : '#6b7280' },
                { label: 'Paiements en retard', val: stats.retard, icon: '⚠️', color: stats.retard > 0 ? '#dc2626' : '#6b7280' },
                { label: 'Acomptes encaissés', val: formatPrice(stats.ca, 'XOF'), icon: '💰', color: '#1D9E75' },
              ].map(s => (
                <div key={s.label} className="card" style={{ padding: 24 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Répartition statuts */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Répartition des terrains</h3>
              {[
                { label: 'Disponibles', count: stats.dispo, color: '#1D9E75' },
                { label: 'Réservés', count: stats.reserve, color: '#d97706' },
                { label: 'Vendus', count: stats.vendu, color: '#dc2626' },
              ].map(s => (
                <div key={s.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
                    <span>{s.label}</span>
                    <span style={{ fontWeight: 600 }}>{s.count} / {terrains.length}</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${terrains.length ? (s.count / terrains.length) * 100 : 0}%`, background: s.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Terrains */}
        {tab === 'terrains' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600 }}>Gestion des terrains</h2>
              <button className="btn btn-primary" onClick={() => { setEditTerrain(EMPTY_TERRAIN); setShowTerrainForm(true) }}>
                + Nouveau terrain
              </button>
            </div>

            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      {['Référence', 'Nom', 'Localisation', 'Superficie', 'Prix', 'Statut', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {terrains.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--muted)' }}>{t.reference}</td>
                        <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 500 }}>{t.nom}</td>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--muted)' }}>{t.localisation}</td>
                        <td style={{ padding: '14px 16px', fontSize: 13 }}>{t.superficie.toLocaleString('fr-FR')} m²</td>
                        <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 500 }}>{formatPrice(t.prix_fcfa, 'XOF')}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span className={`badge badge-${t.statut}`}>
                            {t.statut === 'dispo' ? 'Disponible' : t.statut === 'reserve' ? 'Réservé' : 'Vendu'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => { setEditTerrain(t); setShowTerrainForm(true) }}
                              style={{ background: 'var(--terra-light)', color: 'var(--terra)', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>
                              Modifier
                            </button>
                            <button onClick={() => deleteTerrain(t.id)}
                              style={{ background: '#fce8e8', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>
                              Suppr.
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Réservations */}
        {tab === 'reservations' && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Gestion des réservations</h2>
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      {['Terrain', 'Date', 'Acompte', 'Paiements', 'Statut', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map(r => {
                      const paye = (r.paiements || []).filter(p => p.statut === 'paye').length
                      const total = (r.paiements || []).length
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 500 }}>{r.terrain?.nom ?? '—'}</td>
                          <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--muted)' }}>{new Date(r.date_reservation).toLocaleDateString('fr-FR')}</td>
                          <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 500, color: 'var(--terra)' }}>{formatPrice(r.montant_acompte, 'XOF')}</td>
                          <td style={{ padding: '14px 16px', fontSize: 13 }}>{paye}/{total}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <span className={`badge ${r.statut === 'validee' ? 'badge-dispo' : r.statut === 'en_cours' ? 'badge-reserve' : 'badge-vendu'}`}>
                              {r.statut === 'validee' ? 'Validée' : r.statut === 'en_cours' ? 'En cours' : 'Annulée'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <select
                              value={r.statut}
                              onChange={e => updateStatutReservation(r.id, e.target.value as Reservation['statut'])}
                              style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer', background: 'var(--bg)' }}
                            >
                              <option value="en_cours">En cours</option>
                              <option value="validee">Validée</option>
                              <option value="annulee">Annulée</option>
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Alertes */}
        {tab === 'alertes' && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Paiements en retard</h2>
            {reservations.flatMap(r =>
              (r.paiements || []).filter(p => p.statut === 'en_retard').map(p => ({ ...p, terrain: r.terrain }))
            ).length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <div>Aucun paiement en retard</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {reservations.flatMap(r =>
                  (r.paiements || []).filter(p => p.statut === 'en_retard').map(p => (
                    <div key={p.id} className="card" style={{ padding: 20, borderLeft: '4px solid #dc2626' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.terrain?.nom} — Éch. {new Date(p.date_echeance).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>
                          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                            Échéance : {new Date(p.date_echeance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className="badge badge-vendu">⚠️ En retard</span>
                          <div style={{ fontWeight: 700, color: '#dc2626', marginTop: 4 }}>{formatPrice(p.montant, 'XOF')}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* KYC */}
        {tab === 'kyc' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600 }}>Vérification d'identité (KYC)</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {['en_attente', 'valide', 'refuse'].map(s => (
                  <span key={s} style={{
                    padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 500,
                    background: s === 'en_attente' ? '#fffbeb' : s === 'valide' ? 'var(--terra-light)' : '#fef2f2',
                    color: s === 'en_attente' ? '#d97706' : s === 'valide' ? 'var(--terra)' : '#dc2626',
                    border: `1px solid ${s === 'en_attente' ? '#fde68a' : s === 'valide' ? 'var(--terra)' : '#fecaca'}`,
                  }}>
                    {kycList.filter(k => k.statut === s).length} {s === 'en_attente' ? 'en attente' : s === 'valide' ? 'validé(s)' : 'refusé(s)'}
                  </span>
                ))}
              </div>
            </div>

            {/* Tableau KYC */}
            <div className="card" style={{ overflow: 'hidden', marginBottom: selectedKyc ? 24 : 0 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      {['Client', 'Type doc.', 'Date soumission', 'Statut', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {kycList.map(k => (
                      <tr key={k.id} style={{ borderBottom: '1px solid var(--border)', background: selectedKyc?.id === k.id ? 'var(--terra-light)' : 'transparent', transition: 'background 0.2s' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{k.profil?.nom_complet ?? k.profil_id}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{k.profil?.email}</div>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 13 }}>
                          {k.document_type === 'cni' ? '🪪 CNI' : '📘 Passeport'}
                          {k.document_type === 'cni' && <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Recto + Verso</span>}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--muted)' }}>
                          {new Date(k.date_soumission).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: 100, fontSize: 12, fontWeight: 500,
                            background: k.statut === 'valide' ? 'var(--terra-light)' : k.statut === 'en_attente' ? '#fffbeb' : '#fef2f2',
                            color: k.statut === 'valide' ? 'var(--terra)' : k.statut === 'en_attente' ? '#d97706' : '#dc2626',
                          }}>
                            {k.statut === 'valide' ? '✓ Validé' : k.statut === 'en_attente' ? '⏳ En attente' : '✕ Refusé'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <button
                            onClick={() => { setSelectedKyc(selectedKyc?.id === k.id ? null : k); setShowMotifInput(false); setMotifRefus('') }}
                            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                          >
                            {selectedKyc?.id === k.id ? 'Fermer' : 'Examiner'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Panneau de détail KYC */}
            {selectedKyc && (
              <div className="card" style={{ padding: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
                      {selectedKyc.profil?.nom_complet}
                    </h3>
                    <div style={{ fontSize: 14, color: 'var(--muted)' }}>{selectedKyc.profil?.email} · {selectedKyc.profil?.telephone}</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                      {selectedKyc.profil?.type_profil === 'diaspora' ? '✈️ Diaspora' : '🌍 Résident local'} · {selectedKyc.profil?.pays_residence}
                    </div>
                  </div>
                  <span style={{
                    padding: '6px 14px', borderRadius: 100, fontSize: 13, fontWeight: 600,
                    background: selectedKyc.statut === 'valide' ? 'var(--terra-light)' : selectedKyc.statut === 'en_attente' ? '#fffbeb' : '#fef2f2',
                    color: selectedKyc.statut === 'valide' ? 'var(--terra)' : selectedKyc.statut === 'en_attente' ? '#d97706' : '#dc2626',
                  }}>
                    {selectedKyc.statut === 'valide' ? '✓ Validé' : selectedKyc.statut === 'en_attente' ? '⏳ En attente' : '✕ Refusé'}
                  </span>
                </div>

                {/* Documents */}
                <div style={{ display: 'grid', gridTemplateColumns: selectedKyc.document_url2 ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 24 }}>
                  {[
                    { label: selectedKyc.document_type === 'cni' ? 'Recto CNI' : 'Passeport', url: selectedKyc.document_url },
                    ...(selectedKyc.document_url2 ? [{ label: 'Verso CNI', url: selectedKyc.document_url2 }] : []),
                  ].map(doc => (
                    <div key={doc.label}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{doc.label}</div>
                      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' }}>
                        <img
                          src={doc.url} alt={doc.label}
                          style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }}
                          onError={e => { (e.currentTarget as HTMLImageElement).src = 'https://via.placeholder.com/400x200?text=Document' }}
                        />
                        <a
                          href={doc.url} target="_blank" rel="noopener noreferrer"
                          style={{
                            position: 'absolute', bottom: 8, right: 8,
                            background: 'rgba(0,0,0,0.6)', color: 'white',
                            padding: '4px 10px', borderRadius: 6, fontSize: 11, textDecoration: 'none',
                          }}
                        >
                          Agrandir ↗
                        </a>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Motif refus existant */}
                {selectedKyc.statut === 'refuse' && selectedKyc.motif_refus && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 13 }}>
                    <strong style={{ color: '#dc2626' }}>Motif de refus :</strong>
                    <p style={{ color: '#7f1d1d', margin: '4px 0 0' }}>{selectedKyc.motif_refus}</p>
                  </div>
                )}

                {/* Actions (seulement si en attente) */}
                {selectedKyc.statut === 'en_attente' && (
                  <div>
                    {!showMotifInput ? (
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleValidateKyc(selectedKyc)}
                          disabled={kycLoading}
                          style={{ flex: 1, minWidth: 140 }}
                        >
                          {kycLoading ? 'Traitement...' : '✓ Valider ce KYC'}
                        </button>
                        <button
                          onClick={() => setShowMotifInput(true)}
                          style={{ flex: 1, minWidth: 140, padding: '10px 20px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500 }}
                        >
                          ✕ Refuser
                        </button>
                      </div>
                    ) : (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 16 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', display: 'block', marginBottom: 8 }}>
                          Motif du refus <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <textarea
                          className="input"
                          rows={3}
                          placeholder="Ex: Document illisible — photo floue. Veuillez soumettre une photo nette et bien éclairée."
                          value={motifRefus}
                          onChange={e => setMotifRefus(e.target.value)}
                          style={{ resize: 'vertical', marginBottom: 12 }}
                        />
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button onClick={() => { setShowMotifInput(false); setMotifRefus('') }}
                            style={{ flex: 1, padding: '9px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                            Annuler
                          </button>
                          <button
                            onClick={() => handleRejectKyc(selectedKyc)}
                            disabled={kycLoading || !motifRefus.trim()}
                            style={{ flex: 2, padding: '9px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: !motifRefus.trim() ? 0.6 : 1 }}
                          >
                            {kycLoading ? 'Traitement...' : 'Confirmer le refus'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Documents */}
        {tab === 'documents' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600 }}>Gestion des documents</h2>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {documents.length} document{documents.length > 1 ? 's' : ''} généré{documents.length > 1 ? 's' : ''}
              </div>
            </div>

            {contratsList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📜</div>
                <div>Aucun contrat actif.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {contratsList.map(c => {
                  const docsForContrat = documents.filter(d => d.contrat_id === c.id)
                  return (
                    <div key={c.id} className="card" style={{ padding: 24 }}>
                      {/* En-tête contrat */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>{c.terrain.nom}</h3>
                            <span className={`badge ${c.statut === 'actif' ? 'badge-reserve' : c.statut === 'solde' ? 'badge-dispo' : 'badge-vendu'}`}>
                              {c.statut === 'actif' ? 'Actif' : c.statut === 'solde' ? '🏆 Soldé' : 'Résilié'}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                            Client : <strong>{c.clientNom}</strong> · {c.terrain.reference} · {c.terrain.localisation}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                            {formatPrice(c.prix_total, 'XOF')} · {c.duree_mois} mois
                          </div>
                        </div>

                        {/* Boutons de génération */}
                        <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-outline"
                            style={{ fontSize: 13, padding: '8px 14px' }}
                            disabled={generatingDoc === `${c.id}-provisoire` || c.statut === 'resilie'}
                            onClick={() => handleGenerateDocument(c, 'provisoire')}
                          >
                            {generatingDoc === `${c.id}-provisoire` ? '⏳...' : '📄 Doc provisoire'}
                          </button>
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: 13, padding: '8px 14px', opacity: c.statut !== 'solde' ? 0.5 : 1 }}
                            disabled={generatingDoc === `${c.id}-acd` || c.statut !== 'solde'}
                            title={c.statut !== 'solde' ? 'Disponible uniquement quand le contrat est soldé' : ''}
                            onClick={() => handleGenerateDocument(c, 'acd')}
                          >
                            {generatingDoc === `${c.id}-acd` ? '⏳...' : '🏆 ACD'}
                          </button>
                          {c.statut === 'actif' && (
                            <button
                              onClick={async () => {
                                let montantVerse = 0
                                if (!IS_DEMO) {
                                  const { data } = await supabase
                                    .from('paiements')
                                    .select('montant')
                                    .eq('contrat_id', c.id)
                                    .eq('statut', 'paye')
                                  montantVerse = (data || []).reduce((s: number, p: { montant: number }) => s + p.montant, 0)
                                } else {
                                  // Démo : simuler un montant versé (acompte + 3 mensualités)
                                  const acompte = Math.round(c.prix_total * (c.terrain.acompte_pct / 100))
                                  const mensualite = Math.round(c.prix_total * (1 - c.terrain.acompte_pct / 100) / c.duree_mois)
                                  montantVerse = acompte + mensualite * 3
                                }
                                setResiliationTarget({ ...c, montantVerse })
                              }}
                              style={{
                                fontSize: 13, padding: '8px 14px',
                                background: '#fef2f2', color: '#dc2626',
                                border: '1px solid #fecaca', borderRadius: 8,
                                cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500,
                              }}
                            >
                              ⚠️ Résilier
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Documents générés */}
                      {docsForContrat.length > 0 && (
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                            Documents générés
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {docsForContrat.map(d => (
                              <div key={d.id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '10px 14px', background: 'var(--bg)', borderRadius: 8,
                                border: d.statut === 'revoque' ? '1px solid #fecaca' : '1px solid var(--border)',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <span style={{ fontSize: 18 }}>{d.type === 'acd' ? '🏆' : '📄'}</span>
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                                      {d.type === 'acd' ? 'ACD' : 'Doc. provisoire'} · {d.numero_unique}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                      Généré le {new Date(d.date_generation).toLocaleDateString('fr-FR')}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <span className={`badge ${d.statut === 'actif' ? 'badge-dispo' : 'badge-vendu'}`}>
                                    {d.statut === 'actif' ? '✓ Actif' : '✕ Révoqué'}
                                  </span>
                                  <button
                                    onClick={() => setDocViewer({ doc: d, contrat: c })}
                                    style={{ background: 'none', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, padding: '5px 10px', borderRadius: 6, color: 'var(--terra)' }}
                                  >
                                    Voir
                                  </button>
                                  {d.statut === 'actif' && (
                                    <button
                                      onClick={() => handleRevokeDocument(d.id)}
                                      style={{ background: 'none', border: '1px solid #fecaca', cursor: 'pointer', fontSize: 12, padding: '5px 10px', borderRadius: 6, color: '#dc2626' }}
                                    >
                                      Révoquer
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {docsForContrat.length === 0 && (
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, fontSize: 13, color: 'var(--muted)' }}>
                          Aucun document généré pour ce contrat.
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {IS_DEMO && (
              <div style={{ marginTop: 24, padding: 16, background: 'var(--terra-light)', borderRadius: 10, fontSize: 13, color: 'var(--terra-dark)', textAlign: 'center' }}>
                Mode démo — les documents générés sont stockés localement et non dans Supabase.
              </div>
            )}
          </div>
        )}

        {/* Journal audit */}
        {tab === 'audit' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600 }}>Journal d'audit</h2>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {journal.length} entrée{journal.length > 1 ? 's' : ''} · 100 dernières
              </div>
            </div>

            {journal.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                <div>Aucune entrée dans le journal.</div>
              </div>
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                        {['Date', 'Admin', 'Action', 'Entité', 'Motif'].map(h => (
                          <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {journal.map(j => {
                        const actionColor = j.action.includes('refuse') || j.action.includes('resiliation') ? '#dc2626'
                          : j.action.includes('valide') || j.action.includes('cree') ? '#1D9E75'
                          : '#d97706'
                        return (
                          <tr key={j.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                              {new Date(j.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                              <div style={{ fontSize: 11, marginTop: 2 }}>
                                {new Date(j.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </td>
                            <td style={{ padding: '13px 16px', fontSize: 13 }}>
                              <div style={{ fontWeight: 500 }}>{j.admin?.nom_complet ?? j.admin_id}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{j.admin?.email}</div>
                            </td>
                            <td style={{ padding: '13px 16px' }}>
                              <span style={{
                                padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                                background: actionColor + '18', color: actionColor,
                              }}>
                                {j.action.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--muted)' }}>
                              <div>{j.entite_concernee}</div>
                              <div style={{ fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>{j.entite_id.slice(0, 8)}…</div>
                            </td>
                            <td style={{ padding: '13px 16px', fontSize: 13, maxWidth: 240 }}>
                              <div style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, color: 'var(--text)' }}>
                                {j.motif || '—'}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Paramètres */}
        {tab === 'parametres' && (
          <div style={{ maxWidth: 480 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Paramètres</h2>
            <div className="card" style={{ padding: 32 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Taux de marge</h3>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, color: 'var(--muted)' }}>Taux actuel</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--terra)' }}>{margeTaux}%</span>
                </div>
                <input
                  type="range" min={5} max={6} step={0.1} value={margeTaux}
                  onChange={e => setMargeTaux(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--terra)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  <span>5% (minimum)</span>
                  <span>6% (maximum)</span>
                </div>
              </div>
              <div style={{ background: 'var(--terra-light)', borderRadius: 10, padding: 14, fontSize: 13, color: 'var(--terra-dark)' }}>
                <strong>Simulation :</strong> Pour un terrain acheté à 10 000 000 FCFA,<br />
                le prix de vente sera <strong>{formatPrice(10000000 * (1 + margeTaux / 100), 'XOF')}</strong> avec un taux de {margeTaux}%.
              </div>
              <button className="btn btn-primary" style={{ marginTop: 20, width: '100%' }} onClick={() => showToast('Paramètres sauvegardés', 'success')}>
                Sauvegarder
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Document Viewer */}
      {docViewer && (
        <DocumentViewer
          document={docViewer.doc}
          contrat={docViewer.contrat}
          terrain={docViewer.contrat.terrain}
          clientNom={docViewer.contrat.clientNom}
          onClose={() => setDocViewer(null)}
        />
      )}

      {/* Résiliation Modal */}
      {resiliationTarget && (
        <ResiliationModal
          contrat={resiliationTarget}
          adminProfil={profil}
          montantVerse={resiliationTarget.montantVerse}
          onClose={() => setResiliationTarget(null)}
          onSuccess={handleResiliationSuccess}
          showToast={showToast}
        />
      )}

      {/* Terrain form modal */}
      {showTerrainForm && (
        <div className="overlay-bg" onClick={closeForm}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 660 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 24 }}>
              {editTerrain.id ? 'Modifier le terrain' : 'Nouveau terrain'}
            </h2>

            {/* Infos générales */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {([
                { field: 'reference', label: 'Référence *', type: 'text', placeholder: 'KL-2024-009' },
                { field: 'nom', label: 'Nom du terrain *', type: 'text', placeholder: 'Villa Corniche' },
                { field: 'localisation', label: 'Localisation *', type: 'text', placeholder: 'Dakar, Almadies' },
                { field: 'superficie', label: 'Superficie (m²) *', type: 'number', placeholder: '500' },
                { field: 'prix_fcfa', label: 'Prix total (FCFA) *', type: 'number', placeholder: '10000000' },
                { field: 'statut_juridique', label: 'Statut juridique', type: 'text', placeholder: 'Titre foncier enregistré' },
              ] as const).map(f => (
                <div key={f.field}>
                  <label className="label">{f.label}</label>
                  <input
                    className="input" type={f.type}
                    placeholder={f.placeholder}
                    value={(editTerrain as any)[f.field] ?? ''}
                    onChange={e => setEditTerrain(v => ({ ...v, [f.field]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                  />
                </div>
              ))}

              {/* Pays */}
              <div>
                <label className="label">Pays *</label>
                <select className="input" value={editTerrain.pays ?? 'Sénégal'} onChange={e => setEditTerrain(v => ({ ...v, pays: e.target.value }))}>
                  {PAYS_TERRAINS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* Statut */}
              <div>
                <label className="label">Statut</label>
                <select className="input" value={editTerrain.statut ?? 'dispo'} onChange={e => setEditTerrain(v => ({ ...v, statut: e.target.value as Terrain['statut'] }))}>
                  <option value="dispo">Disponible</option>
                  <option value="reserve">Réservé</option>
                  <option value="vendu">Vendu</option>
                </select>
              </div>

              {/* Acompte % */}
              <div>
                <label className="label">
                  Acompte requis — <strong style={{ color: 'var(--terra)' }}>{editTerrain.acompte_pct ?? 20}%</strong>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>(20–30%)</span>
                </label>
                <input
                  type="range" min={20} max={30} step={5}
                  value={editTerrain.acompte_pct ?? 20}
                  onChange={e => setEditTerrain(v => ({ ...v, acompte_pct: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--terra)', marginTop: 6 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
                  <span>20%</span><span>25%</span><span>30%</span>
                </div>
              </div>

              {/* Durée paiement */}
              <div>
                <label className="label">
                  Durée paiement — <strong style={{ color: 'var(--terra)' }}>{editTerrain.duree_mois ?? 24} mois</strong>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>(1–36)</span>
                </label>
                <input
                  type="range" min={1} max={36} step={1}
                  value={editTerrain.duree_mois ?? 24}
                  onChange={e => setEditTerrain(v => ({ ...v, duree_mois: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--terra)', marginTop: 6 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
                  <span>1 mois</span><span>18</span><span>36 mois</span>
                </div>
              </div>

              {/* Simulation rapide */}
              {editTerrain.prix_fcfa && editTerrain.prix_fcfa > 0 && (
                <div style={{ gridColumn: 'span 2', background: 'var(--terra-light)', borderRadius: 10, padding: 14, fontSize: 13, color: 'var(--terra-dark)' }}>
                  <strong>Simulation :</strong> Acompte {' '}
                  <strong>{formatPrice(Math.round((editTerrain.prix_fcfa ?? 0) * (editTerrain.acompte_pct ?? 20) / 100), 'XOF')}</strong>
                  {' '}· Mensualité {' '}
                  <strong>{formatPrice(Math.round((editTerrain.prix_fcfa ?? 0) * (1 - (editTerrain.acompte_pct ?? 20) / 100) / (editTerrain.duree_mois ?? 24)), 'XOF')}/mois</strong>
                  {' '}sur {editTerrain.duree_mois ?? 24} mois
                </div>
              )}

              {/* Titre foncier */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="tf" checked={editTerrain.titre_foncier ?? false}
                  onChange={e => setEditTerrain(v => ({ ...v, titre_foncier: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: 'var(--terra)' }} />
                <label htmlFor="tf" style={{ fontSize: 14, cursor: 'pointer' }}>Titre foncier inclus</label>
              </div>

              {/* Description */}
              <div style={{ gridColumn: 'span 2' }}>
                <label className="label">Description</label>
                <textarea
                  className="input" rows={3}
                  placeholder="Décrivez le terrain, son environnement, les accès..."
                  value={editTerrain.description || ''}
                  onChange={e => setEditTerrain(v => ({ ...v, description: e.target.value }))}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>

            {/* ── Photos ── */}
            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="section-label">Photos du terrain</div>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{(editTerrain.images || []).length}/8 photos</span>
              </div>

              <div
                style={{
                  display: 'flex', flexWrap: 'wrap', gap: 10,
                  minHeight: 80, padding: 12,
                  border: dragOver ? '2px dashed var(--terra)' : '2px dashed var(--border)',
                  borderRadius: 12, background: dragOver ? 'var(--terra-light)' : 'var(--bg)',
                  transition: 'all 0.2s',
                }}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault(); setDragOver(false)
                  handleImagesAdd(e.dataTransfer.files)
                }}
              >
                {/* Thumbnails existants */}
                {(editTerrain.images || []).map((url, i) => (
                  <div key={i} style={{ position: 'relative', width: 80, height: 64, flexShrink: 0 }}>
                    <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                    <button
                      onClick={() => removeImage(i)}
                      style={{
                        position: 'absolute', top: -6, right: -6,
                        width: 20, height: 20, borderRadius: '50%',
                        background: '#dc2626', color: 'white', border: 'none',
                        cursor: 'pointer', fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                      }}
                    >✕</button>
                    {url.startsWith('blob:') && (
                      <div style={{ position: 'absolute', bottom: 3, left: 3, background: 'var(--terra)', borderRadius: 3, padding: '1px 4px', fontSize: 9, color: 'white', fontWeight: 600 }}>
                        NEW
                      </div>
                    )}
                  </div>
                ))}

                {/* Bouton ajout */}
                {(editTerrain.images || []).length < 8 && (
                  <label style={{
                    width: 80, height: 64, borderRadius: 8, flexShrink: 0,
                    border: '2px dashed var(--border)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--muted)', gap: 4, transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--terra)'; (e.currentTarget as HTMLElement).style.color = 'var(--terra)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--muted)' }}
                  >
                    <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
                    <span style={{ fontSize: 10 }}>Photo</span>
                    <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleImagesAdd(e.target.files)} />
                  </label>
                )}

                {(editTerrain.images || []).length === 0 && !dragOver && (
                  <div style={{ width: '100%', textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>
                    Glissez-déposez des photos ici, ou cliquez sur +
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                Formats acceptés : JPG, PNG, WebP · Max 8 photos
              </div>
            </div>

            {/* ── Vidéo ── */}
            <div style={{ marginTop: 20 }}>
              <div className="section-label" style={{ marginBottom: 12 }}>Vidéo du terrain</div>

              {editTerrain.video_url ? (
                <div style={{ position: 'relative' }}>
                  <video
                    src={editTerrain.video_url}
                    controls
                    playsInline
                    style={{ width: '100%', maxHeight: 220, borderRadius: 10, background: '#000', display: 'block' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      🎬
                      {pendingVideoFile && (
                        <span>
                          {pendingVideoFile.name} · {(pendingVideoFile.size / 1024 / 1024).toFixed(1)} Mo
                        </span>
                      )}
                      {!pendingVideoFile && editTerrain.video_url && <span>Vidéo existante</span>}
                    </div>
                    <button
                      onClick={removeVideo}
                      style={{
                        background: '#fce8e8', color: '#dc2626', border: 'none',
                        borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                      }}
                    >
                      Supprimer la vidéo
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    height: 110, border: '2px dashed var(--border)', borderRadius: 12,
                    cursor: 'pointer', color: 'var(--muted)', gap: 8, transition: 'all 0.2s',
                    background: 'var(--bg)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--terra)'; (e.currentTarget as HTMLElement).style.color = 'var(--terra)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--muted)' }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleVideoAdd(f) }}
                >
                  <span style={{ fontSize: 32 }}>🎬</span>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>Cliquez ou glissez une vidéo ici</span>
                  <span style={{ fontSize: 12 }}>MP4, MOV, WebM · Max 50 Mo</span>
                  <input type="file" accept="video/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleVideoAdd(f) }} />
                </label>
              )}
            </div>

            {/* Upload progress */}
            {uploadStatus && (
              <div style={{ marginTop: 16, padding: 12, background: 'var(--terra-light)', borderRadius: 8, fontSize: 13, color: 'var(--terra-dark)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--terra)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                {uploadStatus}
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-outline" onClick={closeForm} style={{ flex: 1 }} disabled={saving}>Annuler</button>
              <button className="btn btn-primary" onClick={saveTerrain} disabled={saving} style={{ flex: 1 }}>
                {saving ? (uploadStatus || 'Sauvegarde...') : editTerrain.id ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
