/** CatchDeal 공통 타입 및 DB 스키마 타입 */

export interface SubscriptionUser {
  id: string
  email: string
  hwid: string | null
  expire_at: string
  is_active: boolean
}

export interface TradeLog {
  id: string
  user_id: string
  product_name: string
  buy_price: number
  sell_price: number
  coupang_link: string
  order_id?: string
  image_url?: string
  status: 'PURCHASED' | 'LISTED' | 'SOLD'
  created_at: string
}

export interface TradeLogInsert {
  user_id: string
  product_name: string
  buy_price: number
  sell_price: number
  coupang_link: string
  order_id?: string
  image_url?: string
  status: 'PURCHASED'
}

export interface SectorConfig {
  id: string
  name: string
  categoryUrl: string
  enabled: boolean
}

export interface FilterConfig {
  minPrice: number
  targetDiscountRate: number
  excludeKeywords: string[]
}

export interface AppConfig {
  sectors: SectorConfig[]
  filter: FilterConfig
  paymentPasswordEncrypted: string | null
}

export interface ScannedProduct {
  title: string
  price: number
  originalPrice?: number
  discountRate: number
  link: string
  imageUrl?: string
}

export type EngineStatus = 'idle' | 'scanning' | 'purchasing' | 'error' | 'stopped'

export interface DailyStats {
  scanCount: number
  purchaseCount: number
  date: string
}
