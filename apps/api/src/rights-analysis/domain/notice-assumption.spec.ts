import { classifyNoticeAssumption, type NoticeTenantInput } from './notice-assumption';

const BASELINE = '2024-02-19';
const DEADLINE = '2025-01-22';

function tenant(overrides: Partial<NoticeTenantInput> = {}): NoticeTenantInput {
  return {
    moveInDate: '2020-07-29',
    depositAmount: 50_000_000,
    demandedDistribution: true,
    demandedDistributionDate: '2024-10-25',
    ...overrides,
  };
}

describe('classifyNoticeAssumption', () => {
  it('대항력이 없으면 인수하지 않는다 — 등기부 없이도 확정된다', () => {
    const result = classifyNoticeAssumption(
      tenant({ moveInDate: '2024-03-01' }), // 대항력 발생 2024-03-02 > 말소기준 2024-02-19
      BASELINE,
      DEADLINE,
    );

    expect(result).toMatchObject({
      assumption: 'NOT_ASSUMED',
      hasPriority: false,
      assumedAmount: 0,
    });
  });

  it('대항력이 있는데 배당요구를 안 했으면 보증금 전액이 인수된다', () => {
    const result = classifyNoticeAssumption(
      tenant({ demandedDistribution: false, demandedDistributionDate: null }),
      BASELINE,
      DEADLINE,
    );

    expect(result).toMatchObject({
      assumption: 'ASSUMED_FULL',
      hasPriority: true,
      distributionDemandEffective: false,
      assumedAmount: 50_000_000,
    });
  });

  it('배당요구가 종기를 넘겼으면 안 한 것과 같아 전액 인수된다', () => {
    const result = classifyNoticeAssumption(
      tenant({ demandedDistributionDate: '2025-02-01' }), // 종기 2025-01-22 이후
      BASELINE,
      DEADLINE,
    );

    expect(result.assumption).toBe('ASSUMED_FULL');
    expect(result.assumedAmount).toBe(50_000_000);
  });

  it('대항력·배당요구가 모두 유효하면 인수액은 등기부가 있어야 안다', () => {
    const result = classifyNoticeAssumption(tenant(), BASELINE, DEADLINE);

    expect(result).toMatchObject({
      assumption: 'ASSUMED_AMOUNT_UNKNOWN',
      hasPriority: true,
      distributionDemandEffective: true,
      // 0으로 두면 "인수 없음"으로 읽힌다 — 모른다는 뜻의 null이어야 한다
      assumedAmount: null,
    });
  });

  it('경계: 대항력 발생일이 말소기준일과 같은 날이면 선순위다', () => {
    // 전입 2024-02-18 → 대항력 2024-02-19 = 말소기준일
    const result = classifyNoticeAssumption(tenant({ moveInDate: '2024-02-18' }), BASELINE, DEADLINE);
    expect(result.hasPriority).toBe(true);

    const nextDay = classifyNoticeAssumption(tenant({ moveInDate: '2024-02-19' }), BASELINE, DEADLINE);
    expect(nextDay.hasPriority).toBe(false);
  });

  it('전입일이나 말소기준일이 없으면 판정하지 않는다 — "인수 없음"과 다르다', () => {
    expect(classifyNoticeAssumption(tenant({ moveInDate: null }), BASELINE, DEADLINE)).toMatchObject({
      assumption: 'UNKNOWN',
      hasPriority: null,
      assumedAmount: null,
    });
    expect(classifyNoticeAssumption(tenant(), null, DEADLINE).assumption).toBe('UNKNOWN');
  });

  it('배당요구 여부를 못 읽었으면 무효로 단정하지 않는다', () => {
    const result = classifyNoticeAssumption(
      tenant({ demandedDistribution: null, demandedDistributionDate: null }),
      BASELINE,
      DEADLINE,
    );

    // 안 했다고 단정하면 "전액 인수"로 과장된다 — 금액 미상으로 남긴다
    expect(result.assumption).toBe('ASSUMED_AMOUNT_UNKNOWN');
    expect(result.distributionDemandEffective).toBeNull();
  });

  it('배당요구종기를 모르면 유효성을 따지지 않는다', () => {
    const result = classifyNoticeAssumption(tenant(), BASELINE, null);

    expect(result.assumption).toBe('ASSUMED_AMOUNT_UNKNOWN');
    expect(result.distributionDemandEffective).toBeNull();
  });

  it('보증금을 못 읽은 전액 인수 건은 금액을 지어내지 않는다', () => {
    const result = classifyNoticeAssumption(
      tenant({ depositAmount: null, demandedDistribution: false, demandedDistributionDate: null }),
      BASELINE,
      DEADLINE,
    );

    expect(result.assumption).toBe('ASSUMED_FULL');
    expect(result.assumedAmount).toBeNull();
  });
});
