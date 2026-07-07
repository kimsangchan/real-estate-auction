# 부동산 경매 플랫폼

경매 물건을 지도에서 탐색하고 자동 권리분석을 제공하는 플랫폼. 기획 문서는 `solution-planning/realestate-auction-platform/`, 구현 규칙은 `AGENTS.md`, 작업 지시서는 `docs/work-orders/` 참조.

## 구조

```
apps/api        NestJS 11 API 서버 (TypeScript)
apps/web        Next.js 16 웹 (물건 상세 SEO)
apps/mobile     React Native 앱 — WP-01b에서 추가 예정
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
# 4) API 개발 서버
pnpm --filter @auction/api start:dev   # http://localhost:3000/health
# 5) 웹 개발 서버
pnpm --filter @auction/web dev
```

## 테스트·검증

```bash
pnpm -r lint && pnpm -r test && pnpm -r build   # TS 전체
cd tools/collector && .venv/Scripts/ruff check . && .venv/Scripts/pytest  # 수집기 (venv 생성: python -m venv .venv && .venv/Scripts/pip install pytest ruff)
```

## 장애 확인

- API 생존: `curl http://localhost:3000/health` → `{"status":"ok",...}`
- API가 기동하지 않으면: 콘솔의 "환경 변수 검증 실패" 메시지 확인 (.env의 DATABASE_URL 등)
- DB 확인: `docker exec auction-db psql -U app -d auction -c "SELECT PostGIS_Version();"`

## 보안 메모

- 실제 비밀값은 `.env`에만 (커밋 금지 — .gitignore 등록됨). `.env.example`은 플레이스홀더만.
- 개인정보·토큰을 코드/로그/응답에 노출하지 않는다 (AGENTS.md 규칙 8).
