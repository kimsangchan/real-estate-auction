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

describe('computeDistribution — 당해세 (WP-11 §4)', () => {
  // 대항력 있는 선순위 임차인: 전입이 말소기준보다 빠르고 확정일자·배당요구를 갖춤
  const seniorTenant = tenant({
    id: 't1',
    moveInDate: '2024-01-01',
    fixedDate: '2024-01-02',
    depositAmount: 200_000_000,
    demandedDistribution: true,
    demandedDistributionDate: '2024-05-01',
  });

  it('당해세는 확정일자 임차인보다 먼저 배당돼 인수액을 키운다', () => {
    // 낙찰대금 2억, 임차인 보증금 2억, 당해세 5천만 → 임차인은 1.5억만 받고 5천만이 인수된다
    const result = computeDistribution(
      baseInput({
        saleAmount: 200_000_000,
        tenants: [seniorTenant],
        taxClaims: [
          // 법정기일이 확정일자보다 앞서므로 특례가 적용되지 않는다
          { id: 'tax1', isPropertyTax: true, statutoryDate: '2023-12-01', amount: 50_000_000 },
        ],
      }),
    );

    expect(result.entries).toContainEqual({
      claimantId: 'tax1',
      claimantKind: 'TAX_CLAIM',
      amountPaid: 50_000_000,
    });
    expect(result.tenantOutcomes[0]).toMatchObject({
      tenantId: 't1',
      totalReceived: 150_000_000,
      assumedAmount: 50_000_000,
    });
  });

  it('당해세가 없으면 임차인이 전액 배당받아 인수액이 0이다 (위 케이스의 대조군)', () => {
    const result = computeDistribution(
      baseInput({ saleAmount: 200_000_000, tenants: [seniorTenant] }),
    );

    expect(result.tenantOutcomes[0]?.assumedAmount).toBe(0);
  });

  it('2023-04-01 특례: 확정일자보다 법정기일이 늦은 당해세는 임차인에게 먼저 배당된다', () => {
    const result = computeDistribution(
      baseInput({
        saleAmount: 200_000_000,
        tenants: [seniorTenant],
        taxClaims: [
          // 법정기일(2024-02-01)이 확정일자(2024-01-02)보다 늦다 → 임차인이 이긴다
          { id: 'tax1', isPropertyTax: true, statutoryDate: '2024-02-01', amount: 50_000_000 },
        ],
        saleDecisionDate: '2026-07-30',
      }),
    );

    expect(result.tenantOutcomes[0]?.assumedAmount).toBe(0);
    expect(result.entries.filter((e) => e.claimantKind === 'TAX_CLAIM')).toHaveLength(0);
  });

  it('특례 시행일 전에 매각결정된 사건은 당해세가 여전히 임차인보다 우선한다', () => {
    const result = computeDistribution(
      baseInput({
        saleAmount: 200_000_000,
        tenants: [seniorTenant],
        taxClaims: [
          { id: 'tax1', isPropertyTax: true, statutoryDate: '2024-02-01', amount: 50_000_000 },
        ],
        saleDecisionDate: '2023-03-31',
      }),
    );

    expect(result.tenantOutcomes[0]?.assumedAmount).toBe(50_000_000);
  });

  it('금액을 알 수 없는 조세채권은 배당에서 빠지고 인수액이 하한임을 표시한다', () => {
    const result = computeDistribution(
      baseInput({
        saleAmount: 200_000_000,
        tenants: [seniorTenant],
        taxClaims: [{ id: 'tax1', isPropertyTax: true, statutoryDate: '2023-12-01' }],
      }),
    );

    expect(result.unknownAmountTaxClaimCount).toBe(1);
    // 금액을 모르니 배당에 반영하지 못한다 — 실제 인수액은 이보다 클 수 있다
    expect(result.tenantOutcomes[0]?.assumedAmount).toBe(0);
  });

  it('일반 조세는 당해세가 아니라 법정기일로 우선변제 순위를 다툰다', () => {
    // 낙찰대금을 보증금보다 크게 둬서 임차인·조세가 모두 배당받는 상황을 만든다
    const result = computeDistribution(
      baseInput({
        saleAmount: 220_000_000,
        registeredRights: [{ id: 'r1', type: 'MORTGAGE', receivedDate: BASELINE_DATE }],
        tenants: [seniorTenant],
        taxClaims: [
          // 일반 조세(부가세 등): 법정기일이 확정일자보다 늦으므로 임차인이 먼저 받는다
          { id: 'tax1', isPropertyTax: false, statutoryDate: '2024-05-01', amount: 50_000_000 },
        ],
      }),
    );

    expect(result.tenantOutcomes[0]?.assumedAmount).toBe(0);
    const order = result.entries.map((entry) => entry.claimantId);
    expect(order.indexOf('t1')).toBeLessThan(order.indexOf('tax1'));
    // 임차인 완제 후 남은 2천만원만 조세에 간다 — 당해세처럼 앞지르지 않는다
    expect(result.entries).toContainEqual({
      claimantId: 'tax1',
      claimantKind: 'TAX_CLAIM',
      amountPaid: 20_000_000,
    });
  });

  it('조세채권을 넣지 않으면 기존 배당 결과가 바뀌지 않는다', () => {
    const withoutField = computeDistribution(baseInput({ tenants: [seniorTenant] }));
    const withEmpty = computeDistribution(baseInput({ tenants: [seniorTenant], taxClaims: [] }));

    expect(withEmpty.entries).toEqual(withoutField.entries);
    expect(withEmpty.tenantOutcomes).toEqual(withoutField.tenantOutcomes);
  });
});

// 시행령 §10②③ — 최우선변제 총액은 주택가액(낙찰대금 - 집행비용, 대법원 2001다84824)의 1/2을
// 넘지 못한다. 지역별 상한만 적용하면 낙찰가가 낮은 사건에서 인수액을 과소평가한다.
describe('computeDistribution — 최우선변제 주택가액 1/2 상한', () => {
  const CAPPED_BASELINE = '2024-03-10';

  it('정상: 상한에 걸리면 최우선변제가 깎이고 그만큼 인수액이 생긴다', () => {
    // 실측 사건(서울동부 2024타경63301) 수치: 최저가 78,434,000원
    const smallDepositTenant = tenant({
      id: 't1',
      moveInDate: '2020-07-29', // 말소기준보다 선순위 → 대항력 있음
      depositAmount: 50_000_000, // 서울 소액임차인(1억 6,500만 이하), 지역 상한 5,500만
      fixedDate: null, // 확정일자가 없어 3단계 우선변제로 나머지를 못 받는다
      demandedDistribution: true,
      demandedDistributionDate: '2024-04-01',
    });

    const result = computeDistribution(
      baseInput({
        saleAmount: 78_434_000,
        auctionCost: 3_000_000, // 주택가액 75,434,000 → 상한 37,717,000
        tenants: [smallDepositTenant],
      }),
    );

    expect(result.tenantOutcomes).toEqual([
      { tenantId: 't1', hasPriority: true, totalReceived: 37_717_000, assumedAmount: 12_283_000 },
    ]);
  });

  it('경계: 임차인이 여럿이면 상한을 각자의 몫에 비례해 나눈다 (§10③)', () => {
    const shared = { demandedDistribution: true, demandedDistributionDate: '2024-04-01', fixedDate: null };
    const result = computeDistribution(
      baseInput({
        saleAmount: 100_000_000,
        auctionCost: 0, // 주택가액 100,000,000 → 상한 50,000,000
        tenants: [
          tenant({ id: 't1', moveInDate: '2024-01-01', depositAmount: 30_000_000, ...shared }),
          tenant({ id: 't2', moveInDate: '2024-01-01', depositAmount: 60_000_000, ...shared }),
        ],
      }),
    );

    // §10①의 몫은 30,000,000 + 55,000,000(지역 상한) = 85,000,000이고 상한이 50,000,000이므로
    // 비율 50/85로 나눈다. 원 단위 절사라 합계가 상한보다 1원 적다.
    expect(result.tenantOutcomes).toEqual([
      { tenantId: 't1', hasPriority: true, totalReceived: 17_647_058, assumedAmount: 12_352_942 },
      { tenantId: 't2', hasPriority: true, totalReceived: 32_352_941, assumedAmount: 27_647_059 },
    ]);
  });

  it('경계: 낙찰가가 충분하면 상한이 걸리지 않아 종전과 같이 전액 변제된다', () => {
    const smallDepositTenant = tenant({
      id: 't1',
      moveInDate: '2024-01-01',
      depositAmount: 50_000_000,
      fixedDate: null,
      demandedDistribution: true,
      demandedDistributionDate: '2024-04-01',
    });

    // 주택가액 300,000,000 → 상한 150,000,000 > 지역 상한 55,000,000이라 상한이 무의미하다
    const result = computeDistribution(baseInput({ tenants: [smallDepositTenant] }));

    expect(result.tenantOutcomes).toEqual([
      { tenantId: 't1', hasPriority: true, totalReceived: 50_000_000, assumedAmount: 0 },
    ]);
  });

  it('정상: 확정일자가 있으면 상한에 걸린 나머지를 3단계 우선변제로 회수한다', () => {
    const smallDepositTenant = tenant({
      id: 't1',
      moveInDate: '2020-07-29',
      depositAmount: 50_000_000,
      fixedDate: '2023-12-20', // 말소기준(2024-03-10)보다 앞선 우선변제권
      demandedDistribution: true,
      demandedDistributionDate: '2024-04-01',
    });

    const result = computeDistribution(
      baseInput({
        saleAmount: 78_434_000,
        auctionCost: 3_000_000,
        registeredRights: [{ id: 'r1', type: 'MORTGAGE', receivedDate: CAPPED_BASELINE }],
        tenants: [smallDepositTenant],
      }),
    );

    expect(result.tenantOutcomes).toEqual([
      { tenantId: 't1', hasPriority: true, totalReceived: 50_000_000, assumedAmount: 0 },
    ]);
  });
});
