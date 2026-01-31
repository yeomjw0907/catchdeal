import { useState, useEffect } from 'react'
import type { AppConfig, CafeSourceConfig, FilterConfig } from '@catchdeal/shared'

export default function SettingsTab() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [paymentPw, setPaymentPw] = useState('')
  const [saved, setSaved] = useState(false)
  const [cookiePaste, setCookiePaste] = useState('')
  const [cookieMsg, setCookieMsg] = useState('')
  const [savedCookieSummary, setSavedCookieSummary] = useState<{ count: number; names: string[] } | null>(null)
  const [paymentPwSavedMessage, setPaymentPwSavedMessage] = useState(false)
  const [cdpMsg, setCdpMsg] = useState('')

  const loadCookieSummary = () => {
    window.catchDeal?.getCoupangCookiesSummary().then((s) => setSavedCookieSummary(s ?? null))
  }

  useEffect(() => {
    window.catchDeal?.getConfig().then((c) => setConfig((c as AppConfig) || null))
    loadCookieSummary()
  }, [])

  const updateFilter = (key: keyof FilterConfig, value: number | string[]) => {
    if (!config) return
    setConfig({ ...config, filter: { ...config.filter, [key]: value } })
  }

  const cafeSources = config?.cafeSources ?? []
  const addCafeSource = () => {
    if (!config) return
    setConfig({
      ...config,
      cafeSources: [...cafeSources, { id: crypto.randomUUID(), name: '', cafeListUrl: '', keyword: '무지성 구매급', enabled: true }],
    })
  }
  const updateCafeSource = (id: string, field: keyof CafeSourceConfig, value: string | boolean) => {
    if (!config) return
    setConfig({
      ...config,
      cafeSources: cafeSources.map((s: CafeSourceConfig) => (s.id === id ? { ...s, [field]: value } : s)),
    })
  }
  const removeCafeSource = (id: string) => {
    if (!config) return
    setConfig({ ...config, cafeSources: cafeSources.filter((s: CafeSourceConfig) => s.id !== id) })
  }

  const save = async () => {
    if (!config) return
    const hadNewPw = paymentPw.length === 6
    await window.catchDeal?.setConfig(config)
    if (hadNewPw) await window.catchDeal?.setPaymentPassword(paymentPw)
    setPaymentPw('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    if (hadNewPw) {
      setPaymentPwSavedMessage(true)
      setTimeout(() => setPaymentPwSavedMessage(false), 3500)
    }
    window.catchDeal?.getConfig().then((c) => setConfig((c as AppConfig) || null))
  }

  const applyCookiePaste = async () => {
    setCookieMsg('')
    const res = await window.catchDeal?.setCoupangCookies(cookiePaste.trim())
    if (res?.ok) {
      setCookieMsg('쿠키가 적용되었습니다.')
      setCookiePaste('')
      loadCookieSummary()
    } else {
      setCookieMsg(res?.error || '적용 실패')
    }
  }

  if (!config) return <div>로딩 중...</div>

  const keywordsStr = Array.isArray(config.filter.excludeKeywords) ? config.filter.excludeKeywords.join(', ') : ''

  return (
    <div className="settings-tab">
      <section>
        <h2>쿠팡 세션</h2>
        <p className="muted">자동 구매를 위해 쿠팡 세션 쿠키가 필요합니다. Chrome에서 로그인 후 아래 &quot;쿠키 수동 가져오기&quot; 절차로 쿠키를 적용해 주세요.</p>
        <div className="cookie-saved">
          <strong>저장된 쿠키</strong>
          {savedCookieSummary && savedCookieSummary.count > 0 ? (
            <>
              <span className="cookie-count">{savedCookieSummary.count}개</span>
              <p className="muted small">아래 이름만 표시됩니다. 값은 보안상 저장만 되고 표시하지 않습니다.</p>
              <ul className="cookie-names">
                {savedCookieSummary.names.map((name) => (
                  <li key={name}><code>{name}</code></li>
                ))}
              </ul>
            </>
          ) : (
            <p className="muted">저장된 쿠키가 없습니다. 아래에서 Chrome 등으로 내보낸 JSON을 붙여넣어 적용하세요.</p>
          )}
        </div>
        <div className="cookie-howto">
          <strong>Access Denied가 나오면 (쿠키 수동 가져오기)</strong>
          <ol>
            <li>Chrome에서 <a href="https://www.coupang.com" target="_blank" rel="noopener noreferrer">coupang.com</a> 접속 후 로그인</li>
            <li>Chrome 웹스토어에서 <strong>EditThisCookie</strong> 또는 <strong>Cookie-Editor</strong> 확장 설치</li>
            <li>쿠팡이 열린 탭에서 확장 프로그램 아이콘 클릭 → <strong>Export</strong>(내보내기) → <strong>Copy</strong> 또는 JSON 복사</li>
            <li>아래 텍스트 칸에 복사한 JSON <strong>전체</strong>를 붙여넣기 (Ctrl+V)</li>
            <li><strong>[쿠키 적용]</strong> 버튼 클릭 → 저장된 쿠키 목록이 위에 갱신됩니다.</li>
          </ol>
          <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>EditThisCookie/Cookie-Editor가 내보낸 배열 형식 <code>[{'{'} name, value, ... {'}'}, ...]</code> 을 그대로 붙여넣으면 됩니다.</p>
        </div>
        <label className="cookie-paste-label">새 쿠키 JSON (붙여넣으면 기존 저장 쿠키를 덮어씁니다)</label>
        <textarea
          placeholder='[{"name":"...","value":"...","domain":".coupang.com"}, ...]'
          value={cookiePaste}
          onChange={(e) => setCookiePaste(e.target.value)}
          rows={3}
          className="cookie-paste"
        />
        <div className="cookie-actions">
          <button type="button" onClick={applyCookiePaste}>쿠키 적용</button>
          {cookieMsg && <span className={cookieMsg.includes('적용') ? 'ok' : 'error'}>{cookieMsg}</span>}
        </div>
      </section>

      <section className="cdp-section">
        <h2>스캔 (Access Denied 방지)</h2>
        <p className="muted">쿠팡이 봇을 막아서 스캔이 안 되면, <strong>Chrome을 디버깅 모드로 띄운 뒤</strong> 그 Chrome에 앱이 붙어서 스캔합니다. Start 전에 아래 버튼을 누르세요.</p>
        <button type="button" onClick={async () => {
          setCdpMsg('')
          const res = await window.catchDeal?.launchChromeWithDebug()
          if (res?.ok) setCdpMsg('Chrome이 디버깅 모드로 실행되었습니다. 이제 대시보드에서 Start를 누르세요.')
          else setCdpMsg(res?.error || '실행 실패')
        }}>
          Chrome 디버깅 모드로 실행
        </button>
        {cdpMsg && <span className={cdpMsg.includes('실행되었습니다') ? 'ok' : 'error'} style={{ marginLeft: '0.5rem' }}>{cdpMsg}</span>}
        <p className="muted small">Chrome 창이 새로 뜹니다. 그 창에서 쿠팡 로그인해도 되고, 앱에 저장된 쿠키를 쓸 수도 있습니다.</p>
      </section>

      <section>
        <h2>카페 소스 (감시할 카페)</h2>
        <p className="muted">실시간으로 카페 목록을 돌며, 제목에 <strong>키워드</strong>가 들어간 글만 골라 글 안에서 링크를 추출합니다. 목록 URL과 키워드를 추가하세요.</p>
        {cafeSources.map((s: CafeSourceConfig) => (
          <div key={s.id} className="row cafe-row">
            <input placeholder="이름 (예: 핫딜못)" value={s.name} onChange={(e) => updateCafeSource(s.id, 'name', e.target.value)} style={{ width: '8rem' }} />
            <input placeholder="카페 목록 URL (https://cafe.naver.com/...)" value={s.cafeListUrl} onChange={(e) => updateCafeSource(s.id, 'cafeListUrl', e.target.value)} style={{ flex: 1 }} />
            <input placeholder="키워드 (예: 무지성 구매급)" value={s.keyword} onChange={(e) => updateCafeSource(s.id, 'keyword', e.target.value)} style={{ width: '10rem' }} />
            <label><input type="checkbox" checked={s.enabled} onChange={(e) => updateCafeSource(s.id, 'enabled', e.target.checked)} /> 사용</label>
            <button className="danger" onClick={() => removeCafeSource(s.id)}>삭제</button>
          </div>
        ))}
        <button onClick={addCafeSource}>+ 카페 소스 추가</button>
      </section>

      <section>
        <h2>필터링 조건</h2>
        <div className="row">
          <label>최소 가격 (원)</label>
          <input type="number" value={config.filter.minPrice} onChange={(e) => updateFilter('minPrice', Number(e.target.value) || 0)} />
        </div>
        <div className="row">
          <label>목표 할인율 (%)</label>
          <input type="number" min={0} max={100} value={config.filter.targetDiscountRate} onChange={(e) => updateFilter('targetDiscountRate', Number(e.target.value) || 0)} />
        </div>
        <div className="row">
          <label>제외 키워드 (쉼표 구분)</label>
          <input value={keywordsStr} onChange={(e) => updateFilter('excludeKeywords', e.target.value.split(',').map((k) => k.trim()).filter(Boolean))} placeholder="케이스, 반품, 리퍼" style={{ flex: 1 }} />
        </div>
      </section>

      <section className="payment-section">
        <h2>결제 설정</h2>
        <p className="muted">간편결제 비밀번호 6자리 (로컬 암호화 저장)</p>
        <div className="payment-status">
          {config.paymentPasswordEncrypted ? (
            <span className="payment-set">비밀번호 설정됨</span>
          ) : (
            <span className="payment-unset">설정되지 않음</span>
          )}
        </div>
        <p className="muted small">
          {config.paymentPasswordEncrypted
            ? '변경하려면 새 6자리 입력 후 아래 [설정 저장]을 누르세요.'
            : '6자리를 입력한 뒤 아래 [설정 저장]을 누르세요.'}
        </p>
        <input
          type="password"
          maxLength={6}
          placeholder={config.paymentPasswordEncrypted ? '새 비밀번호 6자리 (변경 시에만 입력)' : '6자리 입력'}
          value={paymentPw}
          onChange={(e) => setPaymentPw(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="payment-input"
        />
        {paymentPwSavedMessage && (
          <p className="payment-saved-msg">간편결제 비밀번호가 저장되었습니다.</p>
        )}
      </section>

      <div className="actions">
        <button className="primary" onClick={save}>{saved ? '저장됨' : '설정 저장'}</button>
      </div>

      <style>{`
        .settings-tab { max-width: 720px; }
        .settings-tab section { margin-bottom: 2rem; }
        .settings-tab h2 { margin: 0 0 0.5rem; font-size: 1rem; }
        .settings-tab .muted { color: var(--text-muted); font-size: 0.875rem; margin-bottom: 0.75rem; }
        .settings-tab .cookie-saved { margin-top: 0.75rem; padding: 0.75rem 1rem; background: rgba(0,0,0,0.25); border-radius: 8px; border: 1px solid var(--border); }
        .settings-tab .cookie-saved strong { display: block; margin-bottom: 0.25rem; color: #e7e9ea; }
        .settings-tab .cookie-saved .cookie-count { color: var(--accent); font-weight: 600; margin-left: 0.25rem; }
        .settings-tab .cookie-saved .small { font-size: 0.75rem; margin: 0.25rem 0 0.5rem; color: var(--text-muted); }
        .settings-tab .cookie-saved .cookie-names { margin: 0.5rem 0 0; padding-left: 1.25rem; max-height: 8rem; overflow-y: auto; font-size: 0.8125rem; }
        .settings-tab .cookie-saved .cookie-names li { margin-bottom: 0.2rem; }
        .settings-tab .cookie-saved .cookie-names code { background: rgba(255,255,255,0.06); padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.75rem; }
        .settings-tab .cookie-howto { margin-top: 0.75rem; padding: 0.75rem; background: rgba(0,0,0,0.2); border-radius: 8px; font-size: 0.8125rem; color: var(--text-muted); }
        .settings-tab .cookie-howto strong { color: #e7e9ea; }
        .settings-tab .cookie-howto ol { margin: 0.5rem 0 0 1.25rem; padding: 0; line-height: 1.6; }
        .settings-tab .cookie-howto a { color: var(--accent); }
        .settings-tab .cookie-paste-label { display: block; margin-top: 0.75rem; font-size: 0.875rem; color: var(--text-muted); }
        .settings-tab .cookie-paste { width: 100%; margin-top: 0.5rem; padding: 0.5rem; font-family: monospace; font-size: 0.75rem; border: 1px solid var(--border); border-radius: 6px; background: #0f1419; color: #e7e9ea; resize: vertical; }
        .settings-tab .cookie-actions { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; }
        .settings-tab .error { color: var(--danger); margin-left: 0.5rem; }
        .settings-tab .row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
        .settings-tab .cafe-row { flex-wrap: wrap; }
        .settings-tab .row input[type="text"], .settings-tab .row input[type="number"], .settings-tab .row input[type="password"] { padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px; background: #0f1419; color: #e7e9ea; }
        .settings-tab .row label { display: flex; align-items: center; gap: 0.5rem; white-space: nowrap; }
        .settings-tab .ok { color: var(--success); margin-left: 0.5rem; }
        .settings-tab .payment-status { margin-bottom: 0.25rem; }
        .settings-tab .payment-set { color: var(--success); font-weight: 600; font-size: 0.875rem; }
        .settings-tab .payment-unset { color: var(--text-muted); font-size: 0.875rem; }
        .settings-tab .payment-section .small { font-size: 0.8125rem; margin: 0.25rem 0 0.5rem; }
        .settings-tab .payment-input { margin-top: 0.25rem; padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px; background: #0f1419; color: #e7e9ea; width: 8rem; }
        .settings-tab .payment-saved-msg { color: var(--success); font-size: 0.875rem; margin-top: 0.5rem; font-weight: 500; }
        .settings-tab button { padding: 0.5rem 1rem; background: var(--accent); color: #fff; border: none; border-radius: 6px; }
        .settings-tab button.danger { background: var(--danger); }
        .settings-tab button.primary { padding: 0.75rem 1.5rem; font-weight: 600; }
        .settings-tab .actions { margin-top: 1.5rem; }
      `}</style>
    </div>
  )
}
