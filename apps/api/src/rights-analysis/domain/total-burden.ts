// 총 부담액 계산기 — 입찰가 + 인수보증금 합계 (UX-02 백엔드, 01-domain-discovery.md §1-3)
import type { RuleTag } from './types';

export const TOTAL_BURDEN_RULE: RuleTag = { ruleId: 'TOTAL_BURDEN', ruleVersion: 1 };

export interface TotalBurdenResult extends RuleTag {
  bidPrice: number;
  totalAssumedAmount: number;
  totalBurden: number;
}

export function calculateTotalBurden(bidPrice: number, assumedAmounts: number[]): TotalBurdenResult {
  const totalAssumedAmount = assumedAmounts.reduce((sum, amount) => sum + amount, 0);

  return {
    bidPrice,
    totalAssumedAmount,
    totalBurden: bidPrice + totalAssumedAmount,
    ...TOTAL_BURDEN_RULE,
  };
}
