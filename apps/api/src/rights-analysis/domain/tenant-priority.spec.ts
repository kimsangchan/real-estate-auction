import { analyzeTenantPriority } from './tenant-priority';
import type { Tenant } from './types';

const BASELINE_DATE = '2024-03-10';
const DEMAND_DEADLINE = '2024-06-30';

function tenant(overrides: Partial<Tenant> & Pick<Tenant, 'id' | 'moveInDate'>): Tenant {
  return {
    fixedDate: null,
    depositAmount: 0,
    demandedDistribution: false,
    demandedDistributionDate: null,
    ...overrides,
  };
}

describe('analyzeTenantPriority', () => {
  it('전입 다음 날이 말소기준보다 이르면 선순위(대항력 있음)로 판정한다', () => {
    const result = analyzeTenantPriority(
      tenant({ id: 't1', moveInDate: '2024-03-08' }),
      BASELINE_DATE,
      DEMAND_DEADLINE,
    );

    expect(result.possessionRightDate).toBe('2024-03-09');
    expect(result.hasPriority).toBe(true);
  });

  it('경계: 전입일이 말소기준 접수일과 같으면 대항력은 다음 날 발생해 후순위가 된다', () => {
    const result = analyzeTenantPriority(
      tenant({ id: 't1', moveInDate: BASELINE_DATE }),
      BASELINE_DATE,
      DEMAND_DEADLINE,
    );

    expect(result.possessionRightDate).toBe('2024-03-11');
    expect(result.hasPriority).toBe(false);
  });

  it('경계: 전입 다음 날이 말소기준일과 정확히 같으면 선순위로 인정한다', () => {
    const result = analyzeTenantPriority(
      tenant({ id: 't1', moveInDate: '2024-03-09' }),
      BASELINE_DATE,
      DEMAND_DEADLINE,
    );

    expect(result.possessionRightDate).toBe(BASELINE_DATE);
    expect(result.hasPriority).toBe(true);
  });

  it('배당요구를 하지 않으면 배당요구 효력이 없다', () => {
    const result = analyzeTenantPriority(
      tenant({ id: 't1', moveInDate: '2024-01-01', demandedDistribution: false }),
      BASELINE_DATE,
      DEMAND_DEADLINE,
    );

    expect(result.distributionDemandEffective).toBe(false);
  });

  it('경계: 배당요구종기 이후 배당요구는 효력이 없다', () => {
    const result = analyzeTenantPriority(
      tenant({
        id: 't1',
        moveInDate: '2024-01-01',
        demandedDistribution: true,
        demandedDistributionDate: '2024-07-01',
      }),
      BASELINE_DATE,
      DEMAND_DEADLINE,
    );

    expect(result.distributionDemandEffective).toBe(false);
  });

  it('배당요구종기 이내의 배당요구는 효력이 있다', () => {
    const result = analyzeTenantPriority(
      tenant({
        id: 't1',
        moveInDate: '2024-01-01',
        demandedDistribution: true,
        demandedDistributionDate: '2024-06-30',
      }),
      BASELINE_DATE,
      DEMAND_DEADLINE,
    );

    expect(result.distributionDemandEffective).toBe(true);
  });
});
