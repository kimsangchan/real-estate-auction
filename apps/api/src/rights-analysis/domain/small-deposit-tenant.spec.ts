import {
  classifySmallDepositTenant,
  NoMortgageReferenceDateError,
  resolveMortgageReferenceDate,
} from './small-deposit-tenant';
import type { RegisteredRight, Tenant } from './types';

function tenant(overrides: Partial<Tenant> & Pick<Tenant, 'id' | 'depositAmount'>): Tenant {
  return {
    moveInDate: '2024-01-01',
    fixedDate: null,
    demandedDistribution: false,
    demandedDistributionDate: null,
    ...overrides,
  };
}

describe('resolveMortgageReferenceDate', () => {
  it('여러 담보물권 중 가장 이른 설정일을 기준으로 삼는다', () => {
    const rights: RegisteredRight[] = [
      { id: 'r1', type: 'MORTGAGE', receivedDate: '2022-05-01' },
      { id: 'r2', type: 'COLLATERAL_PROVISIONAL_REGISTRATION', receivedDate: '2020-01-01' },
      { id: 'r3', type: 'SEIZURE', receivedDate: '2019-01-01' },
    ];

    expect(resolveMortgageReferenceDate(rights)).toBe('2020-01-01');
  });

  it('담보물권이 없으면 경매개시결정등기일로 대체한다', () => {
    const rights: RegisteredRight[] = [
      { id: 'r1', type: 'SEIZURE', receivedDate: '2022-01-01' },
      { id: 'r2', type: 'AUCTION_COMMENCEMENT', receivedDate: '2024-03-01' },
    ];

    expect(resolveMortgageReferenceDate(rights)).toBe('2024-03-01');
  });

  it('담보물권도 경매개시결정등기도 없으면 오류를 던진다', () => {
    const rights: RegisteredRight[] = [{ id: 'r1', type: 'SEIZURE', receivedDate: '2022-01-01' }];

    expect(() => resolveMortgageReferenceDate(rights)).toThrow(NoMortgageReferenceDateError);
  });
});

describe('classifySmallDepositTenant', () => {
  it('보증금이 상한 이하면 소액임차인으로 인정하고 상한 내에서 전액 최우선변제한다', () => {
    const result = classifySmallDepositTenant(
      tenant({ id: 't1', depositAmount: 50_000_000 }),
      'SEOUL',
      '2024-01-01',
    );

    expect(result.isEligible).toBe(true);
    expect(result.priorityRepaymentAmount).toBe(50_000_000);
    expect(result.ruleId).toBe('SMALL_DEPOSIT_TENANT_2023-02-21');
  });

  it('보증금이 최우선변제 상한을 초과하면 상한까지만 변제한다', () => {
    const result = classifySmallDepositTenant(
      tenant({ id: 't1', depositAmount: 160_000_000 }),
      'SEOUL',
      '2024-01-01',
    );

    expect(result.isEligible).toBe(true);
    expect(result.priorityRepaymentAmount).toBe(55_000_000);
  });

  it('보증금이 지역 상한을 초과하면 소액임차인이 아니다', () => {
    const result = classifySmallDepositTenant(
      tenant({ id: 't1', depositAmount: 200_000_000 }),
      'SEOUL',
      '2024-01-01',
    );

    expect(result.isEligible).toBe(false);
    expect(result.priorityRepaymentAmount).toBe(0);
  });

  it('경계: 담보 설정일이 시행령 개정일 당일이면 새 기준을 적용한다', () => {
    const result = classifySmallDepositTenant(
      tenant({ id: 't1', depositAmount: 140_000_000 }),
      'SEOUL',
      '2023-02-21',
    );

    // 2023-02-21 기준 서울 상한은 165,000,000원 — 신 기준이 적용돼 소액임차인으로 인정된다
    expect(result.isEligible).toBe(true);
    expect(result.ruleId).toBe('SMALL_DEPOSIT_TENANT_2023-02-21');
  });
});
