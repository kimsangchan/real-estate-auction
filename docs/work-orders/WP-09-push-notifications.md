# WP-09. 관심 물건 변동 푸시 알림 (로드맵 2-6 3/3)

- 상태: **진행 중 (2026-07-29)** — 구현·E2E 완료(§2-a~f 통과). 남은 것은 §2-g 적대적 리뷰뿐.
  구현 중 확인된 한계는 §5 참고.
- 시작 전 필독: `AGENTS.md`, 이 문서 전체, `WP-08b-mobile-auth-favorites.md`(§1 모바일 구조·§3 함정·§4 미결),
  `05-product-blueprint.md` F-06, `07-roadmap.md` 2-6

## 목적

관심 등록한 물건에 변동이 생기면 앱으로 푸시를 보낸다(F-06). 로드맵 2-6의 마지막 완료 기준인
**"알림 수신 E2E 1건"**을 실증해 2-6을 종결한다. 알림은 사용자가 직접 등록한 물건에 한정하며,
마케팅 푸시는 보내지 않는다 (T-07 — 예상 밖 노출 금지).

## §0. 사용자 액션 (착수 전 필요)

1. **Firebase 프로젝트 생성 + Android 앱 등록** — 패키지명 `com.realestateauction.mobile`.
   - `google-services.json` 다운로드 → `apps/mobile/android/app/`에 배치. **커밋 금지**(gitignore 추가).
2. **FCM 서비스 계정 키 발급** — Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > 새 비공개 키.
   JSON을 레포 밖에 두고 경로를 루트 `.env`의 `FCM_SERVICE_ACCOUNT_PATH`로 지정. **키 내용은 커밋 금지.**
3. iOS(APNs)는 이번 범위 제외 — Mac이 없다(WP-01b 조건부 조항과 동일).
4. 에뮬레이터 AVD `AuctionTest`는 `google_apis` 이미지라 FCM이 동작한다(Play Store 없어도 됨). 그대로 사용.

## §1. 확정된 설계 결정 (재논의 금지 — 근거 포함)

1. **변동 감지원은 `auction_schedule` 신규 행** — 수집기는 이미 `(bid_datetime, minimum_sale_price,
   failed_bid_count)` 조합마다 `ON CONFLICT DO NOTHING`으로 관측 이력을 쌓고 `observed_at`을 남긴다.
   **수집기는 변경하지 않는다.** 알림 잡이 "마지막 처리 시각 이후에 생긴 schedule 행"만 훑으면 된다.
2. **알림 종류 4종** (한 물건에 여러 변동이 겹치면 **알림 1건으로 합친다** — T-07 과다 발송 금지):
   - 기일 변경 — 직전 관측 대비 `bid_datetime`이 다름
   - 유찰 — `failed_bid_count` 증가
   - 최저가 변동 — `minimum_sale_price` 변경
   - 기일 임박 리마인더 — 매각기일 **D-3, D-1** (사용자 확정, 2026-07-29)
3. **실행 방식은 cron이 부르는 CLI 엔트리** (`apps/api`에 `NestFactory.createApplicationContext`
   기반 실행 파일 추가, 수집기와 같은 cron 패턴 — C-04 "경량 스케줄러").
   **API 프로세스에 `@nestjs/schedule`을 붙이지 않는다** — 인스턴스를 2대로 늘리는 순간 중복 발송이
   되고, WP-08b §4에 이미 단일 인스턴스 전제가 하나 쌓여 있어 더 늘리지 않는다.
4. **발송 대상은 `favorite` 등록자의 기기 토큰뿐.** 마케팅·추천 푸시 없음 (T-07).
5. **중복 발송 방지**: `notification_delivery(user_id, dedupe_key)` UNIQUE.
   - 변동: `dedupe_key = 'schedule:<auction_schedule.id>'`
   - 리마인더: `dedupe_key = 'remind:<auction_item_id>:<기일 날짜>:<D-3|D-1>'`
   잡이 재시작되거나 중복 실행돼도 같은 알림이 두 번 나가지 않는다 (규칙 10).
6. **기기 토큰 테이블 `device_token`** — `user_id`(FK CASCADE), `token` UNIQUE, `platform`,
   `created_at`, `last_seen_at`. 앱이 로그인 직후 등록·갱신하고, 로그아웃·회원 탈퇴 시 삭제한다.
   FCM이 `UNREGISTERED`/`INVALID_ARGUMENT`를 돌려주면 그 토큰 행을 지운다(죽은 토큰 누적 방지).
7. **조용한 시간 21:00~08:00(KST)** — 이 구간에 걸리는 알림은 다음 08:00으로 미룬다.
   정보성 알림이라 정보통신망법상 야간 수신동의 대상은 아니지만, T-07·UX 기준으로 지킨다.
   리마인더 D-1은 기일 전날 09:00에 보낸다.
8. **알림 문구는 사실 서술만** (D-011 — 변호사법 §109). 판단·권유·추천 표현 금지.
   - 좋음: `매각기일이 2026-08-01 10:00으로 바뀌었어요`
   - 좋음: `2회 유찰돼 최저가가 5억 7,600만원이 됐어요`
   - 금지: `지금이 기회예요`, `안전한 물건이에요`, `입찰 추천`
9. **모바일**: `@react-native-firebase/app` + `@react-native-firebase/messaging` 신규 의존성.
   - Android 13+는 `POST_NOTIFICATIONS` **런타임 권한**이 필요하다 — 없으면 알림이 조용히 안 뜬다.
     권한 요청은 로그인 직후(관심 등록 맥락)에 한 번, 거부해도 앱 기능은 그대로 쓸 수 있어야 한다(T-04).
   - 알림을 탭하면 해당 물건 상세로 이동한다. 기존 `RootStackParamList`의 `ItemDetail`을 그대로 쓰고
     새 화면을 만들지 않는다 (WP-08b §1-6과 같은 원칙).
   - 토큰 등록은 기존 `authSession.ts`의 `authedFetch`로 나간다 — 새 fetch 헬퍼 금지.
10. **서버 API 2개만 추가** (기존 auth 모듈 옆에 `notifications` 모듈 신설):
    - `PUT /notifications/device` (JWT guard) — 토큰 등록·갱신
    - `DELETE /notifications/device` (JWT guard) — 토큰 삭제(로그아웃)
    회원 탈퇴는 `device_token`의 FK CASCADE로 함께 지워진다.

## §2. 완료 기준 (전부 pass/fail — 순서대로)

- [x] a. API 테스트: 변동 감지가 "마지막 처리 시각 이후 신규 schedule 행"만 잡는지, 같은 변동을
      두 번 실행해도 발송 0건인지(멱등), 관심 등록자가 없는 물건은 발송 0건인지, 조용한 시간 지연,
      D-3·D-1 경계값, 죽은 토큰 삭제 — 315건 통과
- [x] b. 모바일 테스트: 토큰 등록/삭제 호출, 권한 거부 시에도 화면이 정상 동작, 알림 페이로드 파싱 →
      상세 라우팅 파라미터 — 68건 통과
- [x] c. `pnpm -r lint && pnpm -r test && pnpm -r build` + Gradle `assembleDebug` 통과
- [x] d. **알림 수신 E2E 1건 (로드맵 2-6 완료 기준) — 통과 (2026-07-29)**: 에뮬레이터에서 세션 복구 →
      알림 권한 허용 → 기기 토큰 등록(DB 1건) → 물건 관심 등록 → 변동 주입 → `notify` 실행 →
      **기기 알림 트레이에 수신** → 탭 → 해당 물건 상세로 이동까지 스크린샷 확인.
      수신 문구: "4회 유찰돼 최저가가 4억 6,131만원이 됐어요. 매각기일이 2026년 7월 29일 오전
      10:00로 바뀌었어요." (유찰+기일 변동이 알림 1건으로 합쳐짐 — T-07)
- [x] e. 비대상 회귀: 재실행 시 `changesFound 0`으로 중복 발송 없음, `notification_delivery`에
      dedupe 키 2건만 적재. 관심 등록자 없는 물건은 감지 쿼리 단계에서 제외(단위 테스트)
- [x] f. 문구 검사: 금지어 전수 검사 테스트 + 실제 수신 문구 확인 — 판단·권유 표현 0건 (D-011)
- [x] g. 적대적 리뷰 2회(보안·정합성, 각각 새 컨텍스트) 후 지적 반영 — 아래 실수확 반영, 자세한 내용은 §6
- [ ] h. 규칙 18 형식 완료 보고. §0 미이행으로 막히면 "사용자 액션 대기" 명시 보고

## §3. 이 레포의 알려진 함정

1. **네이티브 의존성 추가 → Gradle 재빌드 필수.** 이 머신 시스템 기본 `JAVA_HOME`이 JDK 1.6이라
   `JAVA_HOME=C:\Program Files\Java\jdk-21.0.10`을 명시해야 wrapper가 산다 (WP-06·WP-08b에서 반복 확인).
2. **pnpm + Metro**: 새 JS 패키지를 추가한 뒤 Metro가 못 찾으면 `--reset-cache`로는 부족하다 —
   `%TEMP%`의 `metro-*`·`haste-map-*` 디렉터리를 직접 지우고 재기동해야 크롤이 새 패키지를 인식한다.
3. **react-native-firebase는 `google-services` Gradle 플러그인을 요구한다** — `android/build.gradle`
   classpath와 `android/app/build.gradle` apply 둘 다 필요하고, `google-services.json`이 없으면
   빌드가 실패한다. §0-1을 먼저 끝낼 것.
4. **`bid_datetime`은 TIMESTAMPTZ이고 DB 세션 타임존은 UTC다.** D-3/D-1 계산을 UTC로 하면 하루가
   밀린다 — KST 기준으로 계산할 것. WP-02에서 실제로 9시간 밀림 버그가 났던 자리다.
5. **Android 13+ `POST_NOTIFICATIONS`** 권한이 없으면 FCM 메시지는 도착해도 알림이 **조용히** 안 뜬다.
   E2E에서 "안 온다"고 판단하기 전에 권한부터 확인할 것.
6. 전역 `ValidationPipe({ whitelist, forbidNonWhitelisted })` — 토큰 등록 body를 DTO에 명시해야 한다
   (WP-08 §3-4, WP-08b §3-3과 같은 함정).
7. **에뮬레이터 검증은 `-gpu host`** — `swiftshader_indirect`는 지도 타일에서 죽는다. AVD가
   `hw.keyboard=no`로 만들어져 있으면 호스트 키보드가 안 먹으니 `config.ini`를 확인할 것(WP-08b에서 `yes`로 변경함).
8. pre-push 훅이 모노레포 전체 lint/test/build를 돌린다 — 커밋 전 `pnpm -r build`로 미리 확인.

## §5. 구현 중 확인된 한계 (2026-07-29)

1. **앱이 포그라운드일 때는 알림이 표시되지 않는다.** Android에서 FCM `notification` 페이로드는
   앱이 떠 있으면 시스템 트레이에 뜨지 않고 `onMessage`로만 전달된다(백그라운드에서는 정상 표시 —
   E2E로 확인). 화면 안에서 알려주려면 `onMessage` 핸들러 + 인앱 표시(스낵바/notifee)가 따로 필요하다.
   이번 범위 밖으로 두되, 사용자가 앱을 켠 채 기다리는 상황이 흔하면 후속으로 붙일 것.
2. **`requestPermission()`은 Android에서 no-op**이다(RNFirebase 타입 주석에 명시). Android 13+
   알림 권한은 반드시 `PermissionsAndroid.request(POST_NOTIFICATIONS)`로 받아야 하며, 이걸 빼면
   FCM은 도착하는데 알림만 조용히 안 뜬다 — §3-5 함정의 실제 형태다.
3. `google-services.json`을 추가하면 Gradle 전체 재빌드가 필요하다(이번 소요 17분 52초).

## §6. 적대적 리뷰 반영 (2026-07-29)

두 리뷰가 독립적으로 같은 결함을 지목했고, 단위 테스트가 구조적으로 통과시키던 것들이다.

**인가**
- `DELETE /notifications/device`에 소유자 확인이 없어 아무나 남의 기기 토큰을 지울 수 있었다 →
  `req.user.id`로 스코프.
- `PUT`이 토큰 충돌 시 소유자를 재할당해, 남의 토큰으로 등록하면 그 기기에 임의 물건의 주소·가격을
  밀어넣을 수 있었다(T-07 위반) → 다른 계정 소유 토큰이면 무시. 기기 인계는 로그아웃 DELETE로 처리.
- 계정당 기기 수 상한(10)을 둬 무제한 등록으로 발송 루프를 늘리는 것을 막았다.

**발송 유실 (설계 결함)**
- 실패해도 커서가 무조건 전진해 그 구간 변동이 **영구 유실**됐다("다음 실행에서 재시도"는 성립하지
  않았다) → 실패가 있으면 커서를 올리지 않는다.
- `observed_at`의 `now()`는 트랜잭션 **시작** 시각이고 수집기는 배치를 한 트랜잭션으로 묶는다.
  앱 시계로 구간을 자르면 커밋이 늦은 배치가 통째로 누락된다 → DB 시계 기준 **워터마크(now-5분)**로
  구간을 잡는다. 수집기 한 배치가 5분을 넘기면 이 값을 늘려야 한다.
- FCM 400 INVALID_ARGUMENT를 죽은 토큰으로 판정해, 페이로드가 큰 물건 하나가 그 물건을 등록한
  **전원의 토큰을 삭제**할 수 있었다 → 404만 토큰 삭제 근거로 삼고 제목·본문 길이를 자른다.
- 전송 중 예외가 나면 선점한 멱등 기록이 남아 그 알림이 영구 미발송됐다 → `finally`로 반드시 되돌린다.
- 액세스 토큰 발급 실패 시 기기마다 재시도해 Google 토큰 엔드포인트를 두들겼다 → 실행 전체를 중단한다.

**T-07 (과다 발송)**
- 한 물건에 관측이 여러 건이면 그만큼 알림이 나갔다 → 물건 단위로 접어 1건으로 보낸다.
- 멱등 기록이 기기 단위라 다중 기기 사용자는 한 대에서만 받았다 → 사용자 단위 선점 + 전 기기 발송.
- 리마인더 dedupe 키가 UTC 날짜라 KST D-n 판정과 어긋나 중복·누락이 가능했다 → KST 날짜로 통일.

**그 외**: `LATERAL` 직전 관측의 `observed_at` 동률을 id로 해소, "직전 행 없음"과 "직전 행의 값이 전부
NULL"을 구분, 조회 상한(500), fetch 타임아웃, 발송 실패 시 종료 코드 1, 서비스 계정 경로가 로그로
새지 않게, `.gitignore`에 실제 adminsdk 파일명 패턴 추가, 모바일은 권한 재요청 방지·토큰 갱신 구독·
등록 실패 시 캐시 오염 방지·로그아웃이 네트워크에 매달리지 않게 예산 부여.

**통합 테스트 추가 (2026-07-29)** — 리뷰가 가장 크게 지적한 공백이라 메웠다.
- `notifications.repository.integration.spec.ts` — **실 Postgres**로 감지 창·직전 관측 LATERAL·
  관측 시각 동률·hasPrevious 구분·limit·소유자 재할당 금지·본인 토큰만 해제·기기 수 상한·
  관심 등록자 기기만 조회·claim UNIQUE·리마인더 창을 검증한다 (16건).
  실행: `API_RUN_DB_TESTS=1 DATABASE_URL=... pnpm --filter @auction/api test`
  (수집기와 같은 opt-in 방식이라 플래그 없이는 skip된다. TRUNCATE하지 않고 고유 키 픽스처만
  만들었다 지우므로 실데이터를 건드리지 않는다.)
- `fcm.client.spec.ts` — 404/400 판정(대량 토큰 삭제 회귀), 네트워크 실패 처리, 토큰 캐시,
  `expires_in` 누락 시 캐시 무력화 방지, 문구 절단 (9건).
- **이때 실버그를 하나 잡았다**: `deleteOwnDeviceToken`의 바인딩 파라미터 순서가 뒤바뀌어 있어
  토큰 해제가 아무 것도 지우지 못했다. 목 테스트로는 잡히지 않는 종류다.

**남은 지적(미반영, 후속 판단 필요)**
- `usePushNavigation`에 테스트가 없고, App Links 도입 시 네비게이터 준비 전 탭이 유실될 수 있다.
- 수집기의 `ON CONFLICT DO NOTHING` 특성상 **이전 상태로 되돌아가는 변경은 감지되지 않는다**.
- `auction_schedule.observed_at` 인덱스 없음, `notification_delivery` 보존 정책 없음.
- 미인증 엔드포인트 rate limiting 부재(WP-08b §4와 동일 항목).

## 범위 제외

- **취하·매각종료 감지**(사용자 확정, 2026-07-29 — 후속 WP로 이연). 지금 구조는 법원·페이지 단위
  부분 수집이라 "물건이 사라짐"과 "이번엔 안 훑음"을 구분할 수 없다. 제대로 하려면 수집기에 상태
  컬럼과 미관측 추적을 넣어야 해서 WP가 크게 불어난다 — F-06의 취하 알림은 그때 함께 구현한다.
- iOS/APNs(Mac 없음), 마케팅·추천 푸시(T-07), 이메일·SMS, 웹 푸시, 알림 설정 화면(종류별 on/off),
  WP-08b §4의 미결 사항(App Links·릴리스 주소·rate limiting 등 — 별도 처리).
