<!-- NEXT-ACTION:START -->
## ▶ 지금 할 일 (새 세션은 이 블록부터 — SessionStart 훅이 자동 주입)

- **[대기·결정]** 종기 초과 경로의 `ASSUMED_FULL` 확정에 승계(주택임대차보호법 §3-2⑦) 오판이
  섞여 같은 보증금을 두 번 세는 후보가 있다. 확정을 철회하면 안전해지지만 "전액 인수 확정"
  표기가 사실상 사라질 수 있다 — 판정 의미가 바뀌는 변경이라 사용자 결정이 필요하다.
  → `apps/api/src/rights-analysis/domain/notice-assumption.ts`, WP-11 §4-26
  (배당요구 공란→false 는 검증 결과 **채택하지 않음**. 파서 버그 수정과 원문 보관은 완료 `8987987`)
- **[진행중]** WP-11 룰 역채점 — H3(임차인 유무↔매각결과) 첫 비교가 판독 불가로 기록됨.
  판독 가능한 비교 설계를 다시 세운다. → `docs/work-orders/WP-11-rule-backtest.md`, 커밋 `f0aa377`
- **[대기·사용자]** 실거래가 API 신청 — 승인되면 실부담 시나리오 기준을 감정가 → 시세로 전환.
  → `apps/api/src/rights-analysis/domain/total-burden.ts`
<!-- NEXT-ACTION:END -->

<!--
규칙:
- 이 마커 사이는 "지금/다음 할 일" 1~3건만. 짧게(화면 한 판).
- 완료된 항목은 여기 두지 말고 WORKLOG.md 의 ## History 로 옮긴다 (단일 출처·비대 방지).
- 훅(tools/hooks/print_next_action.py)은 이 마커 사이만 세션에 주입한다.
-->
