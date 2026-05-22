export interface Currency {
  code: string
  name: string
  symbol: string
  flag: string
}

export const CURRENCIES: Currency[] = [
  { code: 'XOF', name: 'Franc CFA (BCEAO)', symbol: 'FCFA', flag: '🌍' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'USD', name: 'Dollar américain', symbol: '$', flag: '🇺🇸' },
  { code: 'GBP', name: 'Livre sterling', symbol: '£', flag: '🇬🇧' },
  { code: 'CAD', name: 'Dollar canadien', symbol: 'CA$', flag: '🇨🇦' },
  { code: 'CHF', name: 'Franc suisse', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'MAD', name: 'Dirham marocain', symbol: 'MAD', flag: '🇲🇦' },
  { code: 'DZD', name: 'Dinar algérien', symbol: 'DZD', flag: '🇩🇿' },
  { code: 'TND', name: 'Dinar tunisien', symbol: 'TND', flag: '🇹🇳' },
  { code: 'EGP', name: 'Livre égyptienne', symbol: 'EGP', flag: '🇪🇬' },
  { code: 'NGN', name: 'Naira nigérian', symbol: '₦', flag: '🇳🇬' },
  { code: 'GHS', name: 'Cedi ghanéen', symbol: 'GH₵', flag: '🇬🇭' },
  { code: 'KES', name: 'Shilling kényan', symbol: 'KSh', flag: '🇰🇪' },
  { code: 'ZAR', name: 'Rand sud-africain', symbol: 'R', flag: '🇿🇦' },
  { code: 'XAF', name: 'Franc CFA (BEAC)', symbol: 'FCFA', flag: '🌍' },
  { code: 'CDF', name: 'Franc congolais', symbol: 'FC', flag: '🇨🇩' },
  { code: 'MGA', name: 'Ariary malgache', symbol: 'Ar', flag: '🇲🇬' },
  { code: 'MZN', name: 'Metical mozambicain', symbol: 'MT', flag: '🇲🇿' },
  { code: 'AOA', name: 'Kwanza angolais', symbol: 'Kz', flag: '🇦🇴' },
  { code: 'RWF', name: 'Franc rwandais', symbol: 'RWF', flag: '🇷🇼' },
  { code: 'BIF', name: 'Franc burundais', symbol: 'BIF', flag: '🇧🇮' },
  { code: 'GMD', name: 'Dalasi gambien', symbol: 'D', flag: '🇬🇲' },
  { code: 'SLL', name: 'Leone sierra-léonais', symbol: 'Le', flag: '🇸🇱' },
]

const FALLBACK_RATES: Record<string, number> = {
  XOF: 1, EUR: 0.001524, USD: 0.001666, GBP: 0.001305, CAD: 0.002282,
  CHF: 0.001502, MAD: 0.016633, DZD: 0.224760, TND: 0.005254, EGP: 0.081987,
  NGN: 2.598361, GHS: 0.025543, KES: 0.215517, ZAR: 0.030488, XAF: 1.0,
  CDF: 4.748339, MGA: 7.534247, MZN: 0.105821, AOA: 1.526718, RWF: 2.358491,
  BIF: 4.887219, GMD: 0.118340, SLL: 39.063492,
}

let cachedRates: Record<string, number> = { ...FALLBACK_RATES }
let lastFetch = 0

export async function refreshRates(): Promise<void> {
  const now = Date.now()
  if (now - lastFetch < 3600000) return
  const apiKey = process.env.NEXT_PUBLIC_EXCHANGE_API_KEY
  if (!apiKey) return
  try {
    const res = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/XOF`)
    if (!res.ok) throw new Error('API error')
    const data = await res.json()
    if (data.conversion_rates) {
      cachedRates = data.conversion_rates
      lastFetch = now
    }
  } catch {
    cachedRates = { ...FALLBACK_RATES }
  }
}

export function convertPrice(prixFcfa: number, targetCurrency: string): number {
  const rate = cachedRates[targetCurrency] ?? FALLBACK_RATES[targetCurrency] ?? 1
  return prixFcfa * rate
}

export function formatPrice(amount: number, currency: string): string {
  const cur = CURRENCIES.find(c => c.code === currency)
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount))
  return `${formatted} ${cur?.symbol ?? 'FCFA'}`
}
