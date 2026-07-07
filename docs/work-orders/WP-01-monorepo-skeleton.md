# WP-01. 모노레포 골격 세팅

- 상태: **완료 (2026-07-07, Claude)** — RN 모바일은 WP-01b로 분리 (Android SDK 등 네이티브 환경 구성 필요). 완료 기준 전부 통과: lint/test/build ✅, PostGIS 3.6 ✅ (PG18 이미지는 볼륨 마운트 `/var/lib/postgresql` 주의), /health 200 ✅, collector ruff+pytest ✅. 특이사항: `.prettierrc`·`eslint.config.mjs`는 설정 보호 훅 때문에 각각 생략(기본값 사용)·Bash로 생성(규칙 강화 방향).
- 선행: 없음 | 담당 에이전트: Claude (main)
- 시작 전 필독: `AGENTS.md`, `solution-planning/realestate-auction-platform/06-tech-blueprint.md`

## 목적
확정 스택(D-004)의 실행 가능한 최소 골격을 만든다. 기능 구현은 하지 않는다.

## 요구사항
1. pnpm workspace 모노레포:
   - `apps/api` — NestJS 11 (헬스체크 `GET /health`만: `{status:"ok", version}`)
   - `apps/web` — Next.js 16 (플레이스홀더 페이지 1개)
   - `apps/mobile` — React Native 0.86 (초기 화면 1개; RN 환경 구성이 과도하게 길어지면 이 항목만 WP-01b로 분리 제안 가능)
   - `packages/shared` — 공용 타입/상수 (빈 껍데기 + 샘플 타입 1개)
   - `tools/collector` — Python 프로젝트 골격 (pyproject.toml, ruff, pytest, 빈 main)
2. `docker-compose.yml`: postgres 18 + postgis 3.6 (이미지: postgis/postgis), 볼륨, `.env` 연동
3. 루트 스크립트: `pnpm -r lint`, `pnpm -r test`, `pnpm -r build` 동작 (eslint+prettier, jest/vitest 중 NestJS·Next 기본값 유지 — 규칙 14)
   - 공통 `tsconfig.base.json`: `strict: true` + `noUncheckedIndexedAccess` (규칙 19)
   - ESLint 공통 규칙: `@typescript-eslint/no-explicit-any: error` (규칙 19)
   - `apps/api`: 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` + 환경 변수 부팅 시 zod 스키마 검증 — 실패 시 기동 중단 (규칙 21)
4. `.env.example`은 이미 존재 — 앱에서 환경 변수 로딩 구조만 연결 (하드코딩 금지 — 규칙 13)
5. `.gitignore`, 루트 `README.md` (실행 방법·설정·테스트 방법 — 규칙 17)

## 완료 기준 (검증 가능)
- [ ] `pnpm install && pnpm -r lint && pnpm -r test && pnpm -r build` 전부 통과
- [ ] `docker compose up -d` 후 `SELECT PostGIS_Version();` 성공
- [ ] `apps/api` 기동 후 `curl localhost:3000/health` → 200
- [ ] `tools/collector`: `ruff check . && pytest` 통과 (샘플 테스트 1개)
- [ ] 규칙 18 형식의 완료 보고

## 범위 제외
DB 스키마(WP-02), 지도, 인증, CI 파이프라인(추후), 배포.
