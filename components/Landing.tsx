'use client'

import { type Page, type Terrain, MOCK_TERRAINS } from '@/lib/supabase'
import { formatPrice } from '@/lib/currency'

interface LandingProps {
  onNavigate: (p: Page, terrain?: Terrain) => void
}

const FEATURES = [
  {
    icon: '📜',
    title: 'Titre foncier garanti',
    desc: 'Chaque terrain est vérifié et sécurisé juridiquement. Votre propriété est protégée dès l\'achat.',
  },
  {
    icon: '💳',
    title: 'Paiement échelonné',
    desc: 'Payez en mensualités adaptées à votre budget, depuis n\'importe où dans le monde.',
  },
  {
    icon: '🌍',
    title: 'Dédié à la diaspora',
    desc: 'Interface multidevise, support en français, accompagnement à chaque étape de votre investissement.',
  },
]

const STEPS = [
  { num: '01', title: 'Choisissez votre terrain', desc: 'Explorez notre catalogue de terrains vérifiés en Afrique.' },
  { num: '02', title: 'Réservez & versez l\'acompte', desc: 'Un acompte de 20% sécurise votre terrain immédiatement.' },
  { num: '03', title: 'Payez en mensualités', desc: 'Remboursez le reste sur la durée fixée, sans stress.' },
]

const TESTIMONIALS = [
  {
    name: 'Aminata D.', pays: '🇫🇷 Paris', text: 'Grâce à KLô, j\'ai pu acquérir un terrain à Dakar en 24 mensualités depuis la France. Le processus était simple et transparent.',
    initiale: 'A',
  },
  {
    name: 'Kofi M.', pays: '🇩🇪 Berlin', text: 'Enfin une plateforme sérieuse pour la diaspora ! Mon terrain à Abidjan est sécurisé avec titre foncier, et je paye tranquillement depuis l\'Allemagne.',
    initiale: 'K',
  },
  {
    name: 'Fatou B.', pays: '🇨🇦 Montréal', text: 'L\'espace client est très pratique pour suivre mes paiements. Je recommande KLô à tous mes amis de la diaspora africaine.',
    initiale: 'F',
  },
]

export default function Landing({ onNavigate }: LandingProps) {
  const featuredTerrains = MOCK_TERRAINS.filter(t => t.statut === 'dispo').slice(0, 3)

  return (
    <div>
      {/* ── Hero ── */}
      <section style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0d2b1f 0%, #1a4a35 40%, #1D9E75 100%)',
        display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', right: '-10%', top: '10%',
          width: 500, height: 500, borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.08)',
        }} />
        <div style={{
          position: 'absolute', right: '5%', top: '25%',
          width: 300, height: 300, borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.05)',
        }} />
        <div style={{
          position: 'absolute', left: '-5%', bottom: '10%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'rgba(29, 158, 117, 0.15)',
        }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '120px 24px 80px', position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: 680 }}>
            <div className="section-label" style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}>
              Plateforme immobilière de la diaspora
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: 'clamp(42px, 7vw, 76px)',
              fontWeight: 600, color: 'white', lineHeight: 1.1, marginBottom: 24,
              letterSpacing: '-0.02em',
            }}>
              Investissez en Afrique.<br />
              <span style={{ color: 'rgba(255,255,255,0.55)', fontStyle: 'italic' }}>Depuis chez vous.</span>
            </h1>
            <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', marginBottom: 40, lineHeight: 1.7, maxWidth: 540 }}>
              KLô connecte la diaspora africaine à des terrains sécurisés en Afrique.
              Titre foncier garanti, paiement échelonné, accompagnement complet.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={() => onNavigate('catalogue')}
                style={{ fontSize: 15, padding: '14px 28px' }}
              >
                Explorer le catalogue →
              </button>
              <button
                className="btn"
                onClick={() => document.getElementById('comment-ca-marche')?.scrollIntoView({ behavior: 'smooth' })}
                style={{
                  fontSize: 15, padding: '14px 28px',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white', backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              >
                Comment ça marche
              </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 40, marginTop: 64, flexWrap: 'wrap' }}>
              {[
                { val: '50+', label: 'Terrains disponibles' },
                { val: '5', label: 'Pays couverts' },
                { val: '200+', label: 'Clients satisfaits' },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 600, color: 'white', lineHeight: 1 }}>
                    {s.val}
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          color: 'rgba(255,255,255,0.4)', fontSize: 12,
        }}>
          <span>Découvrir</span>
          <div style={{
            width: 1, height: 40,
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)',
          }} />
        </div>
      </section>

      {/* ── Pourquoi KLô ── */}
      <section style={{ padding: '96px 24px', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className="section-label" style={{ marginBottom: 12 }}>Pourquoi KLô</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              Votre patrimoine en Afrique,<br />
              <span style={{ color: 'var(--terra)' }}>sécurisé et accessible</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {FEATURES.map(f => (
              <div key={f.title} className="card" style={{ padding: 32 }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, marginBottom: 12 }}>{f.title}</h3>
                <p style={{ color: 'var(--muted)', lineHeight: 1.7, fontSize: 15 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Terrains en vedette ── */}
      <section style={{ padding: '96px 24px', background: '#F2EDE4' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 48, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div className="section-label" style={{ marginBottom: 12 }}>Sélection du moment</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 600, letterSpacing: '-0.02em' }}>
                Terrains en vedette
              </h2>
            </div>
            <button className="btn btn-outline" onClick={() => onNavigate('catalogue')}>
              Voir tout le catalogue
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 24 }}>
            {featuredTerrains.map(terrain => (
              <div key={terrain.id} className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(0,0,0,0.1)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '' }}
                onClick={() => onNavigate('detail', terrain)}
              >
                <div style={{ height: 200, overflow: 'hidden', position: 'relative' }}>
                  <img
                    src={terrain.images[0]}
                    alt={terrain.nom}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{ position: 'absolute', top: 12, left: 12 }}>
                    <span className="badge badge-dispo">{terrain.superficie.toLocaleString('fr-FR')} m²</span>
                  </div>
                  {terrain.titre_foncier && (
                    <div style={{ position: 'absolute', top: 12, right: 12 }}>
                      <span className="badge" style={{ background: 'rgba(0,0,0,0.6)', color: 'white', backdropFilter: 'blur(4px)' }}>
                        📜 TF
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ padding: 20 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{terrain.pays} · {terrain.localisation}</div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, marginBottom: 12 }}>{terrain.nom}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>À partir de</div>
                      <div style={{ fontWeight: 600, color: 'var(--terra)', fontSize: 17 }}>
                        {formatPrice(terrain.prix_fcfa * 0.2 / terrain.duree_mois, 'XOF')}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}>/mois</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                      {formatPrice(terrain.prix_fcfa, 'XOF')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comment ça marche ── */}
      <section id="comment-ca-marche" style={{ padding: '96px 24px', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className="section-label" style={{ marginBottom: 12 }}>Simple & transparent</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 600, letterSpacing: '-0.02em' }}>
              Comment ça marche
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            {STEPS.map((step, i) => (
              <div key={step.num} style={{ display: 'flex', gap: 20 }}>
                <div>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: i === 0 ? 'var(--terra)' : 'var(--terra-light)',
                    color: i === 0 ? 'white' : 'var(--terra)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600,
                    flexShrink: 0,
                  }}>
                    {step.num}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ width: 1, height: 'calc(100% - 48px)', background: 'var(--border)', margin: '8px auto 0' }} />
                  )}
                </div>
                <div style={{ paddingBottom: 32 }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{step.title}</h3>
                  <p style={{ color: 'var(--muted)', lineHeight: 1.7, fontSize: 15 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Témoignages ── */}
      <section style={{ padding: '96px 24px', background: '#F2EDE4' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className="section-label" style={{ marginBottom: 12 }}>Ils nous font confiance</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 600, letterSpacing: '-0.02em' }}>
              La diaspora parle de KLô
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="card" style={{ padding: 28 }}>
                <div style={{ fontSize: 32, marginBottom: 16, color: 'var(--terra)' }}>"</div>
                <p style={{ color: 'var(--text)', lineHeight: 1.7, fontSize: 15, marginBottom: 24 }}>{t.text}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'var(--terra)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 600,
                  }}>
                    {t.initiale}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t.pays}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section style={{
        padding: '96px 24px',
        background: 'linear-gradient(135deg, #0d2b1f 0%, #1D9E75 100%)',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 600, color: 'white', marginBottom: 20, letterSpacing: '-0.02em',
          }}>
            Prêt à investir dans votre avenir ?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 17, marginBottom: 40, lineHeight: 1.7 }}>
            Rejoignez plus de 200 membres de la diaspora qui ont déjà sécurisé leur terrain en Afrique avec KLô.
          </p>
          <button
            className="btn"
            onClick={() => onNavigate('catalogue')}
            style={{
              background: 'white', color: 'var(--terra)',
              fontSize: 15, padding: '16px 36px', fontWeight: 600,
            }}
          >
            Découvrir les terrains →
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: '#0d2b1f', padding: '40px 24px', color: 'rgba(255,255,255,0.5)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: 'white' }}>
            KL<span style={{ color: 'var(--terra)' }}>ô</span>
          </div>
          <div style={{ fontSize: 13 }}>
            © 2024 KLô ·
            <button onClick={() => onNavigate('cgu')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 13, marginLeft: 8 }}>
              Conditions générales
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
