# CatchDeal (캐치딜)

쿠팡 카테고리를 실시간 스캐닝해 **가격 오류·고할인율** 등 조건에 맞는 상품을 잡아 **[자동 구매 → 수익화 → 자사몰 전송]**까지 처리하는 리셀러 전용 B2B 솔루션입니다.

- **저장소:** [https://github.com/yeomjw0907/catchdeal](https://github.com/yeomjw0907/catchdeal)

---

## 프로젝트 개요

| 구분 | 설명 |
|------|------|
| **목적** | 쿠팡 조건 충족 상품 자동 포착 → 구매 → Supabase `trade_logs` 동기화 → 관리자/쇼핑몰 연동 |
| **구조** | Monorepo (고객용 PC 앱 + 관리자 웹 + 리셀 쇼핑몰 + 공통 패키지) |
| **플랫폼** | Windows 데스크톱 앱(.exe), Next.js 웹 앱 |

---

## 저장소 구조

```
catchdeal/
├── apps/
│   ├── client-exe/     # 고객용 PC 프로그램 (Electron + React + Playwright)
│   ├── admin-web/      # 관리자 대시보드 (Next.js + Tailwind + Supabase)
│   └── mall-web/       # 리셀 쇼핑몰 (Next.js + Tailwind + Supabase)
├── packages/
│   └── shared/         # 공통 타입·상수 (@catchdeal/shared)
├── package.json       # 루트 워크스페이스
├── .env.example       # 환경 변수 예시
├── sql_setup/           # SQL 스크립트 (번호 순 실행)
│   ├── 01_supabase_schema.sql
│   └── README.md
└── README.md
```

---

## 기술 스택

| 앱 | 스택 |
|----|------|
| **client-exe** | Electron, React, TypeScript, Vite, Playwright, Supabase, electron-store |
| **admin-web** | Next.js (App Router), Tailwind CSS, Supabase |
| **mall-web** | Next.js (App Router), Tailwind CSS, Supabase |
| **shared** | TypeScript (타입·상수만) |

---

## 사전 요구사항

- **Node.js** 18 이상
- **Windows** (client-exe 실행/빌드 시)
- **Supabase** 프로젝트 (Auth, PostgreSQL)
- **Git** (클론/푸시용)

---

## 1. 저장소 클론

```bash
git clone https://github.com/yeomjw0907/catchdeal.git
cd catchdeal
```

---

## 2. 의존성 설치

**프로젝트 루트**에서 한 번만 실행하면 모든 앱·패키지 의존성이 설치됩니다.

```bash
npm install
```

---

## 3. 공통 패키지 빌드

타입·상수를 쓰는 앱(client-exe, admin-web, mall-web)이 동작하려면 `@catchdeal/shared`를 먼저 빌드해야 합니다.

```bash
npm run build:shared
```

---

## 4. 환경 변수 설정

- **client-exe:** 루트 또는 `apps/client-exe/`에 `.env` 파일 생성  
- **admin-web / mall-web:** 각 앱 폴더에 `.env.local` 생성 (필요 시)

`.env.example`을 복사해 사용할 수 있습니다.

```bash
# 예: 루트에 .env 생성
cp .env.example .env
# .env 내용 수정: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

| 변수 | 설명 | 사용 앱 |
|------|------|----------|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL | client-exe |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon(public) key | client-exe |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | admin-web, mall-web |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | admin-web, mall-web |

---

## 5. 구동 방법 (실행)

### 고객용 PC 프로그램 (client-exe)

```bash
# 1) shared 빌드 (최초 1회 또는 shared 수정 후)
npm run build:shared

# 2) 개발 모드 실행 (Electron + Vite)
npm run dev:client
```

- **Playwright Chromium** 최초 1회 설치 권장:
  ```bash
  npx playwright install chromium
  ```
- Windows 설치용 빌드(.exe):
  ```bash
  npm run build:win -w client-exe
  ```
  → `apps/client-exe/release/` 에 설치 파일 생성

### 관리자 웹 (admin-web)

```bash
npm run dev:admin
```

- 브라우저: **http://localhost:3001**

### 리셀 쇼핑몰 (mall-web)

```bash
npm run dev:mall
```

- 브라우저: **http://localhost:3002**

---

## 6. 루트 스크립트 요약

| 명령어 | 설명 |
|--------|------|
| `npm install` | 전체 의존성 설치 |
| `npm run build:shared` | `@catchdeal/shared` 빌드 |
| `npm run dev:client` | client-exe 개발 모드 (shared 빌드 후 실행) |
| `npm run dev:admin` | admin-web 개발 서버 (포트 3001) |
| `npm run dev:mall` | mall-web 개발 서버 (포트 3002) |
| `npm run build:client` | client-exe 빌드 (일반) |
| `npm run build:win -w client-exe` | client-exe Windows 설치용 빌드 |

---

## 7. 데이터베이스 (Supabase)

Supabase 대시보드 **SQL Editor**에서 `sql_setup/01_supabase_schema.sql`을 실행해 테이블을 생성합니다. 이후 스크립트는 번호 순(02, 03, …)으로 추가·실행하면 됩니다.

- **subscription_users** — 구독/라이선스, HWID, 만료일
- **trade_logs** — 구매 로그 (상품명, 구매가, 판매예정가, 상태 등)

RLS(Row Level Security) 정책이 포함되어 있습니다.

---

## 8. 앱별 역할

| 앱 | 역할 |
|----|------|
| **client-exe** | 쿠팡 로그인, 카테고리 스캔, 조건 필터(가격/할인율/제외 키워드), 자동 구매, 결제 비밀번호 저장, 구매 내역을 `trade_logs`에 전송 |
| **admin-web** | 회원·라이선스 관리, 통계 모니터링 (구현 예정) |
| **mall-web** | 자동 구매된 상품이 노출되는 리셀 쇼핑몰 (구현 예정) |
| **shared** | `SubscriptionUser`, `TradeLog`, `AppConfig` 등 공통 타입·상수 |

---

## 9. 문제 해결

- **client-exe 실행 시 “Supabase URL/Key not configured”**  
  → `.env`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 설정 후 재실행

- **`@catchdeal/shared` 관련 타입/모듈 오류**  
  → `npm run build:shared` 실행 후 다시 `npm run dev:client` 등 실행

- **Playwright 관련 오류**  
  → `npx playwright install chromium` 실행

- **포트 충돌**  
  → admin-web(3001), mall-web(3002)이 사용 중이면 해당 프로세스 종료 후 재실행

---

## 10. 라이선스

UNLICENSED (비공개 프로젝트)

---

## 링크

- **GitHub:** [https://github.com/yeomjw0907/catchdeal](https://github.com/yeomjw0907/catchdeal)
