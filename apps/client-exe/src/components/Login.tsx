import { useState } from 'react'

interface LoginProps {
  onSuccess: () => void
}

export default function Login({ onSuccess }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await window.catchDeal.login(email, password)
      if (res.ok) onSuccess()
      else setError(res.error || '로그인 실패')
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그인 오류')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>CatchDeal</h1>
        <p className="sub">캐치딜 클라이언트 로그인</p>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
      <style>{`
        .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg-card); }
        .login-card { width: 360px; padding: 2rem; background: #16181c; border: 1px solid var(--border); border-radius: 12px; }
        .login-card h1 { margin: 0 0 0.25rem; font-size: 1.5rem; }
        .login-card .sub { color: var(--text-muted); font-size: 0.875rem; margin-bottom: 1.5rem; }
        .login-card input { width: 100%; padding: 0.75rem 1rem; margin-bottom: 0.75rem; border: 1px solid var(--border); border-radius: 8px; background: #0f1419; color: #e7e9ea; }
        .login-card .error { color: var(--danger); font-size: 0.875rem; margin-bottom: 0.5rem; }
        .login-card button { width: 100%; padding: 0.75rem; background: var(--accent); color: #fff; border: none; border-radius: 8px; font-weight: 600; }
        .login-card button:hover:not(:disabled) { background: var(--accent-hover); }
        .login-card button:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  )
}
