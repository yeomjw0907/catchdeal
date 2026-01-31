# CatchDeal Phase별 할 일 정리

각 Phase를 순서대로 진행하며, 완료된 항목은 체크해 나갑니다.

---

## Phase 1: 앱 기반 (Foundation)

**목표:** Supabase 로그인, HWID/구독 검증, 앱 셸 구성

| # | 할 일 | 상태 | 비고 |
|---|--------|------|------|
| 1.1 | Supabase 로그인 (이메일/비밀번호) | ✅ | `auth.ts` |
| 1.2 | 구독 사용자 조회 및 활성/만료 검증 | ✅ | `getSubscriptionUser` |
| 1.3 | HWID 검증 (등록 기기 여부) | ✅ | `hwid.ts` |
| 1.4 | 세션 유지 (access_token, refresh_token 저장) | ✅ | electron-store |
| 1.5 | 로그인/대시보드 라우팅 (Login ↔ Dashboard) | ✅ | `App.tsx`, `Login.tsx`, `Dashboard.tsx` |
| 1.6 | 탭 구조 (대시보드 / 조회하기 / 카페 링크 / 환경설정) | ✅ | `Dashboard.tsx`, `MainTab`, `QueryTab`, `CafeTab`, `SettingsTab` |

---

## Phase 2: 쿠팡 세션 (Coupang Session)

**목표:** 쿠팡 로그인 또는 쿠키로 세션 확보 → 자동 구매 시 사용

| # | 할 일 | 상태 | 비고 |
|---|--------|------|------|
| 2.1 | 쿠팡 로그인 팝업 (Electron BrowserWindow) | ✅ | Access Denied 시 수동 쿠키 사용 |
| 2.2 | 수동 쿠키 적용 (Chrome 내보낸 JSON 붙여넣기) | ✅ | EditThisCookie/Cookie-Editor |
| 2.3 | 쿠키 저장 및 스캐너에 전달 | ✅ | `getCoupangCookies()`, store |
| 2.4 | Chrome 디버깅 모드 실행 (CDP 연결) | ✅ | `launchChromeWithDebug`, `--disable-extensions` |
| 2.5 | (선택) 로그인 버튼 클릭 시 기본 브라우저(Chrome)로 열기 | ⬜ | 쿠키는 수동 적용 필요 |

---

## Phase 3: 카페 기반 수집 (Cafe-based Collection)

**목표:** 카페 목록 → 키워드 필터 → 글 진입 → 링크 추출 → 실시간 해부(상품명·구매가 파싱)

| # | 할 일 | 상태 | 비고 |
|---|--------|------|------|
| 3.1 | 카페 소스 설정 (목록 URL + 키워드) 저장/로드 | ✅ | `config.cafeSources`, `SettingsTab` |
| 3.2 | 카페 스캐너: 목록 페이지 파싱, 키워드 포함 글만 수집 | ✅ | `getPostLinksFromListPage` |
| 3.3 | 글 본문에서 쿠팡 링크 추출 | ✅ | `extractLinksFromPostPage` |
| 3.4 | 추출된 링크 저장 및 조회하기 탭에 표시 | ✅ | `extractedLinks`, `engine:extractedLinks` |
| 3.5 | 링크 접속 (실시간) + 로그 "링크 접속을 진행합니다" / "접속 완료" | ✅ | `runCafeScanner` 내 링크 루프 |
| 3.6 | 실시간 해부: 쿠팡 상품 페이지에서 상품명·구매가 파싱 | ✅ | `parseCoupangProductPage` |
| 3.7 | 해부 실패 시 후순위로 미루고 최대 5회 재시도 | ✅ | 큐 + `retryCount`, `MAX_DISSECT_RETRIES` |
| 3.8 | 5회 재시도 후 실패 처리 + 로그 + 조회하기에 "실패" 표시 | ✅ | `onLinkFailed`, `status: 'failed'` |
| 3.9 | 탭 이동해도 Start 유지 (로그/상태 구독을 Dashboard에서) | ✅ | `Dashboard`에서 `onLog`/`onStatusChange` |
| 3.10 | 조회하기: 추출된 링크 목록 + 상태(해부 중/성공/실패) + 상품명·구매가 | ✅ | `QueryTab`, `ExtractedLinkItem` |
| 3.11 | 쿠팡 상품 페이지 DOM 변경 시 해부 셀렉터 점검/수정 | ⬜ | `parseCoupangProductPage` 내 셀렉터 |
| 3.12 | (선택) 네이버 카페 목록/본문 DOM 변경 시 파싱 셀렉터 점검 | ⬜ | `getPostLinksFromListPage`, `extractLinksFromPostPage` |

---

## Phase 4: 자동 구매 (Auto-purchase)

**목표:** 해부된 쿠팡 링크(또는 추출 링크)만 받아서 자동 구매 — "쿠팡 링크만 다 들어가서 구매까지"

| # | 할 일 | 상태 | 비고 |
|---|--------|------|------|
| 4.1 | 해부 성공 상품 중 필터(minPrice, 할인율 등) 통과한 것만 구매 후보 | ⬜ | 기존 `matchFilter` 또는 확장 |
| 4.2 | 구매 담당: 쿠팡 링크만 입력받아 접속 → 장바구니/바로구매 → 결제 | ⬜ | `tryPurchase` 로직 재사용 또는 별도 모듈 |
| 4.3 | 중복/이미 구매 상품도 다시 뜨면 구매 (필터로만 제어) | ✅ | 별도 “이미 구매 제외” 로직 없음 |
| 4.4 | 구매 성공 시 `trade_logs` INSERT | ✅ | 기존 `insertTradeLog` |
| 4.5 | 구매 실패 시 로그 및 다음 상품 진행 | ✅ | 기존 동작 |
| 4.6 | 쿠팡 결제 플로우 변경 시 셀렉터/단계 점검 | ⬜ | `tryPurchase` 내 버튼/입력 셀렉터 |
| 4.7 | (선택) 주문번호(order_id) 수집 후 trade_logs에 저장 | ⬜ | |
| 4.8 | (선택) 구매 제한(1일 N건 등) 설정 | ⬜ | config 또는 서버 정책 |

---

## Phase 5: 필터 고도화 (Filter & Settings)

**목표:** "맘에 안드는거 사는거 방지" — 설정에서 필터 세분화

| # | 할 일 | 상태 | 비고 |
|---|--------|------|------|
| 5.1 | 최소 가격 / 목표 할인율 / 제외 키워드 유지 | ✅ | `FilterConfig` |
| 5.2 | 필터 세분화: 상품명 포함 키워드, 제외 키워드 확장 등 | ⬜ | 설정 페이지 UI + config |
| 5.3 | 해부된 상품에만 적용되는 필터와 구매 단계 필터 정리 | ⬜ | 설계 후 적용 |
| 5.4 | (선택) 카테고리/브랜드 등 추가 필터 | ⬜ | |

---

## Phase 6: 마무리 및 배포 (Polish & Release)

**목표:** 보안 경고 해소, 패키징, UI/UX 정리

| # | 할 일 | 상태 | 비고 |
|---|--------|------|------|
| 6.1 | Content-Security-Policy 설정 (CSP) | ⬜ | renderer 보안 |
| 6.2 | `unsafe-eval` 제거 가능 여부 확인 (Vite/React 빌드 호환) | ⬜ | CSP 강화 시 |
| 6.3 | Electron 앱 패키징 (Windows exe 등) | ⬜ | electron-builder 등 |
| 6.4 | 조회하기: trade_logs 목록 새로고침, 정렬/필터 | ✅ | `QueryTab`, `getTradeLogs` |
| 6.5 | 조회하기: 주문내역/판매글 링크 동작 확인 | ✅ | `openOrderPage`, `openSalePage` |
| 6.6 | 환경설정 UI: 쿠키 적용 안내 문구 유지 | ✅ | Access Denied 시 수동 절차 |
| 6.7 | (선택) 관리자/쇼핑몰 웹 (admin-web, mall-web) 연동 | ⬜ | 모노레포 내 별도 앱 |

---

## 진행 요약

| Phase | 요약 | 진행 |
|-------|------|------|
| 1 | 앱 기반 | ✅ 완료 |
| 2 | 쿠팡 세션 | ✅ 수동 쿠키 + CDP |
| 3 | 카페 기반 수집 + 실시간 해부 | ✅ 완료 (셀렉터 검증만 남음) |
| 4 | 자동 구매 (해부 → 필터 → 구매) | ⬜ 구매 담당 연동 필요 |
| 5 | 필터 고도화 | ⬜ 설정 세분화 |
| 6 | 마무리·배포 | ⬜ CSP, 패키징 등 |

---

## 아키텍처 요약

- **대시보드 탭:** 정보 긁어오는 친구 — 카페 스캔(목록 → 키워드 → 글 → 링크 추출 + 실시간 해부).
- **조회하기 탭:** 링크/해부 결과 보기 — 추출된 링크, 상태(해부 중/성공/실패), 상품명·구매가; 거래 내역.
- **구매:** 해부된 쿠팡 링크만 받아 자동 구매 (Phase 4에서 연동).
- **필터:** 추후 고도화에서 설정 페이지에서 세분화 (Phase 5).

필요 시 각 Phase 내 항목을 이슈/태스크로 쪼개서 관리하면 됩니다.
