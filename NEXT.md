<!-- NEXT-ACTION:START -->
## ▶ 지금 할 일 (새 세션은 이 블록부터 — SessionStart 훅이 자동 주입)

- **[진행중]** 수집기가 배당요구 "안 함"을 기록하지 못한다 — `demanded_distribution`이 NULL 4,108 /
  true 2,617이고 **false가 0건**이다. 명세서의 빈 배당요구 칸을 "못 읽음"으로 두는 탓에
  `ASSUMED_FULL`(전액 인수 확정)이 종기 초과 경로로만 잡힌다(서울 중심부 181건 중 1건).
  → `tools/collector/src/collector/notice_tenant_parser.py`, WP-11 §4-7
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
