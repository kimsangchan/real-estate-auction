// 예상배당표 — 경매비용 → 최우선변제(소액임차인) → 우선변제(확정일자·등기접수일 순) 단순화 배당.
// 동순위 안분 등 정밀 배당은 v2 범위 (docs/work-orders/WP-03-rights-analysis-engine.md §범위 제외).
import { classifySmallDepositTenant, resolveMortgageReferenceDate } from './small-deposit-tenant';
import { analyzeTenantPriority } from './tenant-priority';
import type { RegionTier, RegisteredRight, RuleTag, Tenant } from './types';

export const DISTRIBUTION_RULE: RuleTag = { ruleId: 'DISTRIBUTION_TABLE', ruleVersion: 1 };

export interface DistributionEntry {
  claimantId: string;
  claimantKind: 'SMALL_DEPOSIT_TENANT' | 'PRIORITY_TENANT' | 'REGISTERED_RIGHT';
  amountPaid: number;
}

export interface TenantDistributionOutcome {
  tenantId: string;
  hasPriority: boolean;
  totalReceived: number;
  /** 매수인이 인수해야 하는 잔액 — 대항력 없는 임차인은 항상 0 */
  assumedAmount: number;
}

export interface DistributionResult extends RuleTag {
  entries: DistributionEntry[];
  remainingAfterCosts: number;
  remainingAfterAll: number;
  tenantOutcomes: TenantDistributionOutcome[];
}

export interface DistributionInput {
  /** 낙찰대금 */
  saleAmount: number;
  auctionCost: number;
  registeredRights: RegisteredRight[];
  tenants: Tenant[];
  region: RegionTier;
  baselineDate: string;
  distributionDemandDeadline: string;
}

interface PriorityClaim {
  claimantId: string;
  claimantKind: 'PRIORITY_TENANT' | 'REGISTERED_RIGHT';
  priorityDate: string;
  remainingClaim: number;
}

export function computeDistribution(input: DistributionInput): DistributionResult {
  const {
    saleAmount,
    auctionCost,
    registeredRights,
    tenants,
    region,
    baselineDate,
    distributionDemandDeadline,
  } = input;

  const remainingAfterCosts = Math.max(0, saleAmount - auctionCost);
  let remaining = remainingAfterCosts;
  const entries: DistributionEntry[] = [];

  const mortgageReferenceDate = resolveMortgageReferenceDate(registeredRights);
  const priorityByTenant = new Map(
    tenants.map((t) => [t.id, analyzeTenantPriority(t, baselineDate, distributionDemandDeadline)]),
  );
  const participatingTenants = tenants.filter(
    (t) => priorityByTenant.get(t.id)?.distributionDemandEffective,
  );

  // 1단계: 최우선변제 — 소액임차인(확정일자 불요), 재원 부족 시 비례 안분
  const smallDepositClaims = participatingTenants
    .map((t) => ({ tenant: t, result: classifySmallDepositTenant(t, region, mortgageReferenceDate) }))
    .filter((c) => c.result.isEligible);
  const totalSmallDepositClaim = smallDepositClaims.reduce(
    (sum, c) => sum + c.result.priorityRepaymentAmount,
    0,
  );
  const receivedFromSmallDeposit = new Map<string, number>();

  if (totalSmallDepositClaim > 0) {
    const ratio = Math.min(1, remaining / totalSmallDepositClaim);
    for (const claim of smallDepositClaims) {
      const paid = Math.floor(claim.result.priorityRepaymentAmount * ratio);
      receivedFromSmallDeposit.set(claim.tenant.id, paid);
      remaining -= paid;
      entries.push({ claimantId: claim.tenant.id, claimantKind: 'SMALL_DEPOSIT_TENANT', amountPaid: paid });
    }
  }

  // 2단계: 우선변제 — 확정일자(대항요건 갖춘 날과 늦은 쪽)·등기접수일 순으로 완제
  const priorityClaims: PriorityClaim[] = [];

  for (const tenant of participatingTenants) {
    if (!tenant.fixedDate) {
      continue;
    }
    const priority = priorityByTenant.get(tenant.id);
    if (!priority) {
      continue;
    }
    const alreadyReceived = receivedFromSmallDeposit.get(tenant.id) ?? 0;
    const remainingClaim = tenant.depositAmount - alreadyReceived;
    if (remainingClaim <= 0) {
      continue;
    }
    const priorityDate =
      tenant.fixedDate > priority.possessionRightDate ? tenant.fixedDate : priority.possessionRightDate;
    priorityClaims.push({ claimantId: tenant.id, claimantKind: 'PRIORITY_TENANT', priorityDate, remainingClaim });
  }

  for (const right of registeredRights) {
    if (right.amount === undefined) {
      continue;
    }
    priorityClaims.push({
      claimantId: right.id,
      claimantKind: 'REGISTERED_RIGHT',
      priorityDate: right.receivedDate,
      remainingClaim: right.amount,
    });
  }

  priorityClaims.sort((a, b) => (a.priorityDate < b.priorityDate ? -1 : a.priorityDate > b.priorityDate ? 1 : 0));

  const receivedFromPriority = new Map<string, number>();
  for (const claim of priorityClaims) {
    if (remaining <= 0) {
      break;
    }
    const paid = Math.min(remaining, claim.remainingClaim);
    remaining -= paid;
    receivedFromPriority.set(claim.claimantId, (receivedFromPriority.get(claim.claimantId) ?? 0) + paid);
    entries.push({ claimantId: claim.claimantId, claimantKind: claim.claimantKind, amountPaid: paid });
  }

  const tenantOutcomes: TenantDistributionOutcome[] = tenants.map((tenant) => {
    const priority = priorityByTenant.get(tenant.id);
    if (!priority) {
      throw new Error(`임차인 우선순위 분석 결과가 없습니다: ${tenant.id}`);
    }
    const totalReceived =
      (receivedFromSmallDeposit.get(tenant.id) ?? 0) + (receivedFromPriority.get(tenant.id) ?? 0);
    const assumedAmount = priority.hasPriority ? Math.max(0, tenant.depositAmount - totalReceived) : 0;

    return { tenantId: tenant.id, hasPriority: priority.hasPriority, totalReceived, assumedAmount };
  });

  return {
    entries,
    remainingAfterCosts,
    remainingAfterAll: remaining,
    tenantOutcomes,
    ...DISTRIBUTION_RULE,
  };
}
