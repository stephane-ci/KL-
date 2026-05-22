'use client'

import { useState, useEffect } from 'react'
import { supabase, type Page, type Profil } from '@/lib/supabase'
import NotificationsBell from '@/components/NotificationsBell'

interface NavProps {
  page: Page
  profil: Profil | null
  onNavigate: (p: Page) => void
  onLoginClick: () => void
}

export default function Nav({ page, profil, onNavigate, onLoginClick }: NavProps) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setUserMenuOpen(false)
    onNavigate('accueil')
  }

  const isHero = page === 'accueil' && !scrolled

  return (
    <nav
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40,
        transition: 'all 0.3s ease',
        background: isHero ? 'transparent' : 'rgba(250,250,248,0.95)',
        backdropFilter: isHero ? 'none' : 'blur(12px)',
        borderBottom: isHero ? 'none' : '1px solid var(--border)',
        padding: isHero ? '20px 0' : '14px 0',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <button
          onClick={() => onNavigate('accueil')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600,
            color: isHero ? 'white' : 'var(--text)',
            letterSpacing: '-0.02em',
          }}
        >
          KL<span style={{ color: 'var(--terra)' }}>ô</span>
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: 8 }}>
          {[
            { label: 'Accueil', page: 'accueil' as Page },
            { label: 'Catalogue', page: 'catalogue' as Page },
          ].map(link => (
            <button
              key={link.page}
              onClick={() => onNavigate(link.page)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '8px 14px', borderRadius: 8, fontSize: 14,
                fontFamily: 'var(--font-body)',
                color: page === link.page
                  ? 'var(--terra)'
                  : isHero ? 'rgba(255,255,255,0.85)' : 'var(--muted)',
                fontWeight: page === link.page ? 600 : 400,
                transition: 'color 0.2s',
              }}
            >
              {link.label}
            </button>
          ))}

          {profil && (
            <button
              onClick={() => onNavigate(profil.is_admin ? 'admin' : 'client')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '8px 14px', borderRadius: 8, fontSize: 14,
                fontFamily: 'var(--font-body)',
                color: (page === 'client' || page === 'admin')
                  ? 'var(--terra)'
                  : isHero ? 'rgba(255,255,255,0.85)' : 'var(--muted)',
                fontWeight: (page === 'client' || page === 'admin') ? 600 : 400,
                transition: 'color 0.2s',
              }}
            >
              {profil.is_admin ? 'Administration' : 'Mon espace'}
            </button>
          )}
        </div>

        {/* Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Cloche notifications — uniquement si connecté */}
          {profil && <NotificationsBell profil={profil} isHero={isHero} />}

          {!profil ? (
            <button className="btn btn-primary" onClick={onLoginClick} style={{ fontSize: 13 }}>
              Connexion
            </button>
          ) : (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'none', border: '1.5px solid var(--border)',
                  borderRadius: 100, padding: '6px 14px 6px 6px',
                  cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13,
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--terra)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 600,
                }}>
                  {profil.nom_complet.charAt(0).toUpperCase()}
                </div>
                <span style={{ color: 'var(--text)' }}>{profil.nom_complet.split(' ')[0]}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 4l4 4 4-4" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>

              {userMenuOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: 8, minWidth: 180,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 50,
                }}>
                  <button onClick={() => { onNavigate(profil.is_admin ? 'admin' : 'client'); setUserMenuOpen(false) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, borderRadius: 8, color: 'var(--text)' }}>
                    {profil.is_admin ? '⚙️ Administration' : '👤 Mon espace'}
                  </button>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                  <button onClick={handleLogout}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, borderRadius: 8, color: '#dc2626' }}>
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="md:hidden"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              color: isHero ? 'white' : 'var(--text)',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              {menuOpen ? (
                <path d="M4 4l14 14M18 4L4 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              ) : (
                <>
                  <line x1="3" y1="6" x2="19" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="3" y1="11" x2="19" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="3" y1="16" x2="19" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          background: 'var(--card)', borderTop: '1px solid var(--border)',
          padding: 16, display: 'flex', flexDirection: 'column', gap: 4,
        }} className="md:hidden">
          {[
            { label: 'Accueil', page: 'accueil' as Page },
            { label: 'Catalogue', page: 'catalogue' as Page },
          ].map(link => (
            <button key={link.page} onClick={() => { onNavigate(link.page); setMenuOpen(false) }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '12px 8px',
                textAlign: 'left', fontSize: 15, color: page === link.page ? 'var(--terra)' : 'var(--text)',
                fontWeight: page === link.page ? 600 : 400, borderRadius: 8,
              }}>
              {link.label}
            </button>
          ))}
          {profil && (
            <button onClick={() => { onNavigate(profil.is_admin ? 'admin' : 'client'); setMenuOpen(false) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '12px 8px', textAlign: 'left', fontSize: 15, color: 'var(--text)', borderRadius: 8 }}>
              {profil.is_admin ? 'Administration' : 'Mon espace'}
            </button>
          )}
          {!profil && (
            <button className="btn btn-primary" onClick={() => { onLoginClick(); setMenuOpen(false) }} style={{ marginTop: 8 }}>
              Connexion
            </button>
          )}
        </div>
      )}
    </nav>
  )
}
