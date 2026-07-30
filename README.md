# 부동산 경매 플랫폼

경매 물건을 지도에서 탐색하고 자동 권리분석을 제공하는 플랫폼. 기획 문서는 `solution-planning/realestate-auction-platform/`, 구현 규칙은 `AGENTS.md`, 작업 지시서는 `docs/work-orders/` 참조.

## 구조

```
apps/api        NestJS 11 API 서버 (TypeScript)
apps/web        Next.js 16 웹 (물건 상세 SEO)
apps/mobile     React Native 0.86 앱 (WP-01b, 지도 홈 예정)
packages/shared 공용 타입·유틸
tools/collector Python 수집 배치 (법원경매정보)
```

## 실행 방법

```bash
# 0) 요구 도구: Node 24+, pnpm 9+, Python 3.12+, Docker
# 1) 환경 변수: .env.example을 .env로 복사 후 값 기입
# 2) DB 기동
docker compose up -d
# 3) 의존성 설치
pnpm install
# 4) API 개발 서버 — apps/web과 동시에 띄우려면 apps/api/.env에 PORT=4000을 넣어 포트 충돌을 피한다
#    (둘 다 기본 3000번을 쓴다). apps/web은 물건 상세 조회 시 API_BASE_URL(기본 http://localhost:4000)로 호출한다.
pnpm --filter @auction/api start:dev   # http://localhost:4000/health
# 5) 웹 개발 서버 — /items/map(지도 화면)을 쓰려면 NEXT_PUBLIC_NCP_MAPS_CLIENT_ID에 .env의
#    NCP_MAPS_CLIENT_ID와 같은 값을 넣어야 한다(공개값, NCP 콘솔에 서비스 URL 등록 필요)
pnpm --filter @auction/web dev
```

## 모바일(RN) 개발 환경

Android SDK를 명령줄 도구로만 설치했다 (Android Studio 미설치). 에뮬레이터(AVD `AuctionTest`, Android 15/x86_64)도 추가 설치해 헤드리스 실행까지 검증함.

```bash
# 요구 도구: JDK 17 권장(현재 이 머신은 21로 빌드 확인됨), ANDROID_HOME=C:\Android\sdk
cd apps/mobile
npx react-native start          # Metro (별도 터미널)
npx react-native run-android    # adb devices에 실기기·에뮬레이터가 연결돼 있어야 함

# 에뮬레이터를 헤드리스로 띄우려면
C:\Android\sdk\emulator\emulator.exe -avd AuctionTest -no-window -no-audio -gpu swiftshader_indirect
```

- `.npmrc`의 `node-linker=hoisted`는 RN/Metro가 pnpm의 기본 격리형 node_modules 구조를 못 읽어서 필요하다.
- `jest.config.js`의 `transformIgnorePatterns`는 pnpm의 `node_modules/.pnpm/<pkg>@<hash>/node_modules/...` 중첩 구조에 맞게 재정의했다 (기본 `@react-native/jest-preset` 값은 이 구조를 몰라서 react-native 자신도 잘못 무시함).
- `metro.config.js`도 같은 이유로 `resolver.unstable_enableSymlinks`/`unstable_enablePackageExports` + `watchFolders`(레포 루트)를 켜야 한다 — 안 하면 실행 시 `@babel/runtime/helpers/interopRequireDefault` 등을 못 찾는다는 빨간 에러 화면이 뜬다. 설정을 바꾸면 `npx react-native start --reset-cache`로 캐시를 지우고 재시작해야 반영된다.
- `@react-native/jest-preset`, `@react-native/gradle-plugin`, `@react-native/codegen`은 `react-native init` 0.86 템플릿의 package.json에 누락돼 있어 devDependencies에 직접 추가했다.
- 첫 Gradle 빌드는 NDK·CMake·추가 SDK Platform을 자동으로 더 받아서 20분 이상 걸릴 수 있다 (이후 빌드는 캐시로 빨라짐).
- Git Bash에서 `adb shell screencap /sdcard/...`처럼 절대경로를 인자로 쓰면 MSYS가 경로를 Windows 스타일로 잘못 바꿔서 실패한다 — 명령 앞에 `MSYS_NO_PATHCONV=1`을 붙인다.

## 테스트·검증

```bash
pnpm -r lint && pnpm -r test && pnpm -r build   # TS 전체
cd tools/collector
python -m venv .venv
.venv/Scripts/python -m pip install -e .
.venv/Scripts/python -m ruff check .
.venv/Scripts/python -m pytest

# PostGIS 적재·bbox 통합 테스트
$env:COLLECTOR_RUN_DB_TESTS="1"
$env:DATABASE_URL="postgresql://app:changeme@localhost:55432/auction"
.venv/Scripts/python -m pytest tests/test_postgres_repository.py
```

## 수집기 실행

```bash
cd tools/collector

# 마이그레이션 + 법원 1곳 1페이지 수집
.venv/Scripts/python -m collector --migrate --court-office-code B000210 --page-no 1

# 사진이 아직 없는 사건의 물건 사진 수집 (사건당 요청 1회, 사진은 사건당 수 MB일 수 있다)
.venv/Scripts/python -m collector photos --court-office-code B000210 --limit 5
```

## 장애 확인

- API 생존: `curl http://localhost:4000/health` → `{"status":"ok",...}` (apps/api/.env에서 PORT=4000 설정 시)
- API가 기동하지 않으면: 콘솔의 "환경 변수 검증 실패" 메시지 확인 (.env의 DATABASE_URL 등)
- DB 확인: `docker exec auction-db psql -U app -d auction -c "SELECT PostGIS_Version();"`
- 수집기 DB 연결 실패: `.env`의 `DATABASE_URL`과 Docker volume의 DB 계정이 일치하는지 확인. 기존 volume 비밀번호가 다르면 새 테스트 컨테이너를 별도 포트로 띄워 검증한다.
- 수집기 차단 감지: HTTP 403/429가 발생하면 우회하지 않고 중단한다. 로그의 `run_id`, `court`, `page`, `processed`, `inserted`, `updated`, `skipped` 값을 기준으로 재시작 범위를 판단한다.

## 보안 메모

- 실제 비밀값은 `.env`에만 (커밋 금지 — .gitignore 등록됨). `.env.example`은 플레이스홀더만.
- 개인정보·토큰을 코드/로그/응답에 노출하지 않는다 (AGENTS.md 규칙 8).
