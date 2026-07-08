import { findBaselineRight, NoBaselineRightError } from './baseline-right';
import type { RegisteredRight } from './types';

function right(
  overrides: Partial<RegisteredRight> & Pick<RegisteredRight, 'id' | 'type' | 'receivedDate'>,
): RegisteredRight {
  return { ...overrides };
}

describe('findBaselineRight', () => {
  it('근저당 1건만 있으면 그 권리가 말소기준이 된다', () => {
    const rights: RegisteredRight[] = [right({ id: 'r1', type: 'MORTGAGE', receivedDate: '2024-01-10' })];

    const result = findBaselineRight(rights);

    expect(result.rightId).toBe('r1');
    expect(result.receivedDate).toBe('2024-01-10');
    expect(result.ruleId).toBe('BASELINE_RIGHT');
    expect(result.ruleVersion).toBe(1);
  });

  it('여러 후보 중 접수일이 가장 빠른 권리를 고른다', () => {
    const rights: RegisteredRight[] = [
      right({ id: 'r1', type: 'MORTGAGE', receivedDate: '2024-03-01' }),
      right({ id: 'r2', type: 'SEIZURE', receivedDate: '2024-01-15' }),
      right({ id: 'r3', type: 'AUCTION_COMMENCEMENT', receivedDate: '2024-06-01' }),
    ];

    expect(findBaselineRight(rights).rightId).toBe('r2');
  });

  it('건물 전부 + 배당요구한 선순위 전세권은 말소기준 후보에 포함된다', () => {
    const rights: RegisteredRight[] = [
      right({ id: 'r1', type: 'MORTGAGE', receivedDate: '2024-05-01' }),
      right({
        id: 'r2',
        type: 'LEASEHOLD',
        receivedDate: '2024-01-01',
        isWholeBuilding: true,
        demandedDistribution: true,
      }),
    ];

    expect(findBaselineRight(rights).rightId).toBe('r2');
  });

  it('건물 전부가 아니거나 배당요구 안 한 전세권은 말소기준 후보에서 제외된다', () => {
    const rights: RegisteredRight[] = [
      right({ id: 'r1', type: 'MORTGAGE', receivedDate: '2024-05-01' }),
      right({
        id: 'r2',
        type: 'LEASEHOLD',
        receivedDate: '2024-01-01',
        isWholeBuilding: true,
        demandedDistribution: false,
      }),
    ];

    expect(findBaselineRight(rights).rightId).toBe('r1');
  });

  it('후보가 없으면 명시적 오류를 던진다', () => {
    const rights: RegisteredRight[] = [
      right({ id: 'r1', type: 'SUPERFICIES', receivedDate: '2024-01-01' }),
    ];

    expect(() => findBaselineRight(rights)).toThrow(NoBaselineRightError);
  });
});
