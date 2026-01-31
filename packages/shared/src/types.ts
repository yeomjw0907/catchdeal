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

/** 감시할 카페 소스: 목록 URL + 키워드(제목 포함 시 해당 글 진입 후 내부 링크 추출) */
export interface CafeSourceConfig {
  id: string
  name: string
  cafeListUrl: string
  keyword: string
  enabled: boolean
}

export interface FilterConfig {
  minPrice: number
  targetDiscountRate: number
  excludeKeywords: string[]
}

export interface AppConfig {
  sectors: SectorConfig[]
  /** 감시할 카페 목록 (목록 URL + 키워드). 실시간으로 돌며 키워드 맞는 글 진입 후 링크 추출 */
  cafeSources: CafeSourceConfig[]
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

/** 카페에서 추출한 링크 + 해부(상품 페이지 파싱) 결과 */
export type ExtractedLinkStatus = 'pending' | 'success' | 'failed'

export interface ExtractedLinkItem {
  url: string
  postTitle?: string
  extractedAt: number
  status: ExtractedLinkStatus
  /** 해부 성공 시 */
  productName?: string
  price?: number
  originalPrice?: number
  discountRate?: number
  /** 해부 실패 시 */
  retryCount?: number
  failedAt?: number
  errorMessage?: string
}

export type EngineStatus = 'idle' | 'scanning' | 'purchasing' | 'error' | 'stopped'

export interface DailyStats {
  scanCount: number
  purchaseCount: number
  date: string
}
