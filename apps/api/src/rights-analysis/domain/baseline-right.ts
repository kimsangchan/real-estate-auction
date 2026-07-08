// 말소기준권리 판별 — 6종 후보(전세권 예외 포함) 중 접수일 최선순위 (01-domain-discovery.md §1-3)
import type { RegisteredRight, RuleTag } from './types';

export const BASELINE_RIGHT_RULE: RuleTag = { ruleId: 'BASELINE_RIGHT', ruleVersion: 1 };

export class NoBaselineRightError extends Error {
  constructor() {
    super(
      '말소기준권리 후보(저당권·압류·가압류·담보가등기·경매개시결정등기·요건충족 전세권)가 없습니다',
    );
  }
}

export interface BaselineRight extends RuleTag {
  rightId: string;
  receivedDate: string;
}

const ALWAYS_BASELINE_CANDIDATE = new Set([
  'MORTGAGE',
  'SEIZURE',
  'PROVISIONAL_SEIZURE',
  'COLLATERAL_PROVISIONAL_REGISTRATION',
  'AUCTION_COMMENCEMENT',
]);

function isBaselineCandidate(right: RegisteredRight): boolean {
  if (ALWAYS_BASELINE_CANDIDATE.has(right.type)) {
    return true;
  }
  if (right.type === 'LEASEHOLD') {
    // 예외: 선순위 전세권은 건물 전부에 설정되고 배당요구까지 해야 말소기준 후보가 된다
    return Boolean(right.isWholeBuilding) && Boolean(right.demandedDistribution);
  }
  return false;
}

export function findBaselineRight(rights: RegisteredRight[]): BaselineRight {
  const candidates = rights.filter(isBaselineCandidate);
  if (candidates.length === 0) {
    throw new NoBaselineRightError();
  }

  const earliest = candidates.reduce((min, current) =>
    current.receivedDate < min.receivedDate ? current : min,
  );

  return { rightId: earliest.id, receivedDate: earliest.receivedDate, ...BASELINE_RIGHT_RULE };
}
