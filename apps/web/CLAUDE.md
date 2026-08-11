# apps/web/ — 스코프 작업 지침

이 폴더의 파일을 다룰 때만 로드된다(온디맨드). 공통 행동규칙은 루트 `CLAUDE.md`,
프로젝트 표준·구현기준 22개는 `AGENTS.md`, 다음-할일은 `NEXT.md`를 따른다.

## 목표

Next.js 16 App Router 웹. 물건 목록·지도·상세, 로그인, 즐겨찾기, SEO, 내부 관리자 페이지(역채점).

## 소유 경로

`app/{admin,auth,components,favorites,items,login}`, `app/{layout,page,sitemap,robots,seo}.*`, `middleware.ts`
읽기 전용 입력: `packages/design-tokens`(시각 토큰), `apps/api`(HTTP 계약).

## 핵심 관례

- **`test` 스크립트가 테스트 파일을 열거한다.** 현재 `dist-test/app`, `app/items`, `app/items/map`,
  `app/login`, `app/auth` 만 실행된다. 다른 디렉토리(`app/admin`, `app/favorites`, `app/components` 등)에
  테스트를 새로 만들면 **조용히 실행되지 않는다** — `package.json`의 `test` 목록과
  `tsconfig.test.json`에 함께 등록할 것. jest가 아니라 `tsc` + `node --test` 조합이다.
- 시각 토큰·컴포넌트는 루트 `DESIGN-meta.md` + `docs/design/design-adaptation.md`를 따른다.
  스타일 값 하드코딩 금지 — 토큰 참조로만. 폰트는 Pretendard Variable.
- 지도는 어댑터 레이어를 거친다 (네이버 NCP Maps / 카카오 로컬 교체 가능해야 함 — D-010).
- 사용자 대면 문구: 해요체, 능동형, 긍정형, 전문용어는 쉬운 설명 병기. 판단·권유 표현 금지 (D-011).

## 검증

```
pnpm --filter @auction/web lint && pnpm --filter @auction/web test && pnpm --filter @auction/web build
```
