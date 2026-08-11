<!-- NEXT-ACTION:START -->
## ▶ 지금 할 일 (새 세션은 이 블록부터 — SessionStart 훅이 자동 주입)

- **[진행중]** WP-11 룰 역채점 — H3(임차인 유무↔매각결과) 첫 비교가 판독 불가로 기록됨.
  판독 가능한 비교 설계를 다시 세운다. → `docs/work-orders/WP-11-rule-backtest.md`, 커밋 `f0aa377`
- **[대기·사용자]** 실거래가 API 신청 — 승인되면 실부담 시나리오 기준을 감정가 → 시세로 전환.
  → `apps/api/src/rights-analysis/domain/total-burden.ts`
- **[대기]** 모바일 권리분석 화면 에뮬레이터 실기 확인 (단위 테스트만 통과 상태).
  → `apps/mobile/src/screens/RightsAnalysisScreen.tsx`
<!-- NEXT-ACTION:END -->

<!--
규칙:
- 이 마커 사이는 "지금/다음 할 일" 1~3건만. 짧게(화면 한 판).
- 완료된 항목은 여기 두지 말고 WORKLOG.md 의 ## History 로 옮긴다 (단일 출처·비대 방지).
- 훅(tools/hooks/print_next_action.py)은 이 마커 사이만 세션에 주입한다.
-->
