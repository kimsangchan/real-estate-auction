// 예상배당표 — 경매비용 → 최우선변제(소액임차인) → 당해세 → 우선변제(확정일자·법정기일·등기접수일 순)
// 단순화 배당. 동순위 안분 등 정밀 배당은 v2 범위
// (docs/work-orders/WP-03-rights-analysis-engine.md §범위 제외).
import { classifySmallDepositTenant, resolveMortgageReferenceDate } from './small-deposit-tenant';
import { analyzeTenantPriority } from './tenant-priority';
import type { RegionTier, RegisteredRight, RuleTag, TaxClaim, Tenant } from './types';

// v2: 당해세 단계 추가 — 이전 버전은 당해세를 누락해 인수액을 과소평가했다 (WP-11 §4)
export const DISTRIBUTION_RULE: RuleTag = { ruleId: 'DISTRIBUTION_TABLE', ruleVersion: 2 };

/** 당해세 우선 특례 시행일 — 이 날 이후 매각결정되는 사건부터 적용 (2023년 세법 개정) */
export const PROPERTY_TAX_TENANT_RELIEF_FROM = '2023-04-01';

export interface DistributionEntry {
  claimantId: string;
  claimantKind: 'SMALL_DEPOSIT_TENANT' | 'PRIORITY_TENANT' | 'REGISTERED_RIGHT' | 'TAX_CLAIM';
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
  /**
   * 금액을 알 수 없는 조세채권 수. 0보다 크면 **인수액은 하한**이다 —
   * 실제 인수액이 더 클 수 있어 화면에서 "확인 필요"로 다뤄야 한다.
   */
  unknownAmountTaxClaimCount: number;
}

export interface DistributionInput {
  /** 낙찰대금 */
  saleAmount: number;
  auctionCost: number;
  registeredRights: RegisteredRight[];
  tenants: Tenant[];
  /** 조세채권 — 없으면 빈 배열로 취급한다 */
  taxClaims?: TaxClaim[];
  region: RegionTier;
  baselineDate: string;
  distributionDemandDeadline: string;
  /**
   * 매각결정기일 — 당해세 우선 특례(2023-04-01 시행) 적용 여부를 가른다.
   * 없으면 현재 진행 사건으로 보고 특례를 적용한다.
   */
  saleDecisionDate?: string;
}

interface PriorityClaim {
  claimantId: string;
  claimantKind: 'PRIORITY_TENANT' | 'REGISTERED_RIGHT' | 'TAX_CLAIM';
  priorityDate: string;
  remainingClaim: number;
}

export function computeDistribution(input: DistributionInput): DistributionResult {
  const {
    saleAmount,
    auctionCost,
    registeredRights,
    tenants,
    taxClaims = [],
    region,
    baselineDate,
    distributionDemandDeadline,
    saleDecisionDate,
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

  // 2단계: 당해세 — 확정일자를 갖춘 임차인보다 앞선다.
  // 단 2023-04-01 특례: 임차인 확정일자보다 법정기일이 **늦은** 당해세는 그 금액만큼 임차인에게
  // 먼저 배당한다. 확정일자보다 앞선 당해세는 여전히 임차인보다 우선한다.
  const reliefApplies =
    saleDecisionDate === undefined || saleDecisionDate >= PROPERTY_TAX_TENANT_RELIEF_FROM;
  const receivedFromTaxRelief = new Map<string, number>();

  const propertyTaxClaims = taxClaims
    .filter((claim) => claim.isPropertyTax && claim.amount !== undefined)
    .sort((a, b) => (a.statutoryDate < b.statutoryDate ? -1 : a.statutoryDate > b.statutoryDate ? 1 : 0));

  for (const claim of propertyTaxClaims) {
    if (remaining <= 0) {
      break;
    }
    let claimRemaining = claim.amount as number;

    if (reliefApplies) {
      // 이 당해세보다 확정일자가 빠른 임차인이 특례로 보호된다
      for (const tenant of participatingTenants) {
        if (claimRemaining <= 0 || remaining <= 0) {
          break;
        }
        if (tenant.fixedDate === null || tenant.fixedDate >= claim.statutoryDate) {
          continue;
        }
        const alreadyReceived =
          (receivedFromSmallDeposit.get(tenant.id) ?? 0) + (receivedFromTaxRelief.get(tenant.id) ?? 0);
        const tenantClaim = tenant.depositAmount - alreadyReceived;
        if (tenantClaim <= 0) {
          continue;
        }
        const paid = Math.min(tenantClaim, claimRemaining, remaining);
        claimRemaining -= paid;
        remaining -= paid;
        receivedFromTaxRelief.set(tenant.id, (receivedFromTaxRelief.get(tenant.id) ?? 0) + paid);
        entries.push({ claimantId: tenant.id, claimantKind: 'PRIORITY_TENANT', amountPaid: paid });
      }
    }

    const paidToTax = Math.min(remaining, claimRemaining);
    if (paidToTax > 0) {
      remaining -= paidToTax;
      entries.push({ claimantId: claim.id, claimantKind: 'TAX_CLAIM', amountPaid: paidToTax });
    }
  }

  // 3단계: 우선변제 — 확정일자(대항요건 갖춘 날과 늦은 쪽)·법정기일·등기접수일 순으로 완제
  const priorityClaims: PriorityClaim[] = [];

  for (const tenant of participatingTenants) {
    if (!tenant.fixedDate) {
      continue;
    }
    const priority = priorityByTenant.get(tenant.id);
    if (!priority) {
      continue;
    }
    const alreadyReceived =
      (receivedFromSmallDeposit.get(tenant.id) ?? 0) + (receivedFromTaxRelief.get(tenant.id) ?? 0);
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

  // 당해세가 아닌 일반 조세는 등기 접수일이 아니라 법정기일로 순위를 다툰다
  for (const claim of taxClaims) {
    if (claim.isPropertyTax || claim.amount === undefined) {
      continue;
    }
    priorityClaims.push({
      claimantId: claim.id,
      claimantKind: 'TAX_CLAIM',
      priorityDate: claim.statutoryDate,
      remainingClaim: claim.amount,
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
      (receivedFromSmallDeposit.get(tenant.id) ?? 0) +
      (receivedFromTaxRelief.get(tenant.id) ?? 0) +
      (receivedFromPriority.get(tenant.id) ?? 0);
    const assumedAmount = priority.hasPriority ? Math.max(0, tenant.depositAmount - totalReceived) : 0;

    return { tenantId: tenant.id, hasPriority: priority.hasPriority, totalReceived, assumedAmount };
  });

  return {
    entries,
    remainingAfterCosts,
    remainingAfterAll: remaining,
    tenantOutcomes,
    unknownAmountTaxClaimCount: taxClaims.filter((claim) => claim.amount === undefined).length,
    ...DISTRIBUTION_RULE,
  };
}
