/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Empêche le clickjacking
  { key: 'X-Frame-Options', value: 'DENY' },
  // Empêche la détection MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Referrer limité à la même origine
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Force HTTPS (2 ans, inclut les sous-domaines)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Désactive les APIs sensibles inutilisées
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(self), usb=()',
  },
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Scripts : self + Next.js inline + Supabase realtime
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Styles : self + inline (CSS-in-JS)
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Polices Google Fonts
      "font-src 'self' https://fonts.gstatic.com",
      // Images : self + picsum + Supabase storage + qrserver + placeholder
      "img-src 'self' data: blob: https://picsum.photos https://*.supabase.co https://api.qrserver.com https://via.placeholder.com",
      // Connexions : Supabase API + Realtime + Resend + CinetPay
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com https://api-checkout.cinetpay.com",
      // Frames : CinetPay checkout uniquement
      "frame-src 'self' https://checkout.cinetpay.com",
      // Médias (vidéos terrain Supabase Storage)
      "media-src 'self' https://*.supabase.co blob:",
      // Workers (Supabase realtime)
      "worker-src 'self' blob:",
    ].join('; '),
  },
]

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'api.qrserver.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
    ],
  },

  // Headers de sécurité sur toutes les routes
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },

  // Pas de X-Powered-By dans les headers
  poweredByHeader: false,

  // Compression activée
  compress: true,
}

export default nextConfig
