# CatchDeal 1차 배포 가이드

## 1. 빌드 방법

**필수:** Node.js 18+, npm

```bash
# 프로젝트 루트에서
cd "catch deal"

# 의존성 설치 (최초 1회)
npm install

# Windows 설치용 exe 빌드 (루트에서)
npm run build:client:win

# 또는 client-exe 폴더에서
cd apps/client-exe && npm run build:win
```

- 모노레포이므로 **루트에서 `npm install`** 한 뒤, **shared 패키지를 먼저 빌드**해 두어야 합니다. (이미 빌드된 적 있으면 생략 가능)
  ```bash
  npm run build -w @catchdeal/shared
  ```
- `build:win`은 `tsc` → `vite build` → `electron-builder --win` 순으로 실행되어 **Windows용 설치 파일**이 만들어집니다.

### Windows에서 빌드 시 "Cannot create symbolic link" 오류가 나는 경우

electron-builder가 winCodeSign 도구를 압축 해제할 때 **심볼릭 링크**를 만들려다 실패할 수 있습니다. 다음 중 하나를 적용하세요.

1. **관리자 권한으로 빌드**  
   PowerShell 또는 CMD를 **관리자 권한으로 실행**한 뒤, 같은 경로에서 `npm run build:client:win`을 다시 실행합니다.
2. **개발자 모드 켜기**  
   Windows 설정 → **개발자용** → **개발자 모드** 켜기. (심볼릭 링크 생성 권한이 일반 사용자에게 허용됩니다.)

---

## 2. 빌드 결과물 위치

| 경로 | 설명 |
|------|------|
| `apps/client-exe/release/` | electron-builder 출력 폴더 |
| `apps/client-exe/release/CatchDeal Setup 1.0.0.exe` | **NSIS 설치 프로그램** (사용자에게 전달용) |
| `apps/client-exe/release/win-unpacked/` | 설치 없이 실행 가능한 **포터블 폴더** (폴더 통째로 zip 가능) |

- **설치 exe만 전달:** `CatchDeal Setup 1.0.0.exe` 하나만 전달하면 됩니다.
- **포터블로 전달:** `win-unpacked` 폴더를 zip으로 압축해서 전달하면, 설치 없이 압축 풀고 실행 가능합니다.

---

## 3. 사용자에게 전달하는 방법

### 방법 A: 설치 exe 전달 (권장)

1. `apps/client-exe/release/CatchDeal Setup 1.0.0.exe` 복사
2. 전달: USB, 공유 드라이브, 메신저, 이메일 등
3. 사용자: exe 실행 → 설치 경로 선택 → 설치 → 바탕화면/시작 메뉴에서 "CatchDeal" 실행

### 방법 B: 포터블 zip 전달

1. `apps/client-exe/release/win-unpacked` 폴더 전체를 zip으로 압축 (예: `CatchDeal-1.0.0-portable.zip`)
2. 사용자: zip 풀기 → 폴더 안의 `CatchDeal.exe` 실행

### 방법 C: 다운로드 링크 제공 (추후)

- Google Drive, OneDrive, 자체 서버, GitHub Releases 등에 exe 또는 zip 업로드 후 링크 공유
- 1차는 A 또는 B로 전달해도 충분합니다.

---

## 4. 사용자 안내 사항 (전달 시 같이 알려주기)

- **Chrome 설치 필요**  
  카페 스캔·쿠팡 접속 시 Chrome 디버깅 모드로 연결합니다. Chrome이 없으면 동작하지 않습니다.

- **최초 실행 후**
  1. 로그인 (이메일/비밀번호)
  2. 환경설정에서 **쿠팡 쿠키** 적용 (Chrome에서 쿠팡 로그인 후 쿠키 내보내기 → JSON 붙여넣기)
  3. 환경설정에서 **카페 소스** 추가 (목록 URL + 키워드, 예: 무지성 구매급)
  4. **Chrome 디버깅 모드로 실행** 버튼으로 Chrome 띄운 뒤, 대시보드에서 Start

- **Windows Defender/백신**  
  exe 실행 시 “알 수 없는 게시자” 경고가 나올 수 있습니다. 서명 인증서를 쓰지 않으면 흔한 현상이며, “실행” 선택하면 됩니다. (추후 코드 서명 인증서를 넣으면 경고 감소)

---

## 5. 버전 올릴 때

- `apps/client-exe/package.json`의 `"version": "1.0.0"` 수정 후 다시 빌드하면, 설치 파일 이름이 `CatchDeal Setup 1.0.1.exe`처럼 바뀝니다.
- 사용자에게는 "새 버전 나왔으니 기존 건 삭제하고 새 exe로 설치해 주세요" 정도로 안내하면 됩니다.

---

## 6. 요약

| 단계 | 할 일 |
|------|--------|
| 1 | 루트에서 `npm install` → `npm run build:shared` (최초 1회) → `npm run build:client:win` |
| 2 | `apps/client-exe/release/CatchDeal Setup 1.0.0.exe` 확인 |
| 3 | 이 exe(또는 win-unpacked zip)를 사용자에게 전달 |
| 4 | 위 "사용자 안내 사항"을 문서/메시지로 함께 전달 |

이렇게 하면 1차 배포와 전달이 가능합니다.
