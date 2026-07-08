import { calculateTotalBurden } from './total-burden';

describe('calculateTotalBurden', () => {
  it('인수보증금이 없으면 입찰가만 반환한다', () => {
    const result = calculateTotalBurden(300_000_000, []);

    expect(result.totalAssumedAmount).toBe(0);
    expect(result.totalBurden).toBe(300_000_000);
  });

  it('입찰가와 인수보증금 합계를 계산한다', () => {
    const result = calculateTotalBurden(300_000_000, [50_000_000, 20_000_000]);

    expect(result.totalAssumedAmount).toBe(70_000_000);
    expect(result.totalBurden).toBe(370_000_000);
  });
});
