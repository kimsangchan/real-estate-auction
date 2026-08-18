<!-- NEXT-ACTION:START -->
## ▶ 지금 할 일 (새 세션은 이 블록부터 — SessionStart 훅이 자동 주입)

- **[대기·결정]** **동일인이 두 명으로 갈려 인수액·임차인 수가 부풀려진다** (WP-11 §4-27, 실측 확인).
  `tenant_seq`를 성명으로 묶는데 출처마다 표기가 달라 같은 사람이 갈리고, 한쪽은
  `ASSUMED_AMOUNT_UNKNOWN`·다른 쪽은 `ASSUMED_FULL`이 되어 같은 보증금을 두 번 센다.
  실측: 유령 인원 1,040명 / 영향 명세서 **956건(임차인 있는 2,504건의 38%)**. 화면에
  "임차인 2명 / 1.6억 이상"으로 나오는데 실제로는 1명·1.6억이다.
  고치는 방향에 트레이드오프가 있어(과소 표시 위험) 사용자 결정이 필요하다.
  → `apps/api/src/auction-items/notice-tenant-merge.ts`, `auction-items.repository.ts`(tenantCount)
  같은 결정에 **행 뭉침**(§4-29)이 딸려 있다 — 현황조사 행이 앵커가 없어 이웃 임차인의 행을
  삼킨다(54행/54건). 정보출처를 앵커로 쓰면 행은 갈리지만 성명 병합셀이 아래 행에 떨어져 귀속이
  어긋난다. 행·사람 묶기 기준을 한 번에 정해야 한다. → `tools/collector/src/collector/notice_tenant_parser.py`
- **[진행중]** WP-11 룰 역채점 — H3(임차인 유무↔매각결과) 첫 비교가 판독 불가로 기록됨.
  판독 가능한 비교 설계를 다시 세운다. → `docs/work-orders/WP-11-rule-backtest.md`, 커밋 `f0aa377`
- **[확인필요]** 열람 창이 열렸는데 임차인 표가 안 잡힌 2건 — `B000213 2023타경111117/1,2`
  (기일 08-25, 창은 08-18 개시). 다음 daily 회차에 잡히는지 본다. 안 잡히면 재방문 조건 결함이다.
  구멍 실측·원인은 WP-11 §4-28. → `tools/collector/src/collector/runner.py`(needs_tenants)
- **[대기·사용자]** 실거래가 API 신청 — 승인되면 실부담 시나리오 기준을 감정가 → 시세로 전환.
  → `apps/api/src/rights-analysis/domain/total-burden.ts`
<!-- NEXT-ACTION:END -->

<!--
규칙:
- 이 마커 사이는 "지금/다음 할 일" 1~3건만. 짧게(화면 한 판).
- 완료된 항목은 여기 두지 말고 WORKLOG.md 의 ## History 로 옮긴다 (단일 출처·비대 방지).
- 훅(tools/hooks/print_next_action.py)은 이 마커 사이만 세션에 주입한다.
-->
