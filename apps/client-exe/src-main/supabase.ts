import { createClient, SupabaseClient, Session } from '@supabase/supabase-js'
import type { SubscriptionUser, TradeLog, TradeLogInsert } from '@catchdeal/shared'

let client: SupabaseClient | null = null
let currentSession: Session | null = null

function getEnv() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  return { url, key }
}

export function getSupabase(): SupabaseClient {
  if (!client) {
    const { url, key } = getEnv()
    if (!url || !key) throw new Error('Supabase URL/Key not configured')
    client = createClient(url, key, {
      auth: { persistSession: true, storage: undefined },
    })
  }
  return client
}

export function setSession(session: Session | { access_token: string; refresh_token: string } | null) {
  currentSession = session && 'user' in session ? session : null
  if (client) {
    if (session && 'access_token' in session) client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })
    else if (!session) client.auth.signOut()
  }
}

export function getSession(): Session | null {
  return currentSession
}

export async function getSubscriptionUser(): Promise<SubscriptionUser | null> {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return null
  const { data, error } = await supabase
    .from('subscription_users')
    .select('*')
    .eq('id', user.id)
    .single()
  if (error || !data) return null
  return data as SubscriptionUser
}

export async function insertTradeLog(row: TradeLogInsert): Promise<TradeLog | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('trade_logs').insert(row).select().single()
  if (error) return null
  return data as TradeLog
}

export async function fetchTradeLogs(limit = 100): Promise<TradeLog[]> {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return []
  const { data, error } = await supabase
    .from('trade_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return (data || []) as TradeLog[]
}

export function resetSupabaseClient() {
  currentSession = null
  client = null
}
