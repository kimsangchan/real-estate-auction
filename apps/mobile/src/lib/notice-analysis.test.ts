// 인수액 합산·대표 표기 규칙 테스트 — 웹 apps/web/app/items/notice-analysis.test.ts와 같은 케이스.
import {
  assumedHeadline,
  assumedTotal,
  type AnalyzedTenant,
} from './notice-analysis';

function tenant(
  overrides: Partial<AnalyzedTenant> & Pick<AnalyzedTenant, 'tenantSeq'>,
): AnalyzedTenant {
  return {
    sourceKinds: ['권리신고'],
    occupiedPart: '202호',
    moveInDate: '2020-07-29',
    fixedDate: '2023-12-20',
    depositAmount: 50_000_000,
    demandedDistribution: true,
    demandedDistributionDate: '2024-10-25',
    possessionRightDate: '2020-07-30',
    hasPriority: true,
    distributionDemandEffective: true,
    assumption: 'ASSUMED_AMOUNT_UNKNOWN',
    assumedAmount: null,
    ...overrides,
  };
}

describe('assumedTotal', () => {
  it('전액 인수 보증금만 합산한다', () => {
    expect(
      assumedTotal([
        tenant({
          tenantSeq: 1,
          assumption: 'ASSUMED_FULL',
          assumedAmount: 50_000_000,
        }),
        tenant({ tenantSeq: 2, assumption: 'NOT_ASSUMED', assumedAmount: 0 }),
      ]),
    ).toEqual({ amount: 50_000_000, isLowerBound: false });
  });

  it('금액 미상이 섞이면 합계는 하한이다 — 실제 인수액이 더 클 수 있다', () => {
    expect(
      assumedTotal([
        tenant({
          tenantSeq: 1,
          assumption: 'ASSUMED_FULL',
          assumedAmount: 50_000_000,
        }),
        tenant({
          tenantSeq: 2,
          assumption: 'ASSUMED_AMOUNT_UNKNOWN',
          assumedAmount: null,
        }),
      ]),
    ).toEqual({ amount: 50_000_000, isLowerBound: true });
  });

  it('전액 인수인데 보증금을 못 읽었으면 합계에 넣지 않고 하한으로 표시한다', () => {
    expect(
      assumedTotal([
        tenant({ tenantSeq: 1, assumption: 'ASSUMED_FULL', assumedAmount: null }),
      ]),
    ).toEqual({ amount: 0, isLowerBound: true });
  });

  it('판정 불가도 하한을 만든다 — 인수 없음과 구분해야 한다', () => {
    expect(
      assumedTotal([
        tenant({ tenantSeq: 1, assumption: 'UNKNOWN', assumedAmount: null }),
      ]).isLowerBound,
    ).toBe(true);
  });
});

describe('assumedHeadline', () => {
  it('확정 금액이 없고 미확정만 있으면 0원 대신 "확인 필요"를 크게 쓴다', () => {
    // 0원을 크게 띄우면 "인수 부담 없음"으로 읽힌다 — 화면에서 가장 큰 값이라 회복이 안 된다
    expect(assumedHeadline({ amount: 0, isLowerBound: true })).toEqual({
      kind: 'UNCONFIRMED',
    });
  });

  it('전원 인수 대상이 아니면 0원이 사실이다', () => {
    expect(assumedHeadline({ amount: 0, isLowerBound: false })).toEqual({
      kind: 'NONE',
    });
  });

  it('확정 금액이 있으면 금액을 쓰고 하한 여부를 함께 넘긴다', () => {
    expect(
      assumedHeadline({ amount: 50_000_000, isLowerBound: true }),
    ).toEqual({ kind: 'AMOUNT', amount: 50_000_000, isLowerBound: true });
  });
});
