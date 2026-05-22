'use client'

import { useState, useEffect } from 'react'
import { supabase, IS_DEMO, MOCK_TERRAINS, type Terrain, type Profil, peutReserver } from '@/lib/supabase'
import { formatPrice, convertPrice, CURRENCIES } from '@/lib/currency'

interface CatalogueProps {
  onTerrainClick: (t: Terrain) => void
  profil: Profil | null
  onLoginRequired: () => void
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const PAYS_LIST = ['Tous', 'Sénégal', "Côte d'Ivoire", 'Togo', 'Bénin', 'Burkina Faso']

export default function Catalogue({ onTerrainClick, profil, onLoginRequired, showToast }: CatalogueProps) {
  const [terrains, setTerrains] = useState<Terrain[]>(MOCK_TERRAINS)
  const [loading, setLoading] = useState(!IS_DEMO)
  const [search, setSearch] = useState('')
  const [filterPays, setFilterPays] = useState('Tous')
  const [filterStatut, setFilterStatut] = useState('tous')
  const [filterPrixMax, setFilterPrixMax] = useState(100000000)
  const [sortBy, setSortBy] = useState('recent')
  const [wishlist, setWishlist] = useState<string[]>([])
  const [currency, setCurrency] = useState('XOF')

  useEffect(() => {
    const saved = localStorage.getItem('klo_wishlist')
    if (saved) setWishlist(JSON.parse(saved))
    if (!IS_DEMO) fetchTerrains()
  }, [])

  async function fetchTerrains() {
    setLoading(true)
    const { data } = await supabase.from('terrains').select('*').order('created_at', { ascending: false })
    if (data && data.length > 0) setTerrains(data)
    setLoading(false)
  }

  function toggleWishlist(id: string) {
    const next = wishlist.includes(id) ? wishlist.filter(w => w !== id) : [...wishlist, id]
    setWishlist(next)
    localStorage.setItem('klo_wishlist', JSON.stringify(next))
    showToast(next.includes(id) ? 'Ajouté aux favoris' : 'Retiré des favoris')
  }

  const filtered = terrains
    .filter(t => {
      if (search && !t.nom.toLowerCase().includes(search.toLowerCase()) && !t.localisation.toLowerCase().includes(search.toLowerCase())) return false
      if (filterPays !== 'Tous' && t.pays !== filterPays) return false
      if (filterStatut !== 'tous' && t.statut !== filterStatut) return false
      if (t.prix_fcfa > filterPrixMax) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'prix_asc') return a.prix_fcfa - b.prix_fcfa
      if (sortBy === 'prix_desc') return b.prix_fcfa - a.prix_fcfa
      if (sortBy === 'superficie') return b.superficie - a.superficie
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  return (
    <div style={{ paddingTop: 80, minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0d2b1f, #1a4a35)', padding: '48px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="section-label" style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>Nos propriétés</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 600, color: 'white', marginBottom: 16, letterSpacing: '-0.02em' }}>
            Catalogue des terrains
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>{filtered.length} terrain{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Bannière KYC pour utilisateurs non vérifiés */}
        {profil && !peutReserver(profil) && (
          <div style={{
            marginBottom: 24, padding: '14px 20px', borderRadius: 12,
            background: profil.statut_kyc === 'en_attente' ? '#fffbeb' : '#f0fdf4',
            border: `1px solid ${profil.statut_kyc === 'en_attente' ? '#fde68a' : '#bbf7d0'}`,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 20 }}>
              {profil.statut_kyc === 'en_attente' ? '⏳' : '🪪'}
            </span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: profil.statut_kyc === 'en_attente' ? '#d97706' : '#166534' }}>
                {profil.statut_kyc === 'en_attente'
                  ? 'Vérification en cours — vous pouvez parcourir le catalogue'
                  : 'Vérification d\'identité requise pour réserver'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {profil.statut_kyc === 'en_attente'
                  ? 'Votre dossier KYC est traité sous 24-48h.'
                  : 'Soumettez votre CNI ou passeport dans Mon espace pour débloquer les réservations.'}
              </div>
            </div>
            {profil.statut_kyc === 'non_soumis' && (
              <button className="btn btn-primary" style={{ fontSize: 13, padding: '8px 16px', whiteSpace: 'nowrap' }}
                onClick={() => showToast('Accédez à Mon espace → Mon profil pour soumettre votre KYC', 'info')}>
                Soumettre mon KYC
              </button>
            )}
          </div>
        )}

        {/* Filters bar */}
        <div className="card" style={{ padding: '20px 24px', marginBottom: 28, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input className="input" placeholder="Rechercher un terrain..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }} />
          </div>

          {/* Pays */}
          <select className="input" value={filterPays} onChange={e => setFilterPays(e.target.value)} style={{ flex: 1, minWidth: 140 }}>
            {PAYS_LIST.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          {/* Statut */}
          <select className="input" value={filterStatut} onChange={e => setFilterStatut(e.target.value)} style={{ flex: 1, minWidth: 140 }}>
            <option value="tous">Tous les statuts</option>
            <option value="dispo">Disponible</option>
            <option value="reserve">Réservé</option>
            <option value="vendu">Vendu</option>
          </select>

          {/* Tri */}
          <select className="input" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ flex: 1, minWidth: 140 }}>
            <option value="recent">Plus récents</option>
            <option value="prix_asc">Prix croissant</option>
            <option value="prix_desc">Prix décroissant</option>
            <option value="superficie">Superficie</option>
          </select>

          {/* Devise */}
          <select className="input" value={currency} onChange={e => setCurrency(e.target.value)} style={{ flex: 1, minWidth: 120 }}>
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
          </select>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            Chargement des terrains...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 18, marginBottom: 8 }}>Aucun terrain trouvé</div>
            <div style={{ fontSize: 14 }}>Essayez d'autres filtres</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
            {filtered.map(terrain => (
              <TerrainCard
                key={terrain.id}
                terrain={terrain}
                currency={currency}
                inWishlist={wishlist.includes(terrain.id)}
                onWishlist={() => toggleWishlist(terrain.id)}
                onClick={() => onTerrainClick(terrain)}
              />
            ))}
          </div>
        )}

        {IS_DEMO && (
          <div style={{
            marginTop: 40, padding: 20, background: 'var(--terra-light)',
            borderRadius: 12, border: '1px solid var(--terra)',
            fontSize: 14, color: 'var(--terra-dark)', textAlign: 'center',
          }}>
            🔧 Mode démo — Ces terrains sont des exemples. Connectez Supabase pour afficher vos vraies données.
          </div>
        )}
      </div>
    </div>
  )
}

function TerrainCard({ terrain, currency, inWishlist, onWishlist, onClick }: {
  terrain: Terrain
  currency: string
  inWishlist: boolean
  onWishlist: () => void
  onClick: () => void
}) {
  const prixConverti = convertPrice(terrain.prix_fcfa, currency)
  const mensualite = convertPrice(terrain.prix_fcfa * 0.8 / terrain.duree_mois, currency)

  return (
    <div
      className="card"
      style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.09)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '' }}
      onClick={onClick}
    >
      {/* Image */}
      <div style={{ height: 200, overflow: 'hidden', position: 'relative' }}>
        <img src={terrain.images[0]} alt={terrain.nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

        {/* Badges overlay */}
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
          <span className={`badge badge-${terrain.statut}`}>
            {terrain.statut === 'dispo' ? '✓ Disponible' : terrain.statut === 'reserve' ? '⏳ Réservé' : '✗ Vendu'}
          </span>
        </div>

        {/* Actions */}
        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
          {terrain.titre_foncier && (
            <span className="badge" style={{ background: 'rgba(0,0,0,0.6)', color: 'white', backdropFilter: 'blur(4px)' }}>
              📜 TF
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); onWishlist() }}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,0.9)', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = ''}
          >
            {inWishlist ? '❤️' : '🤍'}
          </button>
        </div>

        {/* Image count */}
        {terrain.images.length > 1 && (
          <div style={{ position: 'absolute', bottom: 10, right: 10 }}>
            <span className="badge" style={{ background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: 10 }}>
              📷 {terrain.images.length}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '18px 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>
              {terrain.pays} · {terrain.localisation}
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600, lineHeight: 1.2 }}>
              {terrain.nom}
            </h3>
          </div>
          <div style={{
            background: 'var(--terra-light)', color: 'var(--terra)',
            padding: '4px 10px', borderRadius: 8, fontSize: 13, fontWeight: 500, flexShrink: 0,
          }}>
            {terrain.superficie.toLocaleString('fr-FR')} m²
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 16, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
          {terrain.description}
        </p>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Prix total</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>
              {formatPrice(prixConverti, currency)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Dès</div>
            <div style={{ fontWeight: 600, color: 'var(--terra)', fontSize: 15 }}>
              {formatPrice(mensualite, currency)}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)' }}>/mois</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
