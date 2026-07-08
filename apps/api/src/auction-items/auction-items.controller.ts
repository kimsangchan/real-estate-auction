// 물건 조회 컨트롤러 — 목록/단건/지역 집계/지도 뷰포트 읽기 전용 엔드포인트 (WP-02 수집 데이터 소비)
import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { AuctionItemsRepository } from './auction-items.repository';
import type { AuctionItemDto } from './dto/auction-item.dto';
import type { RegionCountDto } from './dto/region-count.dto';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const BBOX_LIMIT = 500;

function parseBboxParam(name: string, value: string | undefined): number {
  if (value === undefined) {
    throw new BadRequestException(`${name} 쿼리 파라미터가 필요해요`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new BadRequestException(`${name} 값이 올바른 숫자가 아니에요: ${value}`);
  }
  return parsed;
}

@Controller('auction-items')
export class AuctionItemsController {
  constructor(private readonly repository: AuctionItemsRepository) {}

  @Get('regions')
  async regions(@Query('sido') sido?: string): Promise<RegionCountDto[]> {
    return sido ? this.repository.countBySigungu(sido) : this.repository.countBySido();
  }

  @Get('bbox')
  async bbox(
    @Query('minLng') minLng?: string,
    @Query('minLat') minLat?: string,
    @Query('maxLng') maxLng?: string,
    @Query('maxLat') maxLat?: string,
  ): Promise<AuctionItemDto[]> {
    return this.repository.findItemsInBbox(
      {
        minLng: parseBboxParam('minLng', minLng),
        minLat: parseBboxParam('minLat', minLat),
        maxLng: parseBboxParam('maxLng', maxLng),
        maxLat: parseBboxParam('maxLat', maxLat),
      },
      BBOX_LIMIT,
    );
  }

  @Get()
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sido') sido?: string,
    @Query('sigungu') sigungu?: string,
  ): Promise<AuctionItemDto[]> {
    const parsedLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const parsedOffset = Math.max(Number(offset) || 0, 0);
    return this.repository.findMany(parsedLimit, parsedOffset, { sido, sigungu });
  }

  @Get(':courtOfficeCode/:caseNo/:itemNo')
  async findOne(
    @Param('courtOfficeCode') courtOfficeCode: string,
    @Param('caseNo') caseNo: string,
    @Param('itemNo') itemNo: string,
  ): Promise<AuctionItemDto> {
    const item = await this.repository.findOne(courtOfficeCode, caseNo, itemNo);
    if (!item) {
      throw new NotFoundException(`물건을 찾을 수 없어요: ${courtOfficeCode}/${caseNo}/${itemNo}`);
    }
    return item;
  }
}
