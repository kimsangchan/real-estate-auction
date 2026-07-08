import { computeDistribution, type DistributionInput } from './distribution';
import type { RegisteredRight, Tenant } from './types';

const BASELINE_DATE = '2024-03-10';
const DEMAND_DEADLINE = '2024-06-30';

function baseInput(overrides: Partial<DistributionInput>): DistributionInput {
  return {
    saleAmount: 300_000_000,
    auctionCost: 0,
    registeredRights: [{ id: 'r1', type: 'MORTGAGE', receivedDate: BASELINE_DATE }],
    tenants: [],
    region: 'SEOUL',
    baselineDate: BASELINE_DATE,
    distributionDemandDeadline: DEMAND_DEADLINE,
    ...overrides,
  };
}

function tenant(overrides: Partial<Tenant> & Pick<Tenant, 'id' | 'moveInDate' | 'depositAmount'>): Tenant {
  return {
    fixedDate: null,
    demandedDistribution: false,
    demandedDistributionDate: null,
    ...overrides,
  };
}

describe('computeDistribution', () => {
  it('정상: 배당요구한 소액임차인은 최우선변제로 전액 회수되어 인수액이 0이 된다', () => {
    const priorityTenant = tenant({
      id: 't1',
      moveInDate: '2024-01-01', // 대항력 발생 2024-01-02, 말소기준(2024-03-10)보다 선순위
      depositAmount: 50_000_000, // 서울 소액임차인 상한(165,000,000) 이내
      demandedDistribution: true,
      demandedDistributionDate: '2024-04-01',
    });

    const result = computeDistribution(baseInput({ tenants: [priorityTenant] }));

    expect(result.tenantOutcomes).toEqual([
      { tenantId: 't1', hasPriority: true, totalReceived: 50_000_000, assumedAmount: 0 },
    ]);
  });

  it('정상: 배당요구 안 한 선순위 임차인은 보증금 전액을 매수인이 인수한다', () => {
    const priorityTenant = tenant({
      id: 't1',
      moveInDate: '2024-01-01',
      depositAmount: 50_000_000,
      demandedDistribution: false,
    });

    const result = computeDistribution(baseInput({ tenants: [priorityTenant] }));

    expect(result.tenantOutcomes).toEqual([
      { tenantId: 't1', hasPriority: true, totalReceived: 0, assumedAmount: 50_000_000 },
    ]);
  });

  it('경계: 배당요구종기 이후 배당요구는 무효 처리되어 전액 인수된다', () => {
    const priorityTenant = tenant({
      id: 't1',
      moveInDate: '2024-01-01',
      depositAmount: 50_000_000,
      demandedDistribution: true,
      demandedDistributionDate: '2024-07-01', // 배당요구종기(2024-06-30) 이후
    });

    const result = computeDistribution(baseInput({ tenants: [priorityTenant] }));

    expect(result.tenantOutcomes).toEqual([
      { tenantId: 't1', hasPriority: true, totalReceived: 0, assumedAmount: 50_000_000 },
    ]);
  });

  it('후순위(대항력 없는) 임차인은 배당을 받아도 인수액이 항상 0이다', () => {
    const juniorTenant = tenant({
      id: 't1',
      moveInDate: BASELINE_DATE, // 대항력 발생일이 말소기준일보다 하루 늦어 후순위
      depositAmount: 50_000_000,
      demandedDistribution: true,
      demandedDistributionDate: '2024-04-01',
    });

    const result = computeDistribution(baseInput({ tenants: [juniorTenant] }));

    expect(result.tenantOutcomes[0]?.hasPriority).toBe(false);
    expect(result.tenantOutcomes[0]?.assumedAmount).toBe(0);
  });

  it('재원이 부족하면 확정일자 순위대로 우선변제하고 남는 임차인은 나머지를 인수한다', () => {
    const rights: RegisteredRight[] = [{ id: 'r1', type: 'MORTGAGE', receivedDate: BASELINE_DATE, amount: 0 }];
    const laterTenant = tenant({
      id: 't1',
      moveInDate: '2024-01-01',
      depositAmount: 200_000_000, // 소액임차인 상한 초과 — 최우선변제 대상 아님
      fixedDate: '2024-02-01',
      demandedDistribution: true,
      demandedDistributionDate: '2024-04-01',
    });

    const result = computeDistribution(
      baseInput({ registeredRights: rights, tenants: [laterTenant], saleAmount: 100_000_000 }),
    );

    expect(result.tenantOutcomes).toEqual([
      { tenantId: 't1', hasPriority: true, totalReceived: 100_000_000, assumedAmount: 100_000_000 },
    ]);
  });
});
