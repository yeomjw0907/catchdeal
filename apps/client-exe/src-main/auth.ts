import { ipcMain } from 'electron'
import { getSupabase, getSubscriptionUser, setSession, getSession, resetSupabaseClient } from './supabase'
import { getHWID } from './hwid'
import Store from 'electron-store'

const store = new Store<{ coupangCookies?: string; session?: { access_token: string; refresh_token: string } }>({ name: 'catch-deal-auth' })

const AUTH_CHANNELS = ['auth:login', 'auth:logout', 'auth:getSession', 'auth:getHwid', 'auth:getCoupangCookiesSummary', 'auth:setCoupangCookies'] as const

export function registerAuthHandlers() {
  AUTH_CHANNELS.forEach((ch) => ipcMain.removeHandler(ch))
  ipcMain.handle('auth:login', async (_e, email: string, password: string) => {
    const supabase = getSupabase()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { ok: false, error: error.message }
    if (!data.session) return { ok: false, error: 'No session' }

    setSession(data.session)
    store.set('session', { access_token: data.session.access_token, refresh_token: data.session.refresh_token })

    const sub = await getSubscriptionUser()
    if (!sub) return { ok: false, error: '구독 정보를 찾을 수 없습니다.' }
    if (!sub.is_active) return { ok: false, error: '비활성화된 계정입니다.' }

    const expireAt = sub.expire_at ? new Date(sub.expire_at) : null
    if (expireAt && expireAt <= new Date()) return { ok: false, error: '구독이 만료되었습니다.' }

    const hwid = getHWID()
    if (sub.hwid && sub.hwid !== hwid) return { ok: false, error: '등록된 기기가 아닙니다. (기기 인증 실패)' }

    return { ok: true, user: data.user, session: data.session, subscription: sub }
  })

  ipcMain.handle('auth:logout', async () => {
    const supabase = getSupabase()
    await supabase.auth.signOut()
    setSession(null)
    store.delete('session')
    store.delete('coupangCookies')
    resetSupabaseClient()
    return { ok: true }
  })

  ipcMain.handle('auth:getSession', async () => {
    let session = getSession()
    if (session) return { session, user: session.user }
    const stored = store.get('session')
    if (stored?.access_token && stored?.refresh_token) {
      const supabase = getSupabase()
      const { data: { session: s }, error } = await supabase.auth.setSession(stored)
      if (!error && s) {
        setSession(s)
        session = s
      }
    }
    if (!session) {
      const supabase = getSupabase()
      const { data: { session: s } } = await supabase.auth.getSession()
      if (s) setSession(s)
      session = s ?? null
    }
    return session ? { session, user: session.user } : null
  })

  ipcMain.handle('auth:getHwid', () => getHWID())

  /** 저장된 쿠팡 쿠키 목록 (이름만, UI 표시용) */
  ipcMain.handle('auth:getCoupangCookiesSummary', () => {
    const cookies = getCoupangCookies()
    return { count: cookies.length, names: cookies.map((c) => c.name) }
  })

  /** 쿠키 수동 적용 (Chrome 등에서 로그인 후 내보낸 쿠키 JSON 붙여넣기용) */
  ipcMain.handle('auth:setCoupangCookies', (_e, json: string) => {
    try {
      const arr = JSON.parse(json) as Array<{ name: string; value: string; domain?: string }>
      if (!Array.isArray(arr) || arr.some((x) => !x?.name || x?.value == null)) return { ok: false, error: '형식 오류' }
      const serialized = JSON.stringify(arr.map((c) => ({ name: c.name, value: c.value, domain: c.domain || '.coupang.com' })))
      store.set('coupangCookies', serialized)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'JSON 파싱 실패' }
    }
  })
}

export function getCoupangCookies(): Array<{ name: string; value: string; domain?: string }> {
  const raw = store.get('coupangCookies')
  if (!raw) return []
  try {
    return JSON.parse(raw) as Array<{ name: string; value: string; domain?: string }>
  } catch {
    return []
  }
}
