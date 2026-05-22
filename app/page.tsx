'use client'

import { useState, useEffect } from 'react'
import { supabase, type Page, type Terrain, type Profil } from '@/lib/supabase'
import { refreshRates } from '@/lib/currency'
import Nav from '@/components/Nav'
import Landing from '@/components/Landing'
import Catalogue from '@/components/Catalogue'
import TerrainDetail from '@/components/TerrainDetail'
import EspaceClient from '@/components/EspaceClient'
import Admin from '@/components/Admin'
import LoginModal, { Toast, WAChat, CGU } from '@/components/LoginModal'
import VerifyPage from '@/components/VerifyPage'

export default function Home() {
  const [page, setPage] = useState<Page>('accueil')
  const [selectedTerrain, setSelectedTerrain] = useState<Terrain | null>(null)
  const [profil, setProfil] = useState<Profil | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [verifyHash, setVerifyHash] = useState<string | null>(null)

  useEffect(() => {
    refreshRates()

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)

      // Retour depuis lien reset password
      if (params.get('reset') === 'true') {
        setShowLogin(true)
      }

      // Retour depuis CinetPay après paiement
      if (params.get('payment') === 'success') {
        window.history.replaceState({}, '', '/')
        setTimeout(() => {
          showToast('✓ Paiement confirmé ! Votre espace a été mis à jour.', 'success')
        }, 800)
      }

      // Portail de vérification document (QR scan)
      const vh = params.get('verify')
      if (vh) {
        window.history.replaceState({}, '', '/')
        setVerifyHash(vh)
        setPage('verify')
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfil(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // L'utilisateur a cliqué sur le lien de reset — montrer la modal
        setShowLogin(true)
      } else if (session?.user) {
        loadProfil(session.user.id)
      } else {
        setProfil(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfil(userId: string) {
    const { data } = await supabase.from('profils').select('*').eq('id', userId).single()
    if (data) setProfil(data)
  }

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  function navigateTo(p: Page, terrain?: Terrain) {
    if (terrain) setSelectedTerrain(terrain)
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <Nav
        page={page}
        profil={profil}
        onNavigate={navigateTo}
        onLoginClick={() => setShowLogin(true)}
      />

      <main>
        {page === 'accueil' && (
          <Landing onNavigate={navigateTo} />
        )}
        {page === 'catalogue' && (
          <Catalogue
            onTerrainClick={(t) => navigateTo('detail', t)}
            profil={profil}
            onLoginRequired={() => setShowLogin(true)}
            showToast={showToast}
          />
        )}
        {page === 'detail' && selectedTerrain && (
          <TerrainDetail
            terrain={selectedTerrain}
            profil={profil}
            onBack={() => navigateTo('catalogue')}
            onLoginRequired={() => setShowLogin(true)}
            showToast={showToast}
          />
        )}
        {page === 'client' && profil && !profil.is_admin && (
          <EspaceClient profil={profil} showToast={showToast} />
        )}
        {page === 'admin' && profil?.is_admin && (
          <Admin profil={profil} showToast={showToast} />
        )}
        {page === 'cgu' && (
          <CGU onBack={() => navigateTo('accueil')} />
        )}
        {page === 'verify' && verifyHash && (
          <VerifyPage hash={verifyHash} onBack={() => navigateTo('accueil')} />
        )}
      </main>

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={(p) => {
            setProfil(p)
            setShowLogin(false)
            showToast(`Bienvenue, ${p.nom_complet.split(' ')[0]} !`, 'success')
            navigateTo(p.is_admin ? 'admin' : 'client')
          }}
          showToast={showToast}
        />
      )}

      <WAChat />

      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  )
}
