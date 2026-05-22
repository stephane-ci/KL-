'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, IS_DEMO, MOCK_NOTIFICATIONS, type Profil, type Notification } from '@/lib/supabase'
import { timeAgo, notifIcon, notifColor, notifBg, sortNotifications } from '@/lib/notifications'

interface NotificationsBellProps {
  profil: Profil
  isHero?: boolean   // ajuste la couleur sur le hero blanc
}

export default function NotificationsBell({ profil, isHero = false }: NotificationsBellProps) {
  const [notifs, setNotifs]   = useState<Notification[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(!IS_DEMO)
  const panelRef              = useRef<HTMLDivElement>(null)

  const unread = notifs.filter(n => !n.lu).length

  // ── Fetch au montage ─────────────────────────────────────────────────────
  useEffect(() => {
    if (IS_DEMO) {
      setNotifs(sortNotifications(MOCK_NOTIFICATIONS))
      setLoading(false)
      return
    }
    fetchNotifs()

    // Realtime : nouvelles notifications en temps réel
    const channel = supabase
      .channel(`notifs-${profil.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profil_id=eq.${profil.id}` },
        (payload) => {
          setNotifs(prev => sortNotifications([payload.new as Notification, ...prev]))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profil.id])

  async function fetchNotifs() {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('profil_id', profil.id)
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) setNotifs(data)
    setLoading(false)
  }

  // ── Fermer en cliquant en dehors ─────────────────────────────────────────
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  // ── Marquer comme lu ─────────────────────────────────────────────────────
  async function markAsRead(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n))
    if (!IS_DEMO) {
      await supabase.from('notifications').update({ lu: true }).eq('id', id)
    }
  }

  async function markAllAsRead() {
    setNotifs(prev => prev.map(n => ({ ...n, lu: true })))
    if (!IS_DEMO) {
      await supabase.from('notifications').update({ lu: true }).eq('profil_id', profil.id)
    }
  }

  // ── Quand le panel s'ouvre : marquer les notifs visibles comme lues ──────
  function handleOpen() {
    setOpen(v => !v)
    if (!open && unread > 0) {
      // Marquer les 5 premières non lues comme lues automatiquement après 2s
      setTimeout(() => {
        notifs.filter(n => !n.lu).slice(0, 5).forEach(n => markAsRead(n.id))
      }, 2000)
    }
  }

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bouton cloche */}
      <button
        onClick={handleOpen}
        title="Notifications"
        style={{
          position: 'relative',
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '6px 8px', borderRadius: 8,
          color: isHero ? 'rgba(255,255,255,0.85)' : 'var(--muted)',
          transition: 'color 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 2a6 6 0 0 0-6 6v2.586l-1.707 1.707A1 1 0 0 0 3 14h14a1 1 0 0 0 .707-1.707L16 10.586V8a6 6 0 0 0-6-6zM8.268 17a2 2 0 0 0 3.464 0H8.268z"
            fill="currentColor"
          />
        </svg>

        {/* Badge non-lu */}
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            minWidth: 16, height: 16, borderRadius: 8,
            background: '#dc2626', color: 'white',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', lineHeight: 1,
            border: '2px solid white',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Panel dropdown */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 10px)',
          width: 360, maxWidth: '95vw',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 14, boxShadow: '0 16px 40px rgba(0,0,0,0.12)', zIndex: 100,
          overflow: 'hidden',
        }}>
          {/* Header panel */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              Notifications {unread > 0 && <span style={{ background: '#dc2626', color: 'white', borderRadius: 100, padding: '1px 7px', fontSize: 11, marginLeft: 6 }}>{unread}</span>}
            </div>
            {unread > 0 && (
              <button
                onClick={markAllAsRead}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--terra)', textDecoration: 'underline' }}
              >
                Tout marquer lu
              </button>
            )}
          </div>

          {/* Liste */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                Chargement...
              </div>
            ) : notifs.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
                <div style={{ fontSize: 14, color: 'var(--muted)' }}>Aucune notification</div>
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  style={{
                    display: 'flex', gap: 12, padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    background: n.lu ? 'transparent' : notifBg(n.type),
                    cursor: n.lu ? 'default' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Icône */}
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: notifBg(n.type),
                    border: `1.5px solid ${notifColor(n.type)}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, color: notifColor(n.type), fontWeight: 700,
                  }}>
                    {notifIcon(n.type)}
                  </div>

                  {/* Texte */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, lineHeight: 1.5,
                      color: n.lu ? 'var(--muted)' : 'var(--text)',
                      fontWeight: n.lu ? 400 : 500,
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                    }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                      {timeAgo(n.created_at)}
                      {!n.lu && (
                        <span style={{
                          marginLeft: 8, display: 'inline-block',
                          width: 6, height: 6, borderRadius: '50%',
                          background: notifColor(n.type),
                          verticalAlign: 'middle',
                        }} />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {notifs.length} notification{notifs.length > 1 ? 's' : ''} · 30 dernières
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
