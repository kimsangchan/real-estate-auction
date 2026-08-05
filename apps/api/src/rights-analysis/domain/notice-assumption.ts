// 매각물건명세서만으로 판정할 수 있는 임차인 인수 여부 — 등기부(CODEF, WP-04) 없이 쓰는 규칙.
//
// 명세서에는 말소기준일·배당요구종기와 임차인의 전입일·확정일자·보증금·배당요구가 다 있다.
// 없는 것은 **등기 권리 목록과 채권액**이다. 그래서 배당표를 못 만들고, 배당으로 얼마를
// 회수하는지 계산할 수 없다.
//
// 그럼에도 갈리는 것이 있다: 대항력이 없으면 인수는 0이고, 대항력이 있는데 배당요구를
// 안 했거나 종기를 넘겼으면 배당 자체를 못 받아 **보증금 전액**이 인수된다. 이 둘은 등기부와
// 무관하게 확정된다. 나머지 한 경우만 금액을 모른다.
//
// 판단·권유 문구는 만들지 않는다 — 상태값과 금액만 돌려준다 (D-011).
import { analyzeTenantPriority } from './tenant-priority';
import type { RuleTag } from './types';

export const NOTICE_ASSUMPTION_RULE: RuleTag = { ruleId: 'NOTICE_ASSUMPTION', ruleVersion: 1 };

export type NoticeAssumption =
  /** 대항력이 없어 매수인이 인수하지 않는다 */
  | 'NOT_ASSUMED'
  /** 대항력이 있고 배당요구가 없거나 종기를 넘겨 보증금 전액이 인수된다 */
  | 'ASSUMED_FULL'
  /** 대항력이 있고 배당요구도 유효하다. 배당으로 얼마를 회수하는지는 등기부가 있어야 안다 */
  | 'ASSUMED_AMOUNT_UNKNOWN'
  /** 전입일이나 말소기준일이 없어 판정할 수 없다 — "인수 없음"과 구분해야 한다 */
  | 'UNKNOWN';

export interface NoticeTenantInput {
  moveInDate: string | null;
  depositAmount: number | null;
  /** null은 명세서에서 읽어내지 못했다는 뜻이지 "안 했다"가 아니다 */
  demandedDistribution: boolean | null;
  demandedDistributionDate: string | null;
}

export interface NoticeAssumptionResult extends RuleTag {
  assumption: NoticeAssumption;
  /** 대항력 발생일 = 전입일 다음 날 0시. 전입일이 없으면 null */
  possessionRightDate: string | null;
  hasPriority: boolean | null;
  distributionDemandEffective: boolean | null;
  /** 확정되는 경우에만 채운다. ASSUMED_AMOUNT_UNKNOWN이면 null — 0으로 두면 "없음"으로 읽힌다 */
  assumedAmount: number | null;
}

export function classifyNoticeAssumption(
  tenant: NoticeTenantInput,
  baselineDate: string | null,
  distributionDemandDeadline: string | null,
): NoticeAssumptionResult {
  if (tenant.moveInDate === null || baselineDate === null) {
    return {
      assumption: 'UNKNOWN',
      possessionRightDate: null,
      hasPriority: null,
      distributionDemandEffective: null,
      assumedAmount: null,
      ...NOTICE_ASSUMPTION_RULE,
    };
  }

  // 배당요구를 읽어내지 못했으면(null) 유효하다고도 무효하다고도 할 수 없다.
  // analyzeTenantPriority에는 false로 넘기되 결과는 아래에서 null로 되돌린다.
  const demanded = tenant.demandedDistribution ?? false;
  const priority = analyzeTenantPriority(
    {
      id: 'notice',
      moveInDate: tenant.moveInDate,
      fixedDate: null,
      depositAmount: tenant.depositAmount ?? 0,
      demandedDistribution: demanded,
      demandedDistributionDate: tenant.demandedDistributionDate,
    },
    baselineDate,
    // 종기를 모르면 배당요구 유효성을 따질 수 없다 — 아래에서 null로 덮는다
    distributionDemandDeadline ?? '9999-12-31',
  );

  const demandKnown = tenant.demandedDistribution !== null && distributionDemandDeadline !== null;
  const demandEffective = demandKnown ? priority.distributionDemandEffective : null;

  if (!priority.hasPriority) {
    return {
      assumption: 'NOT_ASSUMED',
      possessionRightDate: priority.possessionRightDate,
      hasPriority: false,
      distributionDemandEffective: demandEffective,
      assumedAmount: 0,
      ...NOTICE_ASSUMPTION_RULE,
    };
  }

  // 대항력이 있는데 배당요구가 없거나 종기를 넘겼다 — 배당을 못 받으므로 전액이 인수된다.
  // 등기부가 있든 없든 결론이 같아서 지금 확정할 수 있다.
  if (demandEffective === false) {
    return {
      assumption: 'ASSUMED_FULL',
      possessionRightDate: priority.possessionRightDate,
      hasPriority: true,
      distributionDemandEffective: false,
      assumedAmount: tenant.depositAmount,
      ...NOTICE_ASSUMPTION_RULE,
    };
  }

  return {
    assumption: 'ASSUMED_AMOUNT_UNKNOWN',
    possessionRightDate: priority.possessionRightDate,
    hasPriority: true,
    distributionDemandEffective: demandEffective,
    assumedAmount: null,
    ...NOTICE_ASSUMPTION_RULE,
  };
}
