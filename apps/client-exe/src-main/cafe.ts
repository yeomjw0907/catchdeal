import { ipcMain } from 'electron'
import { chromium } from 'playwright'
import type { BrowserContext, Page } from 'playwright'
import type { AppConfig, CafeSourceConfig } from '@catchdeal/shared'

export interface CafeLinkItem {
  title: string
  url: string
}

export interface FetchCafeLinksResult {
  ok: boolean
  links: CafeLinkItem[]
  error?: string
}

export interface RunCafeScannerOptions {
  config: AppConfig
  onLog: (line: string) => void
  onStatus: (s: 'idle' | 'scanning' | 'purchasing' | 'error' | 'stopped') => void
  onScan: () => void
  onLinkExtracted?: (url: string, postTitle?: string) => void
  /** 해부(상품 페이지 파싱) 성공 시 */
  onLinkEnriched?: (url: string, postTitle: string | undefined, productInfo: { productName: string; price: number; originalPrice?: number; discountRate?: number }) => void
  /** 해부 실패 (최대 5회 재시도 후) */
  onLinkFailed?: (url: string, postTitle: string | undefined, errorMessage: string) => void
  signal?: AbortSignal
  cdpWsEndpoint?: string
}

const MAX_DISSECT_RETRIES = 5

const CAFE_LIST_TIMEOUT = 20000
const CAFE_POST_TIMEOUT = 15000
const CYCLE_DELAY_MS = 15_000
const CAFE_BASE = 'https://cafe.naver.com'

/**
 * 네이버 카페 게시판 목록 페이지에서 특정 키워드가 포함된 글 링크만 추출합니다.
 * 목록은 iframe#cafe_main 안에 있을 수 있어 iframe 전환 후 파싱합니다.
 */
export async function fetchCafeLinks(cafeListUrl: string, keyword: string): Promise<FetchCafeLinksResult> {
  if (!cafeListUrl.trim() || !keyword.trim()) {
    return { ok: false, links: [], error: '카페 목록 URL과 키워드를 입력해 주세요.' }
  }
  let browser
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    })
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'ko-KR',
    })
    const page = await context.newPage()
    await page.goto(cafeListUrl, { waitUntil: 'domcontentloaded', timeout: CAFE_LIST_TIMEOUT })

    // 네이버 카페는 목록이 iframe#cafe_main 안에 있는 경우가 있음 (구 카페)
    let frame = page.frame({ name: 'cafe_main' })
    if (!frame) {
      const frameEl = await page.$('iframe#cafe_main, iframe[name="cafe_main"]')
      if (frameEl) frame = await frameEl.contentFrame()
    }
    const target = frame ?? page

    await target.waitForLoadState('domcontentloaded').catch(() => {})
    await new Promise((r) => setTimeout(r, 2000))

    const keywordLower = keyword.trim().toLowerCase()
    const links = await target.evaluate((kw: string) => {
      const result: { title: string; url: string }[] = []
      const base = 'https://cafe.naver.com'
      // 목록형: 테이블/게시판 링크 + 키워드 포함인 모든 a 태그
      const allLinks = document.querySelectorAll<HTMLAnchorElement>('a[href]')
      const seen = new Set<string>()
      for (const a of Array.from(allLinks)) {
        const href = (a.getAttribute('href') || '').trim()
        if (!href || href === '#' || href.startsWith('javascript:')) continue
        const title = (a.textContent || '').trim().replace(/\s+/g, ' ')
        if (!title || title.length < 2) continue
        if (!title.toLowerCase().includes(kw)) continue
        const url = href.startsWith('http') ? href : href.startsWith('/') ? base + href : base + '/' + href
        if (!url.includes('cafe.naver.com')) continue
        const norm = url.split('?')[0]
        if (seen.has(norm)) continue
        seen.add(norm)
        result.push({ title, url })
      }
      return result
    }, keywordLower)

    await browser.close().catch(() => {})
    return { ok: true, links }
  } catch (e) {
    await browser?.close().catch(() => {})
    const err = e instanceof Error ? e : new Error(String(e))
    return { ok: false, links: [], error: err.message }
  }
}

/** 목록 페이지(또는 iframe)에서 키워드 포함 글 링크만 추출 */
async function getPostLinksFromListPage(page: Page, listUrl: string, keyword: string): Promise<CafeLinkItem[]> {
  await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: CAFE_LIST_TIMEOUT })
  let frame = page.frame({ name: 'cafe_main' })
  if (!frame) {
    const frameEl = await page.$('iframe#cafe_main, iframe[name="cafe_main"]')
    if (frameEl) frame = await frameEl.contentFrame()
  }
  const target = frame ?? page
  await target.waitForLoadState('domcontentloaded').catch(() => {})
  await new Promise((r) => setTimeout(r, 2000))
  const kw = keyword.trim().toLowerCase()
  const links = await target.evaluate(
    (arg: { base: string; k: string }) => {
      const { base, k } = arg
      const result: { title: string; url: string }[] = []
      const allLinks = document.querySelectorAll<HTMLAnchorElement>('a[href]')
      const seen = new Set<string>()
      for (const a of Array.from(allLinks)) {
        const href = (a.getAttribute('href') || '').trim()
        if (!href || href === '#' || href.startsWith('javascript:')) continue
        const title = (a.textContent || '').trim().replace(/\s+/g, ' ')
        if (!title || title.length < 2 || !title.toLowerCase().includes(k)) continue
        const url = href.startsWith('http') ? href : href.startsWith('/') ? base + href : base + '/' + href
        if (!url.includes('cafe.naver.com')) continue
        const norm = url.split('?')[0]
        if (seen.has(norm)) continue
        seen.add(norm)
        result.push({ title, url })
      }
      return result
    },
    { base: CAFE_BASE, k: kw }
  )
  return links
}

/** 글 본문 페이지에서 링크 추출 (우선 쿠팡, 그 외 외부 링크) */
async function extractLinksFromPostPage(page: Page, postUrl: string): Promise<string[]> {
  await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: CAFE_POST_TIMEOUT })
  await new Promise((r) => setTimeout(r, 1500))
  let frame = page.frame({ name: 'cafe_main' })
  if (!frame) {
    const frameEl = await page.$('iframe#cafe_main, iframe[name="cafe_main"]')
    if (frameEl) frame = await frameEl.contentFrame()
  }
  const target = frame ?? page
  const urls = await target.evaluate(() => {
    const out: string[] = []
    const seen = new Set<string>()
    const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href*="coupang.com"], a[href*="np/products"], a[href^="http"]')
    for (const a of Array.from(anchors)) {
      const href = (a.getAttribute('href') || '').trim()
      if (!href || href.startsWith('javascript:')) continue
      if (seen.has(href)) continue
      seen.add(href)
      out.push(href)
    }
    return out
  })
  return urls
}

/** 쿠팡 상품 상세 페이지에서 상품명·가격 해부 (실패 시 null) */
async function parseCoupangProductPage(page: Page): Promise<{ productName: string; price: number; originalPrice?: number; discountRate?: number } | null> {
  await new Promise((r) => setTimeout(r, 1500))
  const result = await page.evaluate(() => {
    const title =
      (document.querySelector('h2.prod-buy-header__title, .prod-buy-header__title, [class*="ProductTitle"], h1') as HTMLElement)?.innerText?.trim() ||
      (document.querySelector('meta[property="og:title"]') as HTMLMetaElement)?.content?.trim() ||
      ''
    const priceEl = document.querySelector('.total-price strong, .prod-price__total .total-price, [class*="totalPrice"], [class*="salePrice"]')
    const priceText = priceEl?.textContent?.replace(/[^0-9]/g, '') || ''
    const price = parseInt(priceText, 10) || 0
    const basePriceEl = document.querySelector('.origin-price, .prod-price__origin, [class*="originPrice"]')
    const baseText = basePriceEl?.textContent?.replace(/[^0-9]/g, '') || ''
    const originalPrice = parseInt(baseText, 10) || 0
    const discountRate = originalPrice > 0 && price > 0 ? Math.round((1 - price / originalPrice) * 100) : 0
    if (!title || title.length < 2 || price < 100) return null
    return { productName: title.slice(0, 300), price, originalPrice: originalPrice || undefined, discountRate }
  }).catch(() => null)
  return result
}

/**
 * 카페 소스를 실시간으로 돌며: 목록 → 키워드 필터 → 글 진입 → 링크 추출 → 실시간 해부(상품 페이지 파싱).
 * 해부 실패 시 후순위로 미루고 최대 5회 재시도 후 실패 처리.
 */
export async function runCafeScanner(options: RunCafeScannerOptions): Promise<void> {
  const { config, onLog, onStatus, onScan, onLinkExtracted, onLinkEnriched, onLinkFailed, signal, cdpWsEndpoint } = options
  onStatus('scanning')
  const sources = (config.cafeSources || []).filter((s: CafeSourceConfig) => s.enabled && s.cafeListUrl?.trim() && s.keyword?.trim())
  if (!sources.length) {
    onLog('감시할 카페 소스가 없습니다. 환경설정에서 카페 목록 URL과 키워드를 추가해 주세요.')
    onStatus('idle')
    return
  }
  if (!cdpWsEndpoint) {
    onLog('Chrome 디버깅 모드에 연결할 수 없습니다. 환경설정에서 Chrome 디버깅 모드로 실행 후 Start를 눌러 주세요.')
    onStatus('idle')
    return
  }
  let context: BrowserContext
  try {
    const browser = await chromium.connectOverCDP(cdpWsEndpoint)
    onLog('Chrome(디버깅 모드)에 연결했습니다. 카페 스캔을 시작합니다.')
    const contexts = browser.contexts()
    context = contexts.length > 0 ? contexts[0] : await browser.newContext()
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    onLog(`연결 실패: ${err.message}`)
    onStatus('error')
    return
  }

  while (!signal?.aborted) {
    for (const source of sources) {
      if (signal?.aborted) break
      onStatus('scanning')
      onLog(`카페 확인 중: ${source.name || source.cafeListUrl} (키워드: ${source.keyword})`)
      const listPage = await context.newPage()
      try {
        const postLinks = await getPostLinksFromListPage(listPage, source.cafeListUrl, source.keyword)
        onScan()
        if (postLinks.length === 0) {
          onLog('  → 키워드에 맞는 글이 없습니다.')
        } else {
          onLog(`  → 키워드 맞는 글 ${postLinks.length}개. 글 내부 링크 추출 중...`)
          for (const post of postLinks) {
            if (signal?.aborted) break
            const shortTitle = post.title.length > 50 ? post.title.slice(0, 50) + '…' : post.title
            onLog(`  글: ${shortTitle}`)
            const postPage = await context.newPage()
            try {
              const links = await extractLinksFromPostPage(postPage, post.url)
              const coupang = links.filter((u) => u.includes('coupang.com') || u.includes('/np/products'))
              if (coupang.length > 0) {
                onLog(`    링크 ${links.length}개 (쿠팡 ${coupang.length}개). 실시간 해부 진행...`)
                type QueueItem = { link: string; postTitle: string; retryCount: number }
                const queue: QueueItem[] = coupang.map((link) => ({ link, postTitle: post.title, retryCount: 0 }))
                while (queue.length > 0 && !signal?.aborted) {
                  const item = queue.shift()!
                  onLinkExtracted?.(item.link, item.postTitle)
                  onLog('    링크 접속을 진행합니다.')
                  let linkPage: Page | null = null
                  try {
                    linkPage = await context.newPage()
                    await linkPage.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 15000 })
                    onLog('    접속 완료.')
                    const productInfo = await parseCoupangProductPage(linkPage)
                    if (productInfo) {
                      onLinkEnriched?.(item.link, item.postTitle, productInfo)
                      onLog(`    해부 성공: ${productInfo.productName.slice(0, 30)}… ${productInfo.price.toLocaleString()}원`)
                    } else {
                      item.retryCount++
                      if (item.retryCount < MAX_DISSECT_RETRIES) {
                        queue.push(item)
                        onLog(`    해부 실패 (${item.retryCount}/${MAX_DISSECT_RETRIES}), 후순위로 미룸.`)
                      } else {
                        onLinkFailed?.(item.link, item.postTitle, '상품명·가격 파싱 실패 (5회 재시도 후)')
                      }
                    }
                  } catch (e) {
                    const errMsg = e instanceof Error ? e.message : String(e)
                    onLog(`    접속/해부 오류: ${errMsg}`)
                    item.retryCount++
                    if (item.retryCount < MAX_DISSECT_RETRIES) {
                      queue.push(item)
                      onLog(`    후순위로 미룸 (${item.retryCount}/${MAX_DISSECT_RETRIES}).`)
                    } else {
                      onLinkFailed?.(item.link, item.postTitle, errMsg)
                    }
                  } finally {
                    await linkPage?.close().catch(() => {})
                  }
                }
              } else if (links.length > 0) {
                onLog(`    링크 ${links.length}개: ${links.slice(0, 3).join(', ')}${links.length > 3 ? '…' : ''}`)
              } else {
                onLog('    (내부 링크 없음)')
              }
            } finally {
              await postPage.close().catch(() => {})
            }
          }
        }
      } finally {
        await listPage.close().catch(() => {})
      }
    }
    if (signal?.aborted) break
    onLog('한 사이클 완료. 다음 사이클까지 대기 중...')
    for (let waited = 0; waited < CYCLE_DELAY_MS && !signal?.aborted; waited += 1000) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  onLog('카페 스캐너 중지됨.')
  onStatus('idle')
}

const CAFE_CHANNELS = ['cafe:fetchLinks'] as const

export function registerCafeHandlers() {
  CAFE_CHANNELS.forEach((ch) => ipcMain.removeHandler(ch))
  ipcMain.handle('cafe:fetchLinks', (_e, cafeListUrl: string, keyword: string) =>
    fetchCafeLinks(cafeListUrl ?? '', keyword ?? '')
  )
}
