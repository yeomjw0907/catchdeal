import { chromium } from 'playwright'
import type { Browser, BrowserContext, Page } from 'playwright'
import { insertTradeLog } from './supabase'
import { getConfig, getPaymentPasswordDecrypted } from './config'
import type { AppConfig, ScannedProduct } from '@catchdeal/shared'

const COUPANG_BASE = 'https://www.coupang.com'

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
  /** CDP WebSocket URL (사용자가 띄운 Chrome 디버깅 모드에 연결) */
  cdpWsEndpoint?: string
}

export async function runScanner(options: RunScannerOptions): Promise<void> {
  const { config, cookies, userId, onLog, onStatus, onScan, onPurchase, signal, cdpWsEndpoint } = options
  const { filter, sectors } = config
  let browser: Browser | null = null

  try {
    let context: BrowserContext

    if (cdpWsEndpoint) {
      // 1순위: 사용자가 띄운 Chrome(디버깅 모드)에 연결 → Access Denied 우회
      browser = await chromium.connectOverCDP(cdpWsEndpoint)
      onLog('Chrome(디버깅 모드)에 연결했습니다. 스캔을 시작합니다.')
      const contexts = browser.contexts()
      context = contexts.length > 0 ? contexts[0] : await browser.newContext()
      await context.addCookies(
        cookies.map((c) => ({ name: c.name, value: c.value, domain: c.domain || '.coupang.com', path: '/' }))
      )
      // CDP 연결 시에는 리소스 차단 생략 (사용자 Chrome에 영향 최소화)
    } else {
      const launchOptions: Parameters<typeof chromium.launch>[0] = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      }
      try {
        browser = await chromium.launch({ ...launchOptions, channel: 'chrome' })
        onLog('Chrome 브라우저로 스캔합니다.')
      } catch {
        browser = await chromium.launch(launchOptions)
        onLog('Chrome 미설치 → Chromium 사용. Access Denied 시 환경설정에서 Chrome 디버깅 모드로 실행하세요.')
      }
      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true,
        locale: 'ko-KR',
      })
      await context.addCookies(
        cookies.map((c) => ({ name: c.name, value: c.value, domain: c.domain || '.coupang.com', path: '/' }))
      )
      await context.route('**/*.{png,jpg,jpeg,gif,webp,ico,woff,woff2}', (r) => r.abort())
      await context.route('**/font*', (r) => r.abort())
    }

    const urls = (sectors || []).filter((s) => s.enabled).map((s) => s.categoryUrl).filter(Boolean)
    if (!urls.length) {
      onLog('감시할 카테고리 URL이 없습니다.')
      return
    }

    const CYCLE_DELAY_MS = 10_000 // 사이클 간 대기(ms)

    while (!signal?.aborted) {
      for (const listUrl of urls) {
        if (signal?.aborted) break
        onStatus('scanning')
        onLog(`스캔 중: ${listUrl}`)
        const page = await context.newPage()
        try {
          await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
          // 검색 결과가 JS로 렌더될 때까지 상품 링크 등장 대기
          await page.waitForSelector('a[href*="/np/products/"]', { timeout: 12000 }).catch(() => {})
          await new Promise((r) => setTimeout(r, 1500))
          onScan()
          const items = await parseListPage(page, filter)
          if (items.length === 0) {
            const isAccessDenied = await page.evaluate(() => document.body?.innerText?.toLowerCase().includes('access denied') ?? false).catch(() => false)
            if (isAccessDenied) {
              onLog('→ Access Denied: 쿠팡이 봇으로 차단했습니다. PC에 Chrome 설치 후 재시도하세요.')
            } else {
              onLog('이 페이지에서 상품 목록을 찾지 못했습니다. (쿠팡 페이지 구조 변경 가능성)')
            }
          } else {
            onLog(`상품 ${items.length}건 로드됨. 확인 중...`)
          }
          for (const item of items) {
            if (signal?.aborted) break
            const shortTitle = item.title.length > 40 ? item.title.slice(0, 40) + '…' : item.title
            onLog(`확인: ${shortTitle} | ${item.price.toLocaleString()}원 (${item.discountRate}% 할인)`)
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
      if (signal?.aborted) break
      onLog('한 사이클 완료. 다음 사이클까지 대기 중...')
      for (let waited = 0; waited < CYCLE_DELAY_MS && !signal?.aborted; waited += 1000) {
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
    onLog('스캐너 중지됨.')
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    onLog(`스캐너 오류: ${err.message}`)
    onStatus('error')
  } finally {
    await browser?.close().catch(() => {})
  }
}

/** 페이지 내 임베드 JSON에서 상품 목록 추출 시도 */
async function parseListFromEmbeddedData(page: Page): Promise<ScannedProduct[]> {
  const raw = await page.evaluate(() => {
    const out: { link: string; title: string; price: number; originalPrice?: number }[] = []
    const scripts = document.querySelectorAll('script[type="application/json"], script#__NEXT_DATA__')
    const html = document.documentElement.outerHTML
    for (const script of Array.from(scripts)) {
      try {
        const text = script.textContent || ''
        if (text.length < 500) continue
        const data = JSON.parse(text) as unknown
        const walk = (obj: unknown, depth: number): void => {
          if (depth > 8) return
          if (!obj || typeof obj !== 'object') return
          if (Array.isArray(obj)) {
            obj.forEach((item) => walk(item, depth + 1))
            return
          }
          const o = obj as Record<string, unknown>
          const link = (o.link ?? o.url ?? o.productUrl ?? o.itemUrl) as string | undefined
          const href = (o.href ?? o.path) as string | undefined
          const productId = (o.productId ?? o.itemId ?? o.id) as string | undefined
          const title = (o.name ?? o.title ?? o.productName) as string | undefined
          const price = typeof o.price === 'number' ? o.price : typeof o.salePrice === 'number' ? o.salePrice : undefined
          const originalPrice = typeof o.originalPrice === 'number' ? o.originalPrice : typeof o.listPrice === 'number' ? o.listPrice : undefined
          if (title && typeof title === 'string' && price != null && Number(price) > 0) {
            let url = link || (href && String(href).includes('/np/products/') ? 'https://www.coupang.com' + (String(href).startsWith('/') ? '' : '/') + href : '')
            if (!url && productId && typeof productId === 'string') url = `https://www.coupang.com/np/products/${productId}`
            if (url && url.includes('coupang.com')) out.push({ link: url, title, price: Number(price), originalPrice: originalPrice != null ? Number(originalPrice) : undefined })
          }
          Object.values(o).forEach((v) => walk(v, depth + 1))
        }
        walk(data, 0)
      } catch {
        // skip
      }
    }
    const match = html.match(/window\.__[A-Z_]+__\s*=\s*(\{[\s\S]*?\});?\s*</)
    if (match) {
      try {
        const data = JSON.parse(match[1]) as unknown
        const walk = (obj: unknown, depth: number): void => {
          if (depth > 8) return
          if (!obj || typeof obj !== 'object') return
          if (Array.isArray(obj)) { obj.forEach((item) => walk(item, depth + 1)); return }
          const o = obj as Record<string, unknown>
          const title = (o.name ?? o.title ?? o.productName) as string | undefined
          const price = typeof o.price === 'number' ? o.price : typeof o.salePrice === 'number' ? o.salePrice : undefined
          const productId = (o.productId ?? o.itemId ?? o.id) as string | undefined
          if (title && typeof title === 'string' && price != null && Number(price) > 0 && productId) {
            out.push({ link: `https://www.coupang.com/np/products/${productId}`, title, price: Number(price) })
          }
          Object.values(o).forEach((v) => walk(v, depth + 1))
        }
        walk(data, 0)
      } catch {
        // skip
      }
    }
    return out
  }).catch(() => [] as { link: string; title: string; price: number; originalPrice?: number }[])

  const seen = new Set<string>()
  return raw
    .filter((p) => p.link && p.title && p.price > 0 && !seen.has(p.link) && (seen.add(p.link), true))
    .slice(0, 50)
    .map((p) => ({
      title: p.title,
      price: p.price,
      originalPrice: p.originalPrice,
      discountRate: p.originalPrice && p.originalPrice > 0 ? Math.round((1 - p.price / p.originalPrice) * 100) : 0,
      link: p.link,
    }))
}

/** DOM에서 상품 링크 기준으로 카드 텍스트에서 가격/제목 추출 (쿠팡 검색 결과 그리드 대응) */
async function parseListFromDOM(page: Page): Promise<ScannedProduct[]> {
  const rows = await page.evaluate((base: string) => {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/np/products/"]'))
    const seen = new Set<string>()
    const result: { link: string; title: string; price: number; originalPrice: number }[] = []
    const priceRe = /(\d{1,3}(?:,\d{3})*|\d+)\s*원?/g

    const hasPriceRe = /\d{1,3}(?:,\d{3})*\s*원?|\d+\s*원/
    /** 링크를 포함하면서 가격 패턴이 있고, 상품 링크가 1~2개인 가장 작은 부모 = 카드 */
    function findProductCard(link: HTMLAnchorElement): Element | null {
      let el: Element | null = link.parentElement
      while (el && el !== document.body) {
        const text = el.textContent || ''
        const productLinks = el.querySelectorAll('a[href*="/np/products/"]').length
        if (productLinks <= 2 && hasPriceRe.test(text)) return el
        el = el.parentElement
      }
      return link.closest('li') || link.closest('[class*="product"]') || link.closest('[class*="search"]') || link.parentElement
    }

    /** 카드 내에서 상품명처럼 보이는 텍스트 (이미지 대체 텍스트 또는 첫 번째 긴 텍스트) */
    function findTitleInCard(card: Element, link: HTMLAnchorElement): string {
      const linkText = (link.textContent || '').trim().replace(/\s+/g, ' ')
      if (linkText.length > 3) return linkText
      const linkTitle = link.getAttribute('title') || link.getAttribute('aria-label') || ''
      if (linkTitle.trim().length > 3) return linkTitle.trim()
      const candidates = card.querySelectorAll('dd, [class*="name"], [class*="title"], [class*="desc"], span, div')
      for (const el of Array.from(candidates)) {
        const t = (el.textContent || '').trim().replace(/\s+/g, ' ')
        if (t.length >= 5 && t.length <= 200 && !/^\d+[,.]?\d*\s*원?$/.test(t)) return t
      }
      const full = (card.textContent || '').trim().replace(/\s+/g, ' ')
      const firstLine = full.slice(0, 150).trim()
      if (firstLine.length >= 3) return firstLine
      const productId = (link.getAttribute('href') || '').match(/\/np\/products\/(\d+)/)?.[1]
      return productId ? `상품 ${productId}` : '상품'
    }

    for (const a of links) {
      const href = (a.getAttribute('href') || '').split('?')[0].trim()
      const fullLink = href.startsWith('http') ? href : base + (href.startsWith('/') ? href : '/' + href)
      if (seen.has(fullLink)) continue
      seen.add(fullLink)

      const card = findProductCard(a)
      const root = card || a
      const text = root.textContent || ''
      const numbers: number[] = []
      let m: RegExpExecArray | null
      priceRe.lastIndex = 0
      while ((m = priceRe.exec(text)) !== null) numbers.push(parseInt(m[1].replace(/,/g, ''), 10))
      const validPrices = numbers.filter((n) => n >= 100 && n <= 1e8)
      if (validPrices.length === 0) continue
      const price = validPrices[0]
      const originalPrice = validPrices.length >= 2 ? validPrices[1] : price
      const finalPrice = price <= originalPrice ? price : originalPrice
      const finalOriginal = price <= originalPrice ? originalPrice : price
      const title = findTitleInCard(root, a).slice(0, 300)
      result.push({ link: fullLink, title: title || '상품', price: finalPrice, originalPrice: finalOriginal })
    }
    return result.slice(0, 50)
  }, COUPANG_BASE)

  return rows.map((r) => ({
    title: r.title,
    price: r.price,
    originalPrice: r.originalPrice !== r.price ? r.originalPrice : undefined,
    discountRate: r.originalPrice > 0 ? Math.round((1 - r.price / r.originalPrice) * 100) : 0,
    link: r.link,
  }))
}

async function parseListPage(page: Page, _filter: AppConfig['filter']): Promise<ScannedProduct[]> {
  let items: ScannedProduct[] = []
  try {
    items = await parseListFromEmbeddedData(page)
    if (items.length === 0) items = await parseListFromDOM(page)
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
