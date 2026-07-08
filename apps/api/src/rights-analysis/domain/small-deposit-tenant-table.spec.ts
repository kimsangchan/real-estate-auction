import { findApplicableSmallDepositRule, NoSmallDepositTenantRuleError } from './small-deposit-tenant-table';

describe('findApplicableSmallDepositRule', () => {
  it('현행(2023-02-21) 이후 날짜는 최신 기준을 적용한다', () => {
    const rule = findApplicableSmallDepositRule('2026-07-08');

    expect(rule.effectiveDate).toBe('2023-02-21');
    expect(rule.depositCapByRegion.SEOUL).toBe(165_000_000);
    expect(rule.priorityRepaymentCapByRegion.SEOUL).toBe(55_000_000);
  });

  it('경계: 시행일 당일 설정된 담보물권은 새 기준을 적용한다', () => {
    const rule = findApplicableSmallDepositRule('2023-02-21');

    expect(rule.effectiveDate).toBe('2023-02-21');
  });

  it('경계: 시행일 하루 전 설정된 담보물권은 이전 기준을 적용한다', () => {
    const rule = findApplicableSmallDepositRule('2023-02-20');

    expect(rule.effectiveDate).toBe('2021-05-11');
  });

  it('과거 개정 시점 사이의 날짜는 그 시점 기준을 적용한다', () => {
    const rule = findApplicableSmallDepositRule('2015-01-01');

    expect(rule.effectiveDate).toBe('2014-01-01');
  });

  it('제도 최초 시행일보다 이전이면 명시적 오류를 던진다', () => {
    expect(() => findApplicableSmallDepositRule('1980-01-01')).toThrow(NoSmallDepositTenantRuleError);
  });
});
