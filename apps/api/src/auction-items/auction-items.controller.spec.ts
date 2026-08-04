import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuctionItemsController } from './auction-items.controller';
import type { AuctionItemDto } from './dto/auction-item.dto';

const sampleItem: AuctionItemDto = {
  courtOfficeCode: 'B000210',
  caseNo: '2025타경755',
  itemNo: '1',
  courtName: '서울중앙지방법원',
  deptName: '경매7계',
  usageName: '상가',
  areaM2: 47.52,
  address: '서울특별시 종로구 인의동 48-2',
  appraisalAmount: 259_000_000,
  minimumSalePrice: 84_869_000,
  failedBidCount: 6,
  bidDatetime: '2026-07-16T10:00:00.000Z',
  assumedRightsKind: null,
  riskFlags: [],
  tenantCount: null,
  lng: 127.0,
  lat: 37.5,
};

describe('AuctionItemsController', () => {
  it('물건을 찾으면 그대로 반환한다', async () => {
    const repository = { findOne: jest.fn().mockResolvedValue(sampleItem), findMany: jest.fn() };
    const controller = new AuctionItemsController(repository as never);

    const result = await controller.findOne('B000210', '2025타경755', '1');

    expect(result).toBe(sampleItem);
  });

  it('물건을 찾지 못하면 NotFoundException을 던진다', async () => {
    const repository = { findOne: jest.fn().mockResolvedValue(null), findMany: jest.fn() };
    const controller = new AuctionItemsController(repository as never);

    await expect(controller.findOne('B000210', '없는사건', '1')).rejects.toThrow(NotFoundException);
  });

  it('list는 limit을 최대 100으로 제한하고 기본값 20을 쓴다', async () => {
    const repository = { findOne: jest.fn(), findMany: jest.fn().mockResolvedValue([]) };
    const controller = new AuctionItemsController(repository as never);

    await controller.list('500', '10');

    expect(repository.findMany).toHaveBeenCalledWith(100, 10, { sido: undefined, sigungu: undefined });

    await controller.list(undefined, undefined);

    expect(repository.findMany).toHaveBeenCalledWith(20, 0, { sido: undefined, sigungu: undefined });
  });

  it('list는 sido·sigungu 쿼리를 리포지토리에 그대로 전달한다', async () => {
    const repository = { findOne: jest.fn(), findMany: jest.fn().mockResolvedValue([]) };
    const controller = new AuctionItemsController(repository as never);

    await controller.list(undefined, undefined, '서울특별시', '종로구');

    expect(repository.findMany).toHaveBeenCalledWith(20, 0, { sido: '서울특별시', sigungu: '종로구' });
  });

  it('regions는 sido가 없으면 시/도 집계를, 있으면 시/군/구 집계를 반환한다', async () => {
    const repository = {
      countBySido: jest.fn().mockResolvedValue([{ name: '서울특별시', count: 42 }]),
      countBySigungu: jest.fn().mockResolvedValue([{ name: '종로구', count: 8 }]),
    };
    const controller = new AuctionItemsController(repository as never);

    expect(await controller.regions()).toEqual([{ name: '서울특별시', count: 42 }]);
    expect(await controller.regions('서울특별시')).toEqual([{ name: '종로구', count: 8 }]);
    expect(repository.countBySigungu).toHaveBeenCalledWith('서울특별시');
  });

  it('bbox는 4개 좌표를 리포지토리에 전달한다', async () => {
    const repository = { findItemsInBbox: jest.fn().mockResolvedValue([sampleItem]) };
    const controller = new AuctionItemsController(repository as never);

    const result = await controller.bbox('126.9', '37.4', '127.1', '37.6');

    expect(result).toEqual([sampleItem]);
    expect(repository.findItemsInBbox).toHaveBeenCalledWith(
      { minLng: 126.9, minLat: 37.4, maxLng: 127.1, maxLat: 37.6 },
      500,
    );
  });

  it('bbox는 좌표 파라미터가 없거나 숫자가 아니면 BadRequestException을 던진다', async () => {
    const repository = { findItemsInBbox: jest.fn() };
    const controller = new AuctionItemsController(repository as never);

    await expect(controller.bbox(undefined, '37.4', '127.1', '37.6')).rejects.toThrow(BadRequestException);
    await expect(controller.bbox('abc', '37.4', '127.1', '37.6')).rejects.toThrow(BadRequestException);
  });

  it('photos는 물건이 있으면 사진 메타 배열을(빈 배열 포함) 그대로 반환한다', async () => {
    const meta = [
      { id: 93, source: 'ITEM', seq: 1, categoryName: '전경도', caption: '건물 전경', contentType: 'image/jpeg', byteSize: 289045 },
    ];
    const repository = { findPhotos: jest.fn().mockResolvedValue(meta) };
    const controller = new AuctionItemsController(repository as never);

    expect(await controller.photos('B000210', '2022타경101244', '1')).toBe(meta);

    repository.findPhotos.mockResolvedValue([]);
    expect(await controller.photos('B000210', '2022타경101244', '1')).toEqual([]);
  });

  it('photos는 물건이 없으면(null) NotFoundException을 던진다', async () => {
    const repository = { findPhotos: jest.fn().mockResolvedValue(null) };
    const controller = new AuctionItemsController(repository as never);

    await expect(controller.photos('B000210', '없는사건', '1')).rejects.toThrow(NotFoundException);
  });

  it('photoImage는 바이너리를 Content-Type·캐시 헤더와 함께 내려준다', async () => {
    const bytes = Buffer.from([1, 2, 3]);
    const repository = { findPhotoBytes: jest.fn().mockResolvedValue({ contentType: 'image/jpeg', bytes }) };
    const controller = new AuctionItemsController(repository as never);
    const res = { statusCode: 0, setHeader: jest.fn(), end: jest.fn() };

    await controller.photoImage('93', res as never);

    expect(repository.findPhotoBytes).toHaveBeenCalledWith('93');
    expect(res.statusCode).toBe(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=86400, immutable');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Length', 3);
    expect(res.end).toHaveBeenCalledWith(bytes);
  });

  it('photoImage는 content_type이 없으면 application/octet-stream을 쓴다', async () => {
    const repository = {
      findPhotoBytes: jest.fn().mockResolvedValue({ contentType: null, bytes: Buffer.alloc(1) }),
    };
    const controller = new AuctionItemsController(repository as never);
    const res = { statusCode: 0, setHeader: jest.fn(), end: jest.fn() };

    await controller.photoImage('93', res as never);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/octet-stream');
  });

  it('photoImage는 없는 id·숫자가 아닌 id에 NotFoundException을 던진다', async () => {
    const repository = { findPhotoBytes: jest.fn().mockResolvedValue(null) };
    const controller = new AuctionItemsController(repository as never);
    const res = { statusCode: 0, setHeader: jest.fn(), end: jest.fn() };

    await expect(controller.photoImage('999999', res as never)).rejects.toThrow(NotFoundException);

    // 숫자가 아니면 DB 조회 없이 404 — bigint 캐스팅 에러(500) 방지
    await expect(controller.photoImage('abc', res as never)).rejects.toThrow(NotFoundException);
    expect(repository.findPhotoBytes).toHaveBeenCalledTimes(1);
    expect(res.end).not.toHaveBeenCalled();
  });
});
