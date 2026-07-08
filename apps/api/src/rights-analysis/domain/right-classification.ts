// 인수/말소 분류 — 말소기준 이후 권리는 말소(원칙), 이전 용익물권·가처분·가등기는 인수,
// 등기부에 없는 위험(유치권 등)은 판별 불가로 분류한다 (01-domain-discovery.md §1-3)
import type {
  RegisteredRight,
  RegisteredRightClassification,
  RightStatus,
  RuleTag,
  UnregisteredRisk,
  UnregisteredRiskClassification,
} from './types';

export const RIGHT_CLASSIFICATION_RULE: RuleTag = { ruleId: 'RIGHT_CLASSIFICATION', ruleVersion: 1 };
export const UNREGISTERED_RISK_RULE: RuleTag = { ruleId: 'UNREGISTERED_RISK_FLAG', ruleVersion: 1 };

// 담보물권·압류 계열은 말소기준 해당 여부와 무관하게 매각으로 항상 소멸한다 (소제주의)
const ALWAYS_EXTINGUISHED_ON_SALE = new Set([
  'MORTGAGE',
  'SEIZURE',
  'PROVISIONAL_SEIZURE',
  'COLLATERAL_PROVISIONAL_REGISTRATION',
  'AUCTION_COMMENCEMENT',
]);

export function classifyRegisteredRight(
  right: RegisteredRight,
  baselineDate: string,
): RegisteredRightClassification {
  const status: RightStatus = ALWAYS_EXTINGUISHED_ON_SALE.has(right.type)
    ? 'EXTINGUISHED'
    : right.receivedDate < baselineDate
      ? 'ASSUMED'
      : 'EXTINGUISHED';

  return { rightId: right.id, status, ...RIGHT_CLASSIFICATION_RULE };
}

export function classifyUnregisteredRisk(risk: UnregisteredRisk): UnregisteredRiskClassification {
  return { riskId: risk.id, status: 'NEEDS_REVIEW', ...UNREGISTERED_RISK_RULE };
}
