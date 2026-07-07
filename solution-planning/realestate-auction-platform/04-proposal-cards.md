# Proposal Cards — 결정 지점별 선택지

작성일 2026-07-07. evidence 확인일은 별도 표기 없으면 2026-07-07. fit_reason 괄호는 evidence-map의 5요소(요구충족/팀적합/운영환경/생태계/비용) 표기.

---

## C-01. 스코프 (5대 질문 ①)

```yaml
decision: "첫 출시 범위"
context: "1~3인 초기 팀 가정, 경매+권리분석이 필수 요구, 일반 매물은 중개사 영업 필요 (01 §1-1)"
candidates:
  - name: S1 경매 특화 MVP
    evidence: "3사 모두 경매 공백 (네이버 2023-10 종료, https://news.mt.co.kr/mtview.php?no=2023103108324611652) / 경매는 허위매물 구조적 불가"
    fit_score: 높음
    fit_reason: "영업 없이 공공데이터만으로 완성 가능 (요구충족+비용). 차별화 핵심(권리분석)에 집중"
    tradeoff: "일반 매물 탐색자는 초기 타깃에서 제외 — '3사 장점 종합'은 Standard로 이연"
  - name: S2 통합 동시 출시
    evidence: "리치고가 매물+경매 통합 선행 (https://www.hankyung.com/article/202504038891O)"
    fit_score: 낮음
    fit_reason: "매물 확보는 중개사 제휴 영업 문제 — 초기 팀 규모로 병행 불가 (팀적합성)"
    tradeoff: "출시 12개월+, 두 전선 동시 경쟁 (네이버·다방 vs 리치고)"
  - name: S1' 데이터 분석 중심 (경매 + 실거래 분석, 권리분석 최소화)
    evidence: "호갱노노·아실 무료 데이터 시각화 성공 사례 (01 §4-3)"
    fit_score: 중간
    fit_reason: "가장 빠른 출시. 단 사용자 필수 요구(권리분석)가 빠져 차별화 약함"
    tradeoff: "아실·호갱노노와 정면 경쟁, 경매 차별화 상실"
recommendation: S1 경매 특화 MVP
reason: "필수 요구(경매+권리분석)를 최소 비용으로 검증. 기회 영역 분석(01 §4-4)과 직결"
question_if_needed: "질문 2로 상정"
```

## C-02. 타깃 포지셔닝 (5대 질문 ②)

```yaml
decision: "1차 타깃 사용자"
context: "타깃에 따라 UX 난이도 설계·기능 우선순위·수익화 시점이 갈림 (01 §2)"
candidates:
  - name: 경매 입문 일반인 (실수요·소액)
    evidence: "기존 경매 서비스는 연 65만~93만원 전문가 지향 (https://www.auction1.co.kr/help/pay_guide.php) — 입문자용 쉬운 서비스 공백"
    fit_score: 높음
    fit_reason: "토스 UX 원칙(용어 풀어쓰기)과 시너지 최대 (요구충족). 사용자 본인이 도메인 무지 → 자기 검증 가능"
    tradeoff: "입문자는 실제 입찰 전환율 낮음 — 수익화 먼 길"
  - name: 부동산 투자자
    evidence: "유료 지불 의사 검증된 시장 (옥션원 연 92.6만원)"
    fit_score: 중간
    fit_reason: "수익화 빠르나 지지옥션·탱크옥션과 데이터 깊이 정면 승부 (생태계 불리)"
    tradeoff: "신생 서비스가 40년 DB(지지옥션) 상대로 신뢰 열세"
  - name: 일반 매물 탐색자
    evidence: "3사 지배 시장 (01 §4-1)"
    fit_score: 낮음
    fit_reason: "매물량 없이는 경쟁 불가 (요구충족 미달)"
    tradeoff: "C-01에서 S2 선택 시에만 유효"
recommendation: 경매 입문 일반인
reason: "차별화 축(쉬운 UX)과 기회 영역(용어 장벽)이 일치. 투자자 기능은 Standard에서 추가"
question_if_needed: "질문 1로 상정"
```

## C-03. 모바일 클라이언트 (5대 질문 ③·④ 연동)

```yaml
decision: "모바일 앱 프레임워크"
context: "지도 중심 앱, 네이버/카카오 SDK는 Flutter·RN 공식 플러그인 없음 → 어느 쪽이든 네이티브 래핑 필요"
candidates:
  - name: React Native 0.86
    evidence: "GitHub ★126,161 MIT, 0.86.0 (2026-06-11, https://github.com/facebook/react-native/releases). 토스 정식 채택 (https://toss.tech/article/react-native-2024), 직방 실사용 (https://www.codenary.co.kr/company/detail/80)"
    fit_score: 높음
    fit_reason: "웹(Next.js)·서버(NestJS)와 TypeScript 단일 언어 → 1~3인 팀 생산성 (팀적합). 국내 프롭테크·핀테크 선례 (생태계)"
    tradeoff: "네이티브 브리지 관리 부담, 지도 SDK 직접 래핑 1~2주"
  - name: Flutter 3.44
    evidence: "GitHub ★177,652 BSD-3, 3.44 (2026-05, https://docs.flutter.dev/install/archive)"
    fit_score: 중간
    fit_reason: "렌더링 일관성은 지도 오버레이 UI에 유리 (요구충족). 단 웹·서버와 언어 분리(Dart/TS)로 1인 개발 부담 증가"
    tradeoff: "커뮤니티 지도 래퍼 품질 편차, 국내 채용 풀 RN 대비 열세 (Indeed 50+ vs 25+건)"
recommendation: React Native
reason: "1~3인 팀 + 웹 병행(A-09) 전제에서 언어 통일 가중치. 사용자 팀 역량 답변에 따라 재평가"
question_if_needed: "질문 3·4로 상정"
```

## C-04. 백엔드 프레임워크

```yaml
decision: "API 서버 프레임워크"
candidates:
  - name: NestJS 11
    evidence: "★76,041 MIT, v11.1.27 (2026-06-15, https://github.com/nestjs/nest/releases). 직방 실사용 조합 RN+NestJS+NextJS (https://www.codenary.co.kr/company/detail/80)"
    fit_score: 높음
    fit_reason: "클라이언트와 TS 단일 언어 (팀적합). 프롭테크 검증 조합 (생태계)"
    tradeoff: "Java 대비 시니어 인력 풀 좁음, CPU 바운드 작업 취약 (룰 엔진은 IO 바운드라 무관)"
  - name: Spring Boot 4.x
    evidence: "★81,068 Apache-2.0, 4.1.0 (2026-06-10, https://spring.io/blog/2025/11/20/spring-boot-4-0-0-available-now/)"
    fit_score: 중간
    fit_reason: "국내 인력 풀 최대, 금융 제휴 확장 시 신뢰 (생태계). 단 1~3인 초기 속도 열세"
    tradeoff: "언어 3개(TS/Java/Python) 운영 부담"
  - name: FastAPI 0.139
    evidence: "★100,132 MIT, 0.139.0 (2026-07-01, https://github.com/fastapi/fastapi/releases)"
    fit_score: 중간
    fit_reason: "수집 파이프라인(Python)과 통일 가능 (비용). 단 1.0 미만 버저닝, 국내 채용 풀 좁음"
    tradeoff: "대규모 계층 구조 자체 설계 필요"
recommendation: NestJS
reason: "C-03 RN 채택 시 TS 올인원 완성. 사용자가 Java·C# 경험자면 Spring Boot로 교체 (질문 3 답변 연동)"
question_if_needed: null
```

## C-05. 데이터 저장소 / 지리 검색

```yaml
decision: "주 저장소 + 지도 검색"
context: "지도 bbox + 다중 필터 조합 쿼리, 초기 물건 수 십만 건 이하, MAU 1만 이하 (A-10)"
candidates:
  - name: PostgreSQL 18 + PostGIS 3.6
    evidence: "PG 18.4 (2026-05-14, https://www.postgresql.org/about/news/postgresql-184-1710-1614-1518-and-1423-released-3297/), PostGIS 3.6.2 (https://postgis.net/news/)"
    fit_score: 높음
    fit_reason: "bbox(GiST)+필터를 단일 SQL로 — 본 서비스 쿼리 패턴에 정확히 부합 (요구충족). 운영 대상 DB 1개 (비용)"
    tradeoff: "한글 전문검색·수천만 건 고QPS는 별도 확장 필요"
  - name: PostGIS + OpenSearch 3.5 병행
    evidence: "OpenSearch ★13,318 Apache-2.0, 3.5 AWS 관리형 (https://opensearch.org/blog/opensearch-3-5-is-live/)"
    fit_score: 중간
    fit_reason: "전문검색·집계 강력하나 초기엔 과잉 스펙 (비용 초과)"
    tradeoff: "클러스터 운영 부담 — 1~3인 팀에 과함"
recommendation: PostgreSQL + PostGIS 단독, 검색 수요 증가 시 OpenSearch 추가 (2단계 전략)
reason: "초기 규모(A-10) 대비 최소 운영 비용"
question_if_needed: null
```

## C-06. 지도 SDK

```yaml
decision: "지도 공급자"
candidates:
  - name: 네이버 NCP Maps (메인)
    evidence: "Mobile Dynamic Map 월 1억 건 무료, 지적편집도 레이어·클러스터링 SDK 내장 (https://www.ncloud-forums.com/topic/99/, https://navermaps.github.io/android-map-sdk/guide-ko/2-3.html)"
    fit_score: 높음
    fit_reason: "모바일 무료 한도 압도적 + 부동산 필수 기능(지적편집도) 공식 지원 (요구충족+비용)"
    tradeoff: "유료화 정책 변경 이력 2회 (2023-01, 2025) → 어댑터 레이어 필수 (A-05)"
  - name: 카카오맵 (보조 - 로컬 API)
    evidence: "전체 월 300만 무료, 2026-07-21 운영 방식 변경 예고 (https://developers.kakao.com/docs/latest/ko/getting-started/quota, https://devtalk.kakao.com/t/api-notice-on-new-kakao-map-api-features-and-free-quota-policy/150222)"
    fit_score: 중간
    fit_reason: "주소·좌표 변환 단가 저렴. 단 정책 변경 직전이라 재확인 필요"
    tradeoff: "메인 지도로는 무료 한도가 네이버 대비 작음"
  - name: 구글맵
    evidence: "2025-03 요금 개편, 무료량 월 1만 건 수준, 지적편집도 없음 (https://developers.google.com/maps/billing-and-pricing/march-2025)"
    fit_score: 낮음
    fit_reason: "한국 기능 제약 + 무료량 극소 (요구충족·비용 모두 미달)"
    tradeoff: "한국 부동산 메인 지도로 부적합"
recommendation: 네이버 NCP Maps 메인 + 카카오 로컬 API 병행, 지도 어댑터 레이어 내장
reason: "비용 최적 + 정책 변경 리스크는 어댑터로 흡수"
question_if_needed: null
```

## C-07. 경매 데이터 조달

```yaml
decision: "법원경매 데이터 수집 경로"
context: "공식 오픈 API 없음 (01 §5). 데이터 조달이 이 사업의 원가·리스크 핵심"
candidates:
  - name: 자체 수집 (courtauction.go.kr) + CODEF 백업
    evidence: "기존 업계 표준 구조. 오픈소스 수집기 존재 (https://github.com/guriguri/cauca). 대법원 판례 2021도1533: 공개 서버+차단조치 없으면 형사 무죄, 단 약관 원문 미확인"
    fit_score: 높음
    fit_reason: "변동비 0 (비용). 단 약관 확인 + 서버 부하 예절 준수 전제"
    tradeoff: "사이트 개편 시 유지보수 부담, 법적 그레이존은 착수 전 약관 확인으로 해소 필요"
  - name: CODEF 중계 API 전면 사용
    evidence: "경매사건검색 상품 존재 (https://developer.codef.io/products/public/each/ck/auction-events), 단가 미확인(견적)"
    fit_score: 중간
    fit_reason: "유지보수 외주화 (팀적합). 단가 미확인이라 원가 리스크"
    tradeoff: "물건 수 × 조회 빈도에 비례하는 변동비"
recommendation: 자체 수집 기본 + CODEF 견적 확보 후 백업 계약
reason: "원가 구조상 자체 수집 우위. 착수 전 필수 선행: 약관·robots 원문 확인 (01 §6)"
question_if_needed: null
```

## C-08. 등기부등본 조달

```yaml
decision: "등기부 데이터 확보 (권리분석 원료)"
candidates:
  - name: 하이픈(Hyphen) API
    evidence: "부동산등기 API 8종, TR슬림 월 10만원+건당, 등기소 실비 700원/건 별도 (https://hyphen.im/product/view?seq=145)"
    fit_score: 높음
    fit_reason: "요금 공개·예측 가능 (비용). 구조화 응답 제공"
    tradeoff: "물건당 700원 실비는 전 물건 일괄 분석 시 부담 → 사용자 조회 시점 발급(on-demand) 설계 필요"
  - name: CODEF API
    evidence: "등기부 API 존재, 무료 데모 3개월 (https://developer.codef.io/products/public/each/ck/real-estate-register), 단가 비공개"
    fit_score: 중간
    fit_reason: "데모로 PoC 가능. 단가 미확인"
    tradeoff: "견적 협상 필요"
recommendation: PoC는 CODEF 무료 데모, 운영은 양사 견적 비교 후 결정. 등기부는 on-demand 발급 + 캐시(사건 단위)로 원가 통제
reason: "MVP 원가에서 등기부 실비가 최대 변동비 — 발급 시점 설계가 요금제보다 중요"
question_if_needed: null
```

## C-09. 인프라

```yaml
decision: "클라우드"
candidates:
  - name: NCP (네이버클라우드)
    evidence: "그린하우스 스타트업 크레딧 최대 1억원·2년 (https://www.ncloud.com/support/greenHouse)"
    fit_score: 높음
    fit_reason: "크레딧 절대액 최대 + 지도 API와 과금·계정 통합 (비용+운영환경)"
    tradeoff: "관리형 서비스 폭 AWS 대비 좁음"
  - name: AWS 서울
    evidence: "Activate 크레딧 최대 $100K, VC 연계 조건 (https://aws.amazon.com/startups/credits/)"
    fit_score: 중간
    fit_reason: "생태계 최대. 크레딧은 투자 유치 전제"
    tradeoff: "환율 노출, 크레딧 조건 까다로움"
recommendation: NCP 그린하우스 신청, 탈락 시 AWS
reason: "무투자 초기 팀 기준 크레딧 접근성"
question_if_needed: null
```

## C-10. 본인인증·로그인

```yaml
decision: "인증 구성"
candidates:
  - name: 소셜 3종(카카오·네이버·애플) + 포트원 통합 본인인증(필요 시점만)
    evidence: "카카오 OIDC 공식 지원 (https://devtalk.kakao.com/t/openid-connect-notice-support-of-openid-connect/121888), Apple 지침 4.8 (https://developer.apple.com/app-store/review/guidelines/), 포트원 경유 건당 ~40원 (https://blog.portone.io/authorization-payment-2/)"
    fit_score: 높음
    fit_reason: "MVP는 본인인증 없이 소셜만으로 충분 (알림·관심물건). 본인인증은 유료화/전문가 연결 시점에 도입 (비용)"
    tradeoff: "없음 — 업계 표준 경로"
recommendation: 위 구성 + RFC 8725 준거 JWT (액세스 15분 + 리프레시 회전)
reason: "주민번호 미수집 원칙(A-08)과 정합"
question_if_needed: null
```

## C-11. 권리분석 제공 수위 (법적 경계 설계)

```yaml
decision: "자동 권리분석의 출력 형태"
context: "변호사법 §109 — 개별 사건 법률 판단·자문 형태 출력은 형사 리스크 (01 §3-1)"
candidates:
  - name: 룰 기반 정보 정리 + 경고 플래그 (판단 문구 금지)
    evidence: "로폼 판례: 정형 규칙 기반은 법률사무 아님 (https://www.lawtimes.co.kr/news/articleView.html?idxno=218044). 두인 면책 구조 (https://www.dooinauction.com/help/service_guide.php)"
    fit_score: 높음
    fit_reason: "업계 검증 구조 + 판례 정합 (운영환경). '인수 가능성 있는 권리 N건' 표시까지만, '입찰 추천' 문구 금지"
    tradeoff: "사용자가 원하는 '결론'을 직접 말해주지 못함 → UX 라이팅으로 보완 (임장 체크리스트, 전문가 연결)"
  - name: 생성형 AI 자연어 분석 리포트
    evidence: "리치고 GPT 분석 선행 (https://www.hankyung.com/article/202504038891O). 단 해설상 개별 사건 검토형 생성 AI는 변호사법 위반 소지 명시"
    fit_score: 낮음
    fit_reason: "차별화 크지만 형사 리스크 + AI 기본법 고지 의무 — MVP에서 배제, 변호사 검토 후 Enterprise 재검토"
    tradeoff: "리치고 대비 화려함 열세 — 대신 '법적으로 안전한 설계'가 방어막"
recommendation: 룰 기반 + 경고 플래그 (1안). 출력 문구 세트는 출시 전 변호사 검토 1회 필수
reason: "형사 리스크(7년 이하 징역)는 스타트업이 감수할 수 없는 수준"
question_if_needed: null
```

---

## UX 기준 변환 (quality-decomposition)

```yaml
qualitative_input: "이들(3사)보다 직관적으로 사용할 수 있는, toss ui/ux 원칙을 최대한 적용"
reference_source: "토스 컨슈머 UX 가이드 (https://developers-apps-in-toss.toss.im/design/consumer-ux-guide.html, 확인일 2026-07-06) + UX 심리학 10법칙 (references/ux-principles-kr.md)"
decomposed_criteria:
  - id: UX-01
    criterion: "화면당 사용자 결정 지점 수 (근거 L-03 힉의 법칙)"
    target: "핵심 플로우(탐색→상세→권리분석) 각 화면당 결정 지점 1개"
    measure_method: "화면 플로우 다이어그램에서 결정 지점 카운트"
  - id: UX-02
    criterion: "사용자 수기 계산 항목 수 (근거 L-07 테슬러의 법칙)"
    target: "0개 — 총 인수금액(낙찰가+인수보증금+미납관리비 추정)을 시스템이 자동 합산 제시"
    measure_method: "권리분석 결과 화면에서 사용자가 계산기 없이 답할 수 없는 질문 목록 점검"
  - id: UX-03
    criterion: "전문용어 쉬운 설명 병기율 (근거 T-13 명사 단순화)"
    target: "사용자 대면 화면의 도메인 용어 100% 툴팁/풀어쓰기 병기 (예: '말소기준권리 → 이 날짜 이후 권리는 낙찰로 사라져요')"
    measure_method: "용어 사전 대비 화면 문구 전수 검사 (출시 전 체크리스트)"
  - id: UX-04
    criterion: "지도 조작 피드백 지연 (근거 L-10 도허티 임계)"
    target: "지도 이동 후 물건 갱신 시각 피드백 ≤ 400ms (초과 시 스켈레톤)"
    measure_method: "실기기 프로파일링 (mid-tier Android 기준)"
  - id: UX-05
    criterion: "무설명 첫 사용 완료율"
    target: "온보딩 없이 신규 사용자의 '물건 검색 → 권리분석 결과 이해' 태스크 완료 80% 이상"
    measure_method: "프로토타입 사용성 테스트 5인 (도메인 무지 사용자)"
  - id: UX-06
    criterion: "막다른 경고 0 (근거 L-06 피크엔드, T-11 긍정형)"
    target: "위험 물건 경고 시 다음 행동(임장 체크리스트·전문가 연결) 제시율 100%"
    measure_method: "경고 상태 전수 점검"
  - id: UX-07
    criterion: "탐색→권리분석 도달 탭 수 (근거 T-04~08 다크패턴 방지)"
    target: "지도에서 물건 권리분석 요약까지 3탭 이하 (기존 경매 사이트 대비 50% 이하)"
    measure_method: "경쟁 서비스(옥션원·두인) 동일 태스크 탭 수 실측 비교"
  - id: UX-08
    criterion: "디자인 토큰 하드코딩 0 (근거 D-014, AGENTS.md 규칙 13)"
    target: "프론트 시각 값은 DESIGN-meta.md + docs/design/design-adaptation.md 기반 토큰에서만 참조"
    measure_method: "웹/RN 프론트 코드 전수 검색 + lint 규칙"
```
