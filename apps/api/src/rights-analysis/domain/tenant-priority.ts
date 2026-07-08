// 임차인 대항력·배당요구 유효성 판정 (01-domain-discovery.md §1-3)
// 대항력 발생일 = 전입신고 다음 날 0시. 배당요구는 배당요구종기 이내에 한 경우만 유효하다.
import type { RuleTag, Tenant } from './types';

export const TENANT_PRIORITY_RULE: RuleTag = { ruleId: 'TENANT_PRIORITY', ruleVersion: 1 };

export interface TenantPriorityResult extends RuleTag {
  tenantId: string;
  /** 대항력 발생일 = 전입일 다음 날 0시 (YYYY-MM-DD) */
  possessionRightDate: string;
  /** 말소기준권리보다 대항력이 선순위인지 */
  hasPriority: boolean;
  /** 배당요구가 배당요구종기 이내에 이뤄져 효력이 있는지 */
  distributionDemandEffective: boolean;
}

function addOneDay(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function analyzeTenantPriority(
  tenant: Tenant,
  baselineDate: string,
  distributionDemandDeadline: string,
): TenantPriorityResult {
  const possessionRightDate = addOneDay(tenant.moveInDate);
  const hasPriority = possessionRightDate <= baselineDate;
  const distributionDemandEffective =
    tenant.demandedDistribution &&
    tenant.demandedDistributionDate !== null &&
    tenant.demandedDistributionDate <= distributionDemandDeadline;

  return {
    tenantId: tenant.id,
    possessionRightDate,
    hasPriority,
    distributionDemandEffective,
    ...TENANT_PRIORITY_RULE,
  };
}
