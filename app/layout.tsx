import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'KLô — Investissez en Afrique depuis chez vous',
  description: 'KLô est la plateforme de référence pour la diaspora africaine souhaitant acquérir des terrains en Afrique. Titre foncier garanti, paiement échelonné.',
  keywords: 'terrain Afrique, diaspora africaine, investissement immobilier, Sénégal, Côte d\'Ivoire, Togo, Bénin',
  openGraph: {
    title: 'KLô — Investissez en Afrique depuis chez vous',
    description: 'Trouvez votre terrain en Afrique. Titre foncier garanti, paiement sur mesure.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${cormorant.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
