import { AuctionItemsRepository } from './auction-items.repository';

function createMockPool(rows: unknown[]) {
  return { query: jest.fn().mockResolvedValue({ rows }) };
}

describe('AuctionItemsRepository', () => {
  it('단건 조회 시 BIGINT 문자열 컬럼을 숫자로, 날짜를 ISO 문자열로 변환한다', async () => {
    const pool = createMockPool([
      {
        courtOfficeCode: 'B000210',
        caseNo: '2025타경755',
        itemNo: '1',
        courtName: '서울중앙지방법원',
        deptName: '경매7계',
        usageName: '상가',
        address: '서울특별시 종로구 인의동 48-2',
        appraisalAmount: '259000000',
        minimumSalePrice: '84869000',
        failedBidCount: 6,
        bidDatetime: new Date('2026-07-16T10:00:00Z'),
      },
    ]);
    const repository = new AuctionItemsRepository(pool as never);

    const result = await repository.findOne('B000210', '2025타경755', '1');

    expect(result).toEqual({
      courtOfficeCode: 'B000210',
      caseNo: '2025타경755',
      itemNo: '1',
      courtName: '서울중앙지방법원',
      deptName: '경매7계',
      usageName: '상가',
      address: '서울특별시 종로구 인의동 48-2',
      appraisalAmount: 259_000_000,
      minimumSalePrice: 84_869_000,
      failedBidCount: 6,
      bidDatetime: '2026-07-16T10:00:00.000Z',
    });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE ac.court_office_code = $1'), [
      'B000210',
      '2025타경755',
      '1',
    ]);
  });

  it('일치하는 물건이 없으면 null을 반환한다', async () => {
    const pool = createMockPool([]);
    const repository = new AuctionItemsRepository(pool as never);

    const result = await repository.findOne('B000210', '없는사건', '1');

    expect(result).toBeNull();
  });

  it('목록 조회는 limit·offset을 바인딩 파라미터로 전달한다', async () => {
    const pool = createMockPool([]);
    const repository = new AuctionItemsRepository(pool as never);

    await repository.findMany(20, 40);

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $1 OFFSET $2'), [20, 40, null, null]);
  });

  it('목록 조회는 sido·sigungu 필터를 바인딩 파라미터로 전달한다', async () => {
    const pool = createMockPool([]);
    const repository = new AuctionItemsRepository(pool as never);

    await repository.findMany(20, 0, { sido: '서울특별시', sigungu: '종로구' });

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("hjguSido' = $3"), [
      20,
      0,
      '서울특별시',
      '종로구',
    ]);
  });

  it('countBySido는 시/도별 건수를 집계한다', async () => {
    const pool = createMockPool([
      { region: '서울특별시', count: '42' },
      { region: '경기도', count: '3' },
    ]);
    const repository = new AuctionItemsRepository(pool as never);

    const result = await repository.countBySido();

    expect(result).toEqual([
      { name: '서울특별시', count: 42 },
      { name: '경기도', count: 3 },
    ]);
  });

  it('countBySigungu는 주어진 시/도 안에서 시/군/구별 건수를 집계한다', async () => {
    const pool = createMockPool([{ region: '종로구', count: '8' }]);
    const repository = new AuctionItemsRepository(pool as never);

    const result = await repository.countBySigungu('서울특별시');

    expect(result).toEqual([{ name: '종로구', count: 8 }]);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("hjguSido' = $1"), ['서울특별시']);
  });

  it('findItemsInBbox는 ST_MakeEnvelope 좌표와 limit을 바인딩 파라미터로 전달한다', async () => {
    const pool = createMockPool([]);
    const repository = new AuctionItemsRepository(pool as never);

    await repository.findItemsInBbox({ minLng: 126.9, minLat: 37.4, maxLng: 127.1, maxLat: 37.6 }, 500);

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('ST_MakeEnvelope($1, $2, $3, $4, 4326)'), [
      126.9,
      37.4,
      127.1,
      37.6,
      500,
    ]);
  });

  it('단건 조회 결과의 좌표(lng/lat)는 그대로 통과시킨다', async () => {
    const pool = createMockPool([
      {
        courtOfficeCode: 'B000210',
        caseNo: '2025타경755',
        itemNo: '1',
        courtName: '서울중앙지방법원',
        deptName: '경매7계',
        usageName: '상가',
        address: '서울특별시 종로구 인의동 48-2',
        appraisalAmount: '259000000',
        minimumSalePrice: '84869000',
        failedBidCount: 6,
        bidDatetime: null,
        lng: 126.998,
        lat: 37.571,
      },
    ]);
    const repository = new AuctionItemsRepository(pool as never);

    const result = await repository.findOne('B000210', '2025타경755', '1');

    expect(result).toMatchObject({ lng: 126.998, lat: 37.571 });
  });
});
