import { calculateTotalBurden, type TotalBurdenExtras } from './total-burden';

const BASE: TotalBurdenExtras = { propertyKind: null, evictionOutlook: 'NO_REPORTED_TENANT' };

function extra(result: ReturnType<typeof calculateTotalBurden>, kind: string) {
  const item = result.extras.find((e) => e.kind === kind);
  if (!item) throw new Error(`${kind} 항목이 없다`);
  return item.range;
}

describe('calculateTotalBurden — 확정 합계 (v1 정의 유지)', () => {
  it('인수보증금이 없으면 확정 합계는 입찰가뿐이다', () => {
    const result = calculateTotalBurden(300_000_000, [], BASE);

    expect(result.totalAssumedAmount).toBe(0);
    expect(result.totalBurden).toBe(300_000_000);
  });

  it('입찰가와 인수보증금 합계를 계산한다', () => {
    const result = calculateTotalBurden(300_000_000, [50_000_000, 20_000_000], BASE);

    expect(result.totalAssumedAmount).toBe(70_000_000);
    expect(result.totalBurden).toBe(370_000_000);
  });
});

describe('calculateTotalBurden — 취득세 구간', () => {
  it('비주택은 4.6% 고정이라 구간이 한 점이다', () => {
    const result = calculateTotalBurden(100_000_000, [], { ...BASE, propertyKind: 'NON_HOUSING' });

    expect(extra(result, 'ACQUISITION_TAX')).toEqual({ min: 4_600_000, max: 4_600_000 });
  });

  it('주택 6억 이하는 1주택 1.1%부터 다주택 최고 13.4%까지다', () => {
    const result = calculateTotalBurden(100_000_000, [], { ...BASE, propertyKind: 'HOUSING' });

    expect(extra(result, 'ACQUISITION_TAX')).toEqual({ min: 1_100_000, max: 13_400_000 });
  });

  it('주택 6억~9억 구간은 표준세율이 선형으로 올라간다 (7.5억 → 2% → 교육세 포함 2.2%)', () => {
    const result = calculateTotalBurden(750_000_000, [], { ...BASE, propertyKind: 'HOUSING' });

    expect(extra(result, 'ACQUISITION_TAX').min).toBe(16_500_000); // 7.5억 × 2.2%
  });

  it('주택 9억 초과는 표준세율 3%로 고정된다 (교육세 포함 3.3%)', () => {
    const result = calculateTotalBurden(1_000_000_000, [], { ...BASE, propertyKind: 'HOUSING' });

    expect(extra(result, 'ACQUISITION_TAX').min).toBe(33_000_000);
  });

  it('주택 여부를 모르면 두 체계를 아우르는 구간을 준다', () => {
    const result = calculateTotalBurden(100_000_000, [], BASE);

    // min = 주택 1.1%(비주택 4.6%보다 낮다), max = 주택 최고 13.4%
    expect(extra(result, 'ACQUISITION_TAX')).toEqual({ min: 1_100_000, max: 13_400_000 });
  });
});

describe('calculateTotalBurden — 명도비 구간', () => {
  it.each([
    ['NO_REPORTED_TENANT', 0, 1_500_000],
    ['TENANT_FULLY_COVERED', 500_000, 3_000_000],
    ['TENANT_WITH_LOSS', 2_000_000, 7_000_000],
  ] as const)('%s 구간', (outlook, min, max) => {
    const result = calculateTotalBurden(100_000_000, [], { ...BASE, evictionOutlook: outlook });

    expect(extra(result, 'EVICTION_COST')).toEqual({ min, max });
  });
});

describe('calculateTotalBurden — 합산과 미상 항목', () => {
  it('추정 총액 구간 = 확정 합계 + 각 항목 구간의 합', () => {
    const result = calculateTotalBurden(100_000_000, [30_000_000], {
      propertyKind: 'NON_HOUSING',
      evictionOutlook: 'TENANT_WITH_LOSS',
    });

    // 확정 130,000,000 + 취득세 4,600,000 + 등기 500,000~1,500,000 + 명도 2,000,000~7,000,000
    expect(result.totalWithExtras).toEqual({ min: 137_100_000, max: 143_100_000 });
  });

  it('체납관리비는 금액 미상 항목으로만 알린다 — 합산하지 않는다 (대법원 2001다8677)', () => {
    const result = calculateTotalBurden(100_000_000, [], BASE);

    expect(result.unknownItems).toEqual(['UNPAID_MAINTENANCE_FEE']);
  });

  it('규칙 버전이 2로 오른다 — v1 결과와 구분돼야 한다', () => {
    expect(calculateTotalBurden(100_000_000, [], BASE).ruleVersion).toBe(2);
  });
});
