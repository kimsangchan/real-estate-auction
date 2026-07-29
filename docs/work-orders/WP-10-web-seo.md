# WP-10. Next.js 물건 상세 웹 SEO (로드맵 2-7)

- 상태: **완료 (2026-07-29)** — §2-a~h 전부 통과. Lighthouse SEO는 색인 허용 4페이지에서
  100/100/100/91로 기준(≥90)을 넘었다. 적대적 리뷰 1회 후 지적 2건(색인 스팸 벡터, 빵부스러기
  불일치) 반영. **로드맵 2-7의 나머지 절반인 "물건 페이지 색인 등록 확인"은 실도메인·Search
  Console이 필요해 범위 제외**(§4) — 2-7은 아직 종결되지 않았다. 알려진 한계는 §5, 리뷰 반영은 §6.
- 시작 전 필독: `AGENTS.md`, 이 문서 전체, `WP-07-web-map.md`(§1 웹 구조),
  `WP-08-auth-favorites.md`(§1-8 로그인 헤더·비로그인 탐색 T-04), `07-roadmap.md` 2-7

## 목적

`apps/web`의 물건 페이지가 검색엔진에 제대로 색인되도록 메타데이터·크롤링 제어·구조화 데이터를
정비한다. 로드맵 2-7의 완료 기준 중 **Lighthouse SEO ≥90**을 이번 범위에서 실증한다.

**색인 등록 확인은 이번 범위 제외** — 실도메인 + Search Console 소유권 확인이 선행돼야 한다
(사용자 확정, 2026-07-29). 코드는 `SITE_URL` 환경변수만 바꾸면 실도메인에서 바로 동작하는 상태로
남긴다.

## §0. 사용자 액션 (착수 전 필요)

없음. 로컬 `auction-db`(기동 중)와 `apps/api`만 있으면 전부 검증 가능하다.

## §1. 확정된 설계 결정 (재논의 금지 — 근거 포함)

1. **이미 있는 것은 다시 만들지 않는다.** `app/robots.ts`, `app/sitemap.ts`, 루트 `layout.tsx`의
   `metadata`, `items/[id]/page.tsx`의 `generateMetadata`, `<html lang="ko">`는 이미 존재한다.
   이번 작업은 **보강**이지 신규 구축이 아니다 (규칙: 표면적 최소 변경).

2. **`metadataBase`를 루트 `layout.tsx`에 한 번만 둔다.** 값은 `SITE_URL`(기본
   `http://localhost:3000`) — `robots.ts`·`sitemap.ts`가 이미 쓰는 환경변수와 **같은 이름을 재사용**한다.
   새 환경변수를 만들지 않는다. 각 페이지는 `alternates.canonical`에 **상대 경로만** 적고
   절대 URL 조립은 Next에 맡긴다(도메인 하드코딩 0건).

3. **noindex 대상을 명시적으로 정한다.** 지금은 전 페이지가 색인 허용이라 아래가 전부 샌다.
   - `/login`, `/favorites` — 인증·개인화 페이지. 색인 가치가 없고 로그인 벽 뒤 콘텐츠다.
   - `/items/[id]/rights-analysis`, `/items/[id]/risks`, `/items/[id]/checklist` —
     **세 화면 모두 `sample-data.ts` 예시 데이터를 렌더한다**(각 파일 상단 주석에 명시).
     즉 물건 ID가 무엇이든 **동일한 본문**이 나온다. 색인되면 ① 물건 수만큼 중복 콘텐츠가 생겨
     사이트 전체 평가가 깎이고 ② 예시 권리분석이 특정 물건의 실제 분석처럼 검색결과에 노출된다
     (D-011 관점에서 특히 위험). **실데이터 연동 전까지 noindex**, 연동 시 해제한다.
   - `/items/map` — 지도는 클라이언트 JS 렌더라 색인할 본문이 없다.
   - **`/items/browse?sido=…`(지역 필터가 붙은 모든 변형)** — `sido`/`sigungu`는 검증 없이 제목·
     본문에 그대로 반영된다. 색인을 허용하면 누구나 `?sido=<스팸 문구>`로 이 도메인 아래에 고유
     제목을 가진 색인 가능 URL을 무한히 찍어낼 수 있다(리뷰에서 실증). 물건이 50건뿐이라 지역
     페이지의 색인 가치도 낮다. **필터 없는 `/items/browse`만 색인 허용**하고, 필터 변형에는
     canonical을 주지 않는다(noindex와 canonical을 같이 주면 상충 신호). 지역 페이지가 실제로
     쌓이면 그때 지역명 화이트리스트 검증을 붙이고 해제한다.
   - 위 경로는 `robots.ts`의 `disallow`가 아니라 **페이지 `metadata.robots`의 noindex로 막는다**.
     `disallow`로 막으면 크롤러가 페이지를 못 읽어 noindex 자체를 못 보고, 외부 링크가 있으면
     오히려 URL만 색인될 수 있다. `robots.ts`의 `disallow`는 `/api/`(프록시 경로)에만 쓴다.

4. **메타 설명이 없는 페이지에 채워 넣는다.** 현재 `/`(홈), `/items`, `/items/browse`에
   페이지 고유 `metadata`가 없어 루트 레이아웃 값이 그대로 상속된다 → Lighthouse의
   `document-title`·`meta-description`은 통과하지만 **모든 페이지 제목이 동일**해 색인 품질이 나쁘다.
   페이지별 `title`·`description`을 넣는다. **본문 콘텐츠는 건드리지 않는다** — 홈의
   "준비 중이에요" 개편은 이번 범위 밖이다(로드맵 2-1/2-2 영역).

5. **구조화 데이터는 `BreadcrumbList`만.** `Product`/`Offer`/`RealEstateListing`은 쓰지 않는다 —
   우리는 판매자도 중개인도 아니고, 최저매각가격은 우리가 제시하는 가격이 아니다. 잘못된 마크업은
   구글 구조화 데이터 정책 위반이며 D-011(판단·권유 금지) 정신과도 어긋난다.
   물건 상세에 `경매 물건 목록 > 주소` 2단계 빵부스러기를 JSON-LD로 넣는다. **물건종류(아파트 등)를
   중간 단계로 넣지 않는다** — 종류별 목록 페이지가 없어 URL을 줄 수 없고, URL 없는 중간 항목은
   구조화 데이터 경고를 낳는다. 화면에 없는 정보를 마크업에만 넣지 않는다는 원칙도 같은 결론이다.
   **마지막 항목(현재 페이지)은 `item` URL을 생략한다** — schema.org가 요구하지 않는다.
   최종 형태는 `경매 물건 목록`(→`/items`) `>` `{물건종류}`(URL 없음)이며, **화면 빵부스러기 문구와
   글자 단위로 같아야 한다**(리뷰 지적 반영 — 원래 화면은 링크 없는 "물건상세검색 > 종류"였다).

6. **OG/트위터 카드는 텍스트 필드만.** `title`·`description`·`url`·`siteName`·`locale`·`type`.
   **OG 이미지는 넣지 않는다** — 실도메인이 없어 절대 URL을 확정할 수 없고, Lighthouse SEO 점수에
   들어가지 않는다. 도메인 확보 후 후속으로 뺀다(§5).

7. **`sitemap.ts`는 noindex 경로를 넣지 않는다.** 현재 정적 3건 + 물건 상세만 넣고 있어 이미
   맞다 — `/login`·`/favorites`·하위 4화면이 새로 들어가지 않는지만 확인한다.

8. **테스트는 기존 방식 그대로.** `apps/web`은 jest가 아니라 `tsc -p tsconfig.test.json` +
   `node --test dist-test/**`다. 새 테스트 파일은 **CSS Module을 import하지 않는 순수 모듈**로만
   쓴다(기존 한계 — `page.tsx`는 직접 테스트 불가). 메타데이터 조립 로직을 순수 함수로 뽑아
   그 함수를 테스트한다. `package.json`의 `test` 스크립트 glob에 새 디렉터리를 추가해야 하면 함께 갱신.

## §2. 완료 기준 (전부 pass/fail — 순서대로)

- [x] a. 웹 테스트: 메타데이터 조립 순수 함수(제목·설명·canonical 경로·빵부스러기 JSON-LD·
      JSON-LD 이스케이프·openGraph 조립) 단위 테스트 11건 추가 — **41건 통과**(기존 30 + 신규 11)
- [x] b. `pnpm -r lint` ✅ / `pnpm --filter @auction/web test` 41건 ✅ /
      `pnpm --filter @auction/web build` ✅ (`metadataBase` 경고 0건)
- [x] c. **Lighthouse SEO — 색인 허용 4페이지 전부 ≥90 (기준 통과)**, 로컬 프로덕션 빌드 대상:
      `/` **100**, `/items` **100**, `/items/browse` **100**, `/items/{id}` **91**.
      상세 91의 원인은 §5-1(Next 16 streaming metadata) — 내가 넣은 태그 누락이 아니다.
- [x] d. noindex 회귀: `/login`·`/items/map`·`/items/{id}/rights-analysis`·`/risks`·`/checklist`·
      **`/items/browse?sido=…`(임의 문자열 포함)** 전부 `<meta name="robots" content="noindex, follow">`
      확인. `/favorites`는 비로그인 시 307 → `/login`(noindex). 필터 없는 `/items/browse`는
      색인 허용 + canonical 유지
- [x] e. `/robots.txt` 200(`Disallow: /api/` 포함)·`/sitemap.xml` 200, URL 53건
      (정적 3 + 물건 50), **sitemap 내 noindex 경로 0건**
- [x] f. 비로그인 회귀: 색인 허용 5경로(지역 필터 포함) 전부 200 (T-04)
- [x] g. 적대적 리뷰 1회(새 컨텍스트, typescript-reviewer) 후 지적 **2건 전부 반영** — §6
- [x] h. 규칙 18 형식 완료 보고

## §6. 적대적 리뷰 반영 (2026-07-29)

리뷰어가 실행 중인 서버에 직접 요청을 날려 2건을 **실증**했고, 둘 다 고쳤다. 나머지 항목
(serializeJsonLd의 `<` 이스케이프 충분성, noindex 커버리지, 인증·관심 회귀 없음, 테스트가
망가진 코드를 통과시키지 않는지, 스코프 크립 없음)은 이상 없음으로 확인됐다.

1. **`/items/browse`의 지역 파라미터가 색인 가능한 스팸 벡터였다 (HIGH).**
   `?sido=<임의 문자열>`이 검증 없이 `<title>`·`description`·self-canonical에 반영되고 200으로
   응답했다 — 존재하지 않는 지역도 마찬가지. 외부에서 이 도메인 아래에 고유 제목을 가진 색인
   가능 URL을 무한히 만들 수 있었다. React가 HTML은 이스케이프해 XSS는 아니지만, 이 워크오더의
   목적(무엇을 색인시킬지 통제) 자체를 무너뜨린다.
   → **필터가 붙은 모든 변형을 noindex**, canonical 미부여. 베이스 `/items/browse`만 색인 허용
   (§1-3). 상세 페이지가 존재하지 않는 물건에 `NOINDEX`를 주는 기존 선례와 같은 처리다.

2. **JSON-LD 빵부스러기가 화면 빵부스러기와 불일치했다 (MEDIUM/HIGH).**
   마크업은 `경매 물건 목록 > {주소}`인데 화면은 `물건상세검색 > {물건종류}`였다 — 내가 넣은
   마크업이 만든 불일치이고, 코드 주석과 §1-5가 스스로 금지한 것이었다.
   → 화면 빵부스러기의 첫 조각을 `/items`로 가는 실제 링크(`경매 물건 목록`)로 바꾸고, JSON-LD를
   `경매 물건 목록 > {물건종류}`로 맞춰 **글자 단위로 일치**시켰다. 마지막 항목은 `item` URL을
   생략한다(schema.org 허용). 실서버 응답으로 양쪽 일치 확인.

리뷰어가 남긴 비차단 관찰 2건은 고치지 않았다: ① 없는 물건이 404가 아니라 200+noindex로
응답하는 것은 이 변경 이전부터의 Next 스트리밍 동작이다 ② `buildOpenGraph`·`buildBreadcrumbJsonLd`의
반환 타입 미명시 — 추론 타입이 정확해 타입 안전성 문제는 없다.

## §3. 이 레포의 알려진 함정

1. **PowerShell 5.1의 `Get-Content -Raw`는 BOM 없는 UTF-8을 CP949로 읽는다** — 정규식 치환 후
   되쓰면 한글이 전부 깨진다. 소스 텍스트 수정은 반드시 Edit/Write 도구로 할 것.
2. **`apps/web`의 CSS Module import 컴포넌트는 테스트 인프라 한계로 커버리지가 없다**(기존 갭).
   테스트 가능한 로직은 CSS를 import하지 않는 파일로 분리해야 한다.
3. **`next build`는 API 서버 없이도 통과해야 한다** — `sitemap.ts`가 이미 try/catch로 정적 경로만
   반환하도록 방어돼 있다. 이 방어를 깨지 말 것.
4. **Lighthouse는 `next dev`가 아니라 `next start`(프로덕션 빌드)로 측정한다** — dev 서버는
   번들이 최적화되지 않아 점수가 실제와 다르다.
5. 물건 상세 URL의 `{id}`는 `encodeItemId({courtOfficeCode, caseNo, itemNo})` 결과다 —
   임의 문자열로 접근하면 `decodeItemId`가 null을 반환해 404가 된다. 측정용 URL은
   `/sitemap.xml`에서 실제 값을 가져올 것.

## §4. 범위 제외 (근거)

- **색인 등록 확인** — 실도메인 + Search Console 필요 (사용자 확정, 2026-07-29). 2-7의 나머지
  절반이며 도메인 확보 후 후속 작업으로 남긴다.
- **배포** — 호스팅 결정 전.
- **홈·목록 화면의 콘텐츠 개편** — 로드맵 2-1/2-2 영역.
- **Lighthouse Performance/Accessibility/Best-practices** — 2-7의 기준은 SEO 카테고리다.
  측정 중 눈에 띄는 문제는 §5에 기록만 한다.
- **OG 이미지** — §1-6.


## §5. 구현 중 확인된 한계 (2026-07-29)

1. **물건 상세만 Lighthouse SEO 91 — Next 16의 streaming metadata 때문이다.** 실측으로 원인을
   좁혔으니 다시 조사하지 말 것:
   - 증상: 하이드레이션 후 렌더링된 DOM에서 `description`·`canonical`·`og:*`가 `<head>`가 아니라
     `<body>` 직계 자식으로 옮겨간다. Lighthouse의 `meta-description` 감사가 이걸 잡아 91이 된다.
   - **원인은 `generateMetadata`가 느린(캐시 없는) fetch를 await하는 것**. 배제 실험으로 확정:
     JSON-LD `<script>` 제거 → 재현, `FavoriteButton` 제거 → 재현, 루트 `<head>` 직접 렌더링
     제거 → 재현. **fetch만 제거하면 `<head>`에 정상 배치**. `/items/browse`는 같은
     `generateMetadata`지만 fetch를 안 해서 100점이다. 같은 물건을 두 번째로 열면(웜 캐시)
     `<head>`로 들어간다 — **지연 시간에 좌우된다**.
   - **초기 HTML은 봇에게 정상이다**: 일반 UA는 `</head>` 이후에 메타데이터가 오지만,
     Googlebot UA로 요청하면 Next가 블로킹 렌더링을 해 `<head>` 안에 넣어준다(바이트 오프셋으로
     확인). 다만 **JS 렌더링 후 DOM에서는 봇 UA로도 body로 밀린다**(Googlebot UA Lighthouse도 91).
   - 후보 대책(이번 범위 밖, 실도메인·배포 후 판단): ① `fetchAuctionItem`을 `no-store` 대신
     `next: { revalidate: N }`으로 바꿔 메타데이터가 셸 안에서 끝나게 하기(웜 캐시에서 실측으로
     해결됨을 확인, 단 콜드 요청은 여전히 밀림) ② `next.config`의 `htmlLimitedBots`(Next 16에
     정식 지원되는 RegExp 옵션) 조정. **①은 이번에 넣었다 되돌렸다** — 기준(≥90)이 이미
     충족되고 데이터 신선도를 바꾸는 변경이라 별도 판단 대상으로 남긴다.

2. **OG 이미지 없음** — 실도메인 확정 후 후속(§1-6).

3. **`/items/[id]` 하위 3화면(권리분석·위험·체크리스트)은 noindex로 묶여 있다.** 실데이터 연동
   시점에 `NOINDEX`를 떼야 한다 — 안 떼면 영영 색인되지 않는다.

4. **색인 등록 확인 미실시** — 실도메인·Search Console 필요(§4).
