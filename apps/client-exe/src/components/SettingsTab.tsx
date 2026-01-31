import { useState, useEffect } from 'react'
import type { AppConfig, SectorConfig, FilterConfig } from '@catchdeal/shared'

export default function SettingsTab() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [paymentPw, setPaymentPw] = useState('')
  const [saved, setSaved] = useState(false)
  const [coupangDone, setCoupangDone] = useState(false)

  useEffect(() => {
    window.catchDeal?.getConfig().then((c) => setConfig((c as AppConfig) || null))
  }, [])

  const updateFilter = (key: keyof FilterConfig, value: number | string[]) => {
    if (!config) return
    setConfig({ ...config, filter: { ...config.filter, [key]: value } })
  }

  const addSector = () => {
    if (!config) return
    setConfig({
      ...config,
      sectors: [...config.sectors, { id: crypto.randomUUID(), name: '', categoryUrl: '', enabled: true }],
    })
  }

  const updateSector = (id: string, field: keyof SectorConfig, value: string | boolean) => {
    if (!config) return
    setConfig({
      ...config,
      sectors: config.sectors.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    })
  }

  const removeSector = (id: string) => {
    if (!config) return
    setConfig({ ...config, sectors: config.sectors.filter((s) => s.id !== id) })
  }

  const save = async () => {
    if (!config) return
    await window.catchDeal?.setConfig(config)
    if (paymentPw.length === 6) await window.catchDeal?.setPaymentPassword(paymentPw)
    setPaymentPw('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const openCoupangLogin = async () => {
    await window.catchDeal?.openCoupangLogin()
    setCoupangDone(true)
  }

  if (!config) return <div>로딩 중...</div>

  const keywordsStr = Array.isArray(config.filter.excludeKeywords) ? config.filter.excludeKeywords.join(', ') : ''

  return (
    <div className="settings-tab">
      <section>
        <h2>쿠팡 세션</h2>
        <p className="muted">자동 구매를 위해 쿠팡에 로그인해 주세요.</p>
        <button onClick={openCoupangLogin}>쿠팡 로그인 (팝업)</button>
        {coupangDone && <span className="ok">완료</span>}
      </section>

      <section>
        <h2>섹터 설정 (감시 카테고리)</h2>
        <p className="muted">감시할 카테고리 URL을 추가하세요. 예: 노트북, TV, 카메라</p>
        {config.sectors.map((s) => (
          <div key={s.id} className="row">
            <input placeholder="이름" value={s.name} onChange={(e) => updateSector(s.id, 'name', e.target.value)} />
            <input placeholder="카테고리 URL (https://www.coupang.com/...)" value={s.categoryUrl} onChange={(e) => updateSector(s.id, 'categoryUrl', e.target.value)} style={{ flex: 1 }} />
            <label><input type="checkbox" checked={s.enabled} onChange={(e) => updateSector(s.id, 'enabled', e.target.checked)} /> 사용</label>
            <button className="danger" onClick={() => removeSector(s.id)}>삭제</button>
          </div>
        ))}
        <button onClick={addSector}>+ 카테고리 추가</button>
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

      <section>
        <h2>결제 설정</h2>
        <p className="muted">간편결제 비밀번호 6자리 (로컬 암호화 저장)</p>
        <input type="password" maxLength={6} placeholder="6자리" value={paymentPw} onChange={(e) => setPaymentPw(e.target.value.replace(/\D/g, '').slice(0, 6))} />
      </section>

      <div className="actions">
        <button className="primary" onClick={save}>{saved ? '저장됨' : '설정 저장'}</button>
      </div>

      <style>{`
        .settings-tab { max-width: 720px; }
        .settings-tab section { margin-bottom: 2rem; }
        .settings-tab h2 { margin: 0 0 0.5rem; font-size: 1rem; }
        .settings-tab .muted { color: var(--text-muted); font-size: 0.875rem; margin-bottom: 0.75rem; }
        .settings-tab .row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
        .settings-tab .row input[type="text"], .settings-tab .row input[type="number"], .settings-tab .row input[type="password"] { padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px; background: #0f1419; color: #e7e9ea; }
        .settings-tab .row label { display: flex; align-items: center; gap: 0.5rem; white-space: nowrap; }
        .settings-tab .ok { color: var(--success); margin-left: 0.5rem; }
        .settings-tab button { padding: 0.5rem 1rem; background: var(--accent); color: #fff; border: none; border-radius: 6px; }
        .settings-tab button.danger { background: var(--danger); }
        .settings-tab button.primary { padding: 0.75rem 1.5rem; font-weight: 600; }
        .settings-tab .actions { margin-top: 1.5rem; }
      `}</style>
    </div>
  )
}
