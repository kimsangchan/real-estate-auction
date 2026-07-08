// 소액임차인 최우선변제 판정 — 기준 시점은 최초 담보물권 설정일, 없으면 경매개시결정등기일 (01-domain-discovery.md §1-3)
import { findApplicableSmallDepositRule } from './small-deposit-tenant-table';
import type { RegionTier, RegisteredRight, RuleTag, Tenant } from './types';

export interface SmallDepositTenantResult extends RuleTag {
  tenantId: string;
  isEligible: boolean;
  /** 소액임차인이면 min(보증금, 최우선변제 상한), 아니면 0 */
  priorityRepaymentAmount: number;
}

export class NoMortgageReferenceDateError extends Error {
  constructor() {
    super('소액임차인 기준 시점을 판단할 담보물권 또는 경매개시결정등기가 없습니다');
  }
}

const MORTGAGE_TYPES = new Set(['MORTGAGE', 'COLLATERAL_PROVISIONAL_REGISTRATION']);

/** 최초 담보물권(근저당 등) 설정일을 찾고, 없으면 경매개시결정등기일로 대체한다. */
export function resolveMortgageReferenceDate(rights: RegisteredRight[]): string {
  const mortgageDates = rights.filter((r) => MORTGAGE_TYPES.has(r.type)).map((r) => r.receivedDate);
  if (mortgageDates.length > 0) {
    return mortgageDates.reduce((earliest, date) => (date < earliest ? date : earliest));
  }

  const auctionCommencement = rights.find((r) => r.type === 'AUCTION_COMMENCEMENT');
  if (auctionCommencement) {
    return auctionCommencement.receivedDate;
  }

  throw new NoMortgageReferenceDateError();
}

export function classifySmallDepositTenant(
  tenant: Tenant,
  region: RegionTier,
  mortgageReferenceDate: string,
): SmallDepositTenantResult {
  const rule = findApplicableSmallDepositRule(mortgageReferenceDate);
  const isEligible = tenant.depositAmount <= rule.depositCapByRegion[region];
  const priorityRepaymentAmount = isEligible
    ? Math.min(tenant.depositAmount, rule.priorityRepaymentCapByRegion[region])
    : 0;

  return {
    tenantId: tenant.id,
    isEligible,
    priorityRepaymentAmount,
    ruleId: `SMALL_DEPOSIT_TENANT_${rule.effectiveDate}`,
    ruleVersion: 1,
  };
}
