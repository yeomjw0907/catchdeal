import { chromium } from 'playwright'
import type { Browser, BrowserContext, Page } from 'playwright'
import { insertTradeLog } from './supabase'
import { getConfig, getPaymentPasswordDecrypted } from './config'
import type { AppConfig, ScannedProduct } from '@catchdeal/shared'
import { COUPANG_BASE } from '@catchdeal/shared'

interface RunScannerOptions {
  config: AppConfig
  cookies: Array<{ name: string; value: string; domain?: string }>
  accessToken: string
  userId: string
  onLog: (line: string) => void
  onStatus: (s: 'idle' | 'scanning' | 'purchasing' | 'error' | 'stopped') => void
  onScan: () => void
  onPurchase: () => void
  signal?: AbortSignal
}

export async function runScanner(options: RunScannerOptions): Promise<void> {
  const { config, cookies, userId, onLog, onStatus, onScan, onPurchase, signal } = options
  const { filter, sectors } = config
  let browser: Browser | null = null

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    })
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
    })
    await context.addCookies(
      cookies.map((c) => ({ name: c.name, value: c.value, domain: c.domain || '.coupang.com', path: '/' }))
    )
    await context.route('**/*.{png,jpg,jpeg,gif,webp,ico,woff,woff2}', (r) => r.abort())
    await context.route('**/font*', (r) => r.abort())

    const urls = (sectors || []).filter((s) => s.enabled).map((s) => s.categoryUrl).filter(Boolean)
    if (!urls.length) {
      onLog('감시할 카테고리 URL이 없습니다.')
      return
    }

    for (const listUrl of urls) {
      if (signal?.aborted) break
      onStatus('scanning')
      onLog(`스캔 중: ${listUrl}`)
      const page = await context.newPage()
      try {
        await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
        onScan()
        const items = await parseListPage(page, filter)
        for (const item of items) {
          if (signal?.aborted) break
          const matched = matchFilter(item, filter)
          if (!matched) continue
          onLog(`발견! ${item.title} | ${item.price}원 (${item.discountRate}%)`)
          onStatus('purchasing')
          const purchased = await tryPurchase(context, page, item, config, onLog)
          if (purchased) {
            onPurchase()
            await insertTradeLog({
              user_id: userId,
              product_name: item.title,
              buy_price: item.price,
              sell_price: Math.round(item.price * 1.1),
              coupang_link: item.link,
              image_url: item.imageUrl,
              status: 'PURCHASED',
            })
            onLog(`구매 완료 → trade_logs 전송됨`)
          }
        }
      } finally {
        await page.close().catch(() => {})
      }
    }
    onLog('한 사이클 완료.')
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    onLog(`스캐너 오류: ${err.message}`)
    onStatus('error')
  } finally {
    await browser?.close().catch(() => {})
  }
}

async function parseListPage(page: Page, filter: AppConfig['filter']): Promise<ScannedProduct[]> {
  const items: ScannedProduct[] = []
  try {
    await page.waitForSelector('ul.search-product-list, [class*="product-list"], .product-item', { timeout: 8000 }).catch(() => {})
    const rows = await page.$$('li.search-product, [class*="search-product"], .product-item, a.search-product-link')
    for (const row of rows.slice(0, 50)) {
      try {
        const titleEl = await row.$('div.name, .product-name, [class*="title"]')
        const priceEl = await row.$('strong.price-value, .price, [class*="price"]')
        const linkEl = await row.$('a[href*="coupang.com"]') || row
        const title = titleEl ? (await titleEl.textContent())?.trim() || '' : ''
        const priceText = priceEl ? (await priceEl.textContent())?.replace(/[^0-9]/g, '') || '' : ''
        const price = parseInt(priceText, 10) || 0
        const href = await linkEl.getAttribute('href').catch(() => '') || ''
        const link = href.startsWith('http') ? href : `${COUPANG_BASE}${href}`
        if (!title || !price) continue
        const originalMatch = await row.$('em.base-price, .original-price, [class*="base-price"]')
        const originalText = originalMatch ? (await originalMatch.textContent())?.replace(/[^0-9]/g, '') || '' : ''
        const originalPrice = parseInt(originalText, 10) || 0
        const discountRate = originalPrice > 0 ? Math.round((1 - price / originalPrice) * 100) : 0
        items.push({ title, price, originalPrice: originalPrice || undefined, discountRate, link })
      } catch {
        // skip row
      }
    }
  } catch {
    // fallback
  }
  return items
}

function matchFilter(item: ScannedProduct, filter: AppConfig['filter']): boolean {
  if (item.price < filter.minPrice) return false
  if (item.discountRate < filter.targetDiscountRate) return false
  const lower = item.title.toLowerCase()
  for (const kw of filter.excludeKeywords || []) {
    if (kw && lower.includes(kw.toLowerCase())) return false
  }
  return true
}

async function tryPurchase(
  context: BrowserContext,
  listPage: Page,
  item: ScannedProduct,
  config: AppConfig,
  onLog: (line: string) => void
): Promise<boolean> {
  const paymentPassword = getPaymentPasswordDecrypted()
  if (!paymentPassword) {
    onLog('결제 비밀번호가 설정되지 않았습니다. 환경설정에서 6자리 입력 후 재시도.')
    return false
  }
  let page: Page | null = null
  try {
    page = await context.newPage()
    await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 12000 })
    await page.click('a.btn-buy, button.buy, [class*="buy"]', { timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(800)
    await page.click('button.payment, [class*="payment"]', { timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(500)
    await page.fill('input[type="password"], input[name*="password"]', paymentPassword, { timeout: 3000 }).catch(() => {})
    await page.click('button[type="submit"], .confirm-payment, [class*="confirm"]', { timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(2000)
    const orderId = await page.$('span.order-id, [class*="order-number"]').then((el) => el?.textContent()).catch(() => null)
    if (orderId) onLog(`주문번호: ${orderId.trim()}`)
    return true
  } catch (e) {
    onLog(`구매 시도 실패: ${e instanceof Error ? e.message : String(e)}. 재시도...`)
    return false
  } finally {
    await page?.close().catch(() => {})
  }
}
