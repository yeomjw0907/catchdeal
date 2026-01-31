import { useState } from 'react'

const DEFAULT_CAFE_URL = 'https://cafe.naver.com/f-e/cafes/24651941/menus/13?viewType=L'
const DEFAULT_KEYWORD = '무지성 구매급'

export default function CafeTab() {
  const [cafeListUrl, setCafeListUrl] = useState(DEFAULT_CAFE_URL)
  const [keyword, setKeyword] = useState(DEFAULT_KEYWORD)
  const [links, setLinks] = useState<{ title: string; url: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFetch = async () => {
    setError(null)
    setLinks([])
    setLoading(true)
    try {
      const res = await window.catchDeal?.fetchCafeLinks(cafeListUrl.trim(), keyword.trim())
      if (res?.ok) {
        setLinks(res.links ?? [])
        if ((res.links?.length ?? 0) === 0) setError('키워드에 맞는 링크가 없습니다.')
      } else {
        setError(res?.error ?? '조회 실패')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const openLink = (url: string) => {
    if (url.startsWith('http')) window.open(url, '_blank')
  }

  return (
    <div className="cafe-tab">
      <p className="cafe-desc">네이버 카페 게시판 목록 URL에서, 제목에 <strong>키워드</strong>가 들어간 글 링크만 조회합니다.</p>
      <div className="cafe-form">
        <label>
          <span>카페 목록 URL</span>
          <input
            type="url"
            value={cafeListUrl}
            onChange={(e) => setCafeListUrl(e.target.value)}
            placeholder="https://cafe.naver.com/..."
          />
        </label>
        <label>
          <span>키워드 (제목에 포함)</span>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="무지성 구매급"
          />
        </label>
        <button className="fetch-btn" onClick={handleFetch} disabled={loading}>
          {loading ? '조회 중…' : '링크 조회'}
        </button>
      </div>
      {error && <p className="cafe-error">{error}</p>}
      {links.length > 0 && (
        <div className="cafe-result">
          <p className="cafe-count">총 {links.length}개 링크</p>
          <ul className="cafe-list">
            {links.map((item, i) => (
              <li key={i}>
                <button type="button" className="cafe-link-btn" onClick={() => openLink(item.url)} title={item.url}>
                  {item.title}
                </button>
                <span className="cafe-url-truncate" title={item.url}>{item.url}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <style>{`
        .cafe-tab { display: flex; flex-direction: column; gap: 1rem; max-width: 720px; }
        .cafe-desc { margin: 0; font-size: 0.875rem; color: var(--text-muted); }
        .cafe-desc strong { color: var(--accent); }
        .cafe-form { display: flex; flex-direction: column; gap: 0.75rem; }
        .cafe-form label { display: flex; flex-direction: column; gap: 0.25rem; }
        .cafe-form label span { font-size: 0.8125rem; color: var(--text-muted); }
        .cafe-form input { padding: 0.5rem 0.75rem; background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px; color: var(--text); }
        .cafe-form input:focus { outline: none; border-color: var(--accent); }
        .fetch-btn { align-self: flex-start; padding: 0.5rem 1.5rem; background: var(--accent); color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .fetch-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .cafe-error { margin: 0; color: var(--danger); font-size: 0.875rem; }
        .cafe-result { margin-top: 0.5rem; }
        .cafe-count { margin: 0 0 0.5rem; font-size: 0.875rem; color: var(--text-muted); }
        .cafe-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
        .cafe-list li { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.5rem 0; border-bottom: 1px solid var(--border); }
        .cafe-link-btn { text-align: left; padding: 0; background: none; border: none; color: var(--accent); cursor: pointer; font-size: 0.9375rem; text-decoration: underline; }
        .cafe-link-btn:hover { color: var(--accent-hover, #7eb8ff); }
        .cafe-url-truncate { font-size: 0.75rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
      `}</style>
    </div>
  )
}
