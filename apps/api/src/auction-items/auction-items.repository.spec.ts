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
        areaKind: '집합건물',
      areaM2: '47.52',
      bulkSale: false,
        address: '서울특별시 종로구 인의동 48-2',
        appraisalAmount: '259000000',
        minimumSalePrice: '84869000',
        failedBidCount: 6,
        bidDatetime: new Date('2026-07-16T10:00:00Z'),
        assumedRightsKind: 'LEASEHOLD_REGISTRATION',
        riskFlags: ['HUG_PRIORITY_WAIVER'],
        tenantCount: '2',
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
      areaKind: 'AGGREGATE',
      areaM2: 47.52,
      bulkSale: false,
      address: '서울특별시 종로구 인의동 48-2',
      appraisalAmount: 259_000_000,
      minimumSalePrice: 84_869_000,
      failedBidCount: 6,
      bidDatetime: '2026-07-16T10:00:00.000Z',
      assumedRightsKind: 'LEASEHOLD_REGISTRATION',
      riskFlags: ['HUG_PRIORITY_WAIVER'],
      tenantCount: 2,
    });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE ac.court_office_code = $1'), [
      'B000210',
      '2025타경755',
      '1',
    ]);
  });

  it('명세서를 못 받은 물건은 인수권리가 null이고 위험 플래그는 빈 배열이다', async () => {
    // "인수할 권리가 없다"와 "아직 확인하지 못했다"는 다르다 — 화면이 구분해 표기할 수 있어야 한다.
    // tenantCount는 컬럼이 없어도 NaN이 되면 안 된다(LEFT JOIN 미스 방어).
    const pool = createMockPool([
      {
        courtOfficeCode: 'B000210',
        caseNo: '2025타경900',
        itemNo: '1',
        courtName: '서울중앙지방법원',
        deptName: null,
        usageName: null,
        address: null,
        appraisalAmount: null,
        minimumSalePrice: null,
        failedBidCount: null,
        bidDatetime: null,
        assumedRightsKind: null,
        riskFlags: null,
        tenantCount: null,
      },
    ]);
    const repository = new AuctionItemsRepository(pool as never);

    const result = await repository.findOne('B000210', '2025타경900', '1');

    expect(result?.assumedRightsKind).toBeNull();
    expect(result?.riskFlags).toEqual([]);
    expect(result?.tenantCount).toBeNull();
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

  it('findPhotos는 물건 → 사건 조인 후 사진 메타를 ITEM 우선·seq 순으로 조회하고 id를 숫자로 변환한다', async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ caseId: '7' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: '93',
              source: 'ITEM',
              seq: 1,
              categoryName: '전경도',
              caption: '건물 전경',
              contentType: 'image/jpeg',
              byteSize: 289045,
            },
          ],
        }),
    };
    const repository = new AuctionItemsRepository(pool as never);

    const result = await repository.findPhotos('B000210', '2022타경101244', '1');

    expect(result).toEqual([
      {
        id: 93,
        source: 'ITEM',
        seq: 1,
        categoryName: '전경도',
        caption: '건물 전경',
        contentType: 'image/jpeg',
        byteSize: 289045,
      },
    ]);
    expect(pool.query).toHaveBeenNthCalledWith(1, expect.stringContaining('WHERE ac.court_office_code = $1'), [
      'B000210',
      '2022타경101244',
      '1',
    ]);
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("ORDER BY CASE WHEN source = 'ITEM' THEN 0 ELSE 1 END, seq"),
      ['7'],
    );
  });

  it('findPhotos는 물건이 없으면 사진 조회 없이 null을 반환한다', async () => {
    const pool = createMockPool([]);
    const repository = new AuctionItemsRepository(pool as never);

    const result = await repository.findPhotos('B000210', '없는사건', '1');

    expect(result).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('findPhotos는 물건은 있는데 사진이 없으면 빈 배열을 반환한다', async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ caseId: '7' }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const repository = new AuctionItemsRepository(pool as never);

    const result = await repository.findPhotos('B000210', '2022타경101244', '1');

    expect(result).toEqual([]);
  });

  it('findPhotoBytes는 content_type과 바이트를 돌려주고, 없으면 null이다', async () => {
    const bytes = Buffer.from([1, 2, 3]);
    const pool = createMockPool([{ contentType: 'image/jpeg', bytes }]);
    const repository = new AuctionItemsRepository(pool as never);

    expect(await repository.findPhotoBytes('93')).toEqual({ contentType: 'image/jpeg', bytes });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('FROM auction_case_photo WHERE id = $1'), [
      '93',
    ]);

    const emptyPool = createMockPool([]);
    const emptyRepository = new AuctionItemsRepository(emptyPool as never);
    expect(await emptyRepository.findPhotoBytes('999999')).toBeNull();
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

describe('findNoticeAnalysis — 명세서만으로 하는 권리분석 (등기부 없음)', () => {
  function createNoticePool(notice: unknown, tenants: unknown[]) {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: notice === null ? [] : [notice] })
      .mockResolvedValueOnce({ rows: tenants });
    return { query };
  }

  const notice = {
    id: '398',
    documentDate: new Date(2026, 5, 17), // 로컬 자정 — pg가 date 컬럼을 이렇게 준다
    baselineRaw: '2024.02.19. 압류',
    baselineDate: new Date(2024, 1, 19),
    distributionDemandDeadline: new Date(2025, 0, 22),
    assumedRightsKind: 'LEASEHOLD_REGISTRATION',
    riskFlags: [],
  };

  it('date 컬럼을 하루 밀리지 않게 변환한다 — 대항력은 하루 차이로 뒤집힌다', async () => {
    // toISOString()을 쓰면 KST(UTC+9)에서 전날이 된다: 2020-07-29 → 2020-07-28
    const pool = createNoticePool(notice, [
      {
        tenantSeq: 1,
        sourceKind: '권리신고',
        occupiedPart: '202호',
        moveInDate: new Date(2020, 6, 29),
        fixedDate: new Date(2023, 11, 20),
        depositAmount: '50000000',
        demandedDistribution: true,
        demandedDistributionDate: new Date(2024, 9, 25),
      },
    ]);
    const repository = new AuctionItemsRepository(pool as never);

    const result = await repository.findNoticeAnalysis('B000211', '2024타경63301', '1');

    expect(result?.baselineDate).toBe('2024-02-19');
    expect(result?.distributionDemandDeadline).toBe('2025-01-22');
    expect(result?.tenants[0]).toMatchObject({
      moveInDate: '2020-07-29',
      fixedDate: '2023-12-20',
      demandedDistributionDate: '2024-10-25',
      possessionRightDate: '2020-07-30',
      hasPriority: true,
      distributionDemandEffective: true,
      assumption: 'ASSUMED_AMOUNT_UNKNOWN',
      depositAmount: 50_000_000,
    });
  });

  it('점유자 성명을 응답에 담지 않는다 — 법원이 공개한 제3자 개인정보다', async () => {
    const pool = createNoticePool(notice, [
      {
        tenantSeq: 1,
        sourceKind: '현황조사',
        occupiedPart: '202호',
        moveInDate: new Date(2020, 6, 29),
        fixedDate: null,
        depositAmount: null,
        demandedDistribution: null,
        demandedDistributionDate: null,
      },
    ]);
    const repository = new AuctionItemsRepository(pool as never);

    const result = await repository.findNoticeAnalysis('B000211', '2024타경63301', '1');

    expect(JSON.stringify(result)).not.toContain('tenantName');
    // 조회 SQL 자체가 성명 컬럼을 읽지 않아야 한다 — 응답에 섞일 경로를 만들지 않는다
    const tenantSql = (pool.query.mock.calls[1]?.[0] ?? '') as string;
    expect(tenantSql).not.toContain('tenant_name');
  });

  it('명세서를 못 받았으면 null — 빈 결과는 "인수할 권리 없음"으로 읽힌다', async () => {
    const pool = createNoticePool(null, []);
    const repository = new AuctionItemsRepository(pool as never);

    expect(await repository.findNoticeAnalysis('B000211', '2024타경63301', '1')).toBeNull();
  });
});
