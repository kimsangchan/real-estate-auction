import { FavoritesRepository } from './favorites.repository';

function createMockPool(rows: unknown[] = []) {
  return { query: jest.fn().mockResolvedValue({ rows }) };
}

describe('FavoritesRepository', () => {
  it('findByUser는 해당 유저의 관심 물건을 auction_item과 조인해 카드 표시용 필드까지 반환한다', async () => {
    const rows = [
      {
        courtOfficeCode: 'B000210',
        caseNo: '2025타경755',
        itemNo: '1',
        courtName: '서울중앙지방법원',
        deptName: '경매7계',
        usageName: '상가',
        exclusiveAreaM2: '47.52',
        address: '서울특별시 종로구 인의동 48-2',
        appraisalAmount: '259000000',
        minimumSalePrice: '84869000',
        failedBidCount: 6,
        bidDatetime: new Date('2026-07-16T10:00:00Z'),
        lng: 126.998,
        lat: 37.571,
        assumedRightsKind: 'NONE',
        riskFlags: ['HUG_PRIORITY_WAIVER'],
        tenantCount: '1',
        favoritedAt: new Date('2026-07-20T00:00:00Z'),
      },
    ];
    const pool = createMockPool(rows);
    const repository = new FavoritesRepository(pool as never);

    const result = await repository.findByUser('user-1');

    expect(result).toEqual([
      {
        courtOfficeCode: 'B000210',
        caseNo: '2025타경755',
        itemNo: '1',
        courtName: '서울중앙지방법원',
        deptName: '경매7계',
        usageName: '상가',
        exclusiveAreaM2: 47.52,
        address: '서울특별시 종로구 인의동 48-2',
        appraisalAmount: 259_000_000,
        minimumSalePrice: 84_869_000,
        failedBidCount: 6,
        bidDatetime: '2026-07-16T10:00:00.000Z',
        lng: 126.998,
        lat: 37.571,
        assumedRightsKind: 'NONE',
        riskFlags: ['HUG_PRIORITY_WAIVER'],
        tenantCount: 1,
        favoritedAt: '2026-07-20T00:00:00.000Z',
      },
    ]);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE f.user_id = $1'), ['user-1']);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('JOIN auction_case ac'), ['user-1']);
  });

  it('findByUser는 관심 등록이 없으면 빈 배열을 반환한다', async () => {
    const pool = createMockPool([]);
    const repository = new FavoritesRepository(pool as never);

    const result = await repository.findByUser('user-1');

    expect(result).toEqual([]);
  });

  it('add는 ON CONFLICT DO NOTHING으로 중복 등록을 멱등하게 만든다', async () => {
    const pool = createMockPool();
    const repository = new FavoritesRepository(pool as never);

    await repository.add('user-1', 'B000210', '2025타경755', '1');

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (user_id, court_office_code, case_no, item_no) DO NOTHING'), [
      'user-1',
      'B000210',
      '2025타경755',
      '1',
    ]);
  });

  it('remove는 해당 유저·물건 조합만 지운다', async () => {
    const pool = createMockPool();
    const repository = new FavoritesRepository(pool as never);

    await repository.remove('user-1', 'B000210', '2025타경755', '1');

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM favorite'), [
      'user-1',
      'B000210',
      '2025타경755',
      '1',
    ]);
  });
});
