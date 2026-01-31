import { ipcMain, BrowserWindow } from 'electron'
import { getSupabase, getSubscriptionUser, setSession, getSession, resetSupabaseClient } from './supabase'
import { getHWID } from './hwid'
import Store from 'electron-store'

const store = new Store<{ coupangCookies?: string; session?: { access_token: string; refresh_token: string } }>({ name: 'catch-deal-auth' })

export function registerAuthHandlers() {
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

  ipcMain.handle('auth:openCoupangLogin', async () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    const authWin = new BrowserWindow({
      width: 900,
      height: 700,
      parent: win ?? undefined,
      modal: !!win,
      webPreferences: { nodeIntegration: false },
    })
    authWin.loadURL('https://login.coupang.com/login/login.pang')
    return new Promise<void>((resolve) => {
      authWin.webContents.session.webRequest.onCompleted(
        { urls: ['https://*.coupang.com/*'] },
        async () => {
          const cookies = await authWin.webContents.session.cookies.get({ domain: '.coupang.com' })
          const serialized = JSON.stringify(cookies.map((c) => ({ name: c.name, value: c.value, domain: c.domain })))
          store.set('coupangCookies', serialized)
          authWin.close()
          resolve()
        }
      )
      authWin.on('closed', () => resolve())
    })
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
