// 물건 조회 컨트롤러 — 목록/단건/지역 집계/지도 뷰포트/사건 사진 읽기 전용 엔드포인트 (WP-02 수집 데이터 소비)
import type { ServerResponse } from 'node:http';
import { BadRequestException, Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { AuctionItemsRepository } from './auction-items.repository';
import type { AuctionCasePhotoDto } from './dto/auction-case-photo.dto';
import type { AuctionItemDto } from './dto/auction-item.dto';
import type { NoticeAnalysisDto } from './dto/notice-analysis.dto';
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

  // 상세 라우트(:courtOfficeCode/:caseNo/:itemNo)보다 먼저 선언해야 한다 — NestJS는 선언 순서로 매칭한다
  @Get('photos/:id')
  async photoImage(@Param('id') id: string, @Res() res: ServerResponse): Promise<void> {
    // 숫자가 아닌 id는 DB bigint 캐스팅 에러(500)가 나므로 먼저 걸러 404로 처리한다
    const photo = /^\d+$/.test(id) ? await this.repository.findPhotoBytes(id) : null;
    if (!photo) {
      throw new NotFoundException(`사진을 찾을 수 없어요: ${id}`);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', photo.contentType ?? 'application/octet-stream');
    // 사진은 변하지 않고 바이트가 커서 캐싱이 중요하다 — 하루 캐시 + immutable
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('Content-Length', photo.bytes.length);
    res.end(photo.bytes);
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

  @Get(':courtOfficeCode/:caseNo/:itemNo/photos')
  async photos(
    @Param('courtOfficeCode') courtOfficeCode: string,
    @Param('caseNo') caseNo: string,
    @Param('itemNo') itemNo: string,
  ): Promise<AuctionCasePhotoDto[]> {
    const photos = await this.repository.findPhotos(courtOfficeCode, caseNo, itemNo);
    if (!photos) {
      throw new NotFoundException(`물건을 찾을 수 없어요: ${courtOfficeCode}/${caseNo}/${itemNo}`);
    }
    return photos;
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

  /**
   * 매각물건명세서 기반 권리분석. 등기부(CODEF, WP-04)가 없어도 대항력 판정과
   * "배당요구를 안 했으면 전액 인수"까지는 확정된다.
   *
   * 명세서를 아직 못 받은 물건은 404 — 빈 결과로 주면 "인수할 권리가 없다"로 읽힌다.
   */
  @Get(':courtOfficeCode/:caseNo/:itemNo/notice-analysis')
  async noticeAnalysis(
    @Param('courtOfficeCode') courtOfficeCode: string,
    @Param('caseNo') caseNo: string,
    @Param('itemNo') itemNo: string,
  ): Promise<NoticeAnalysisDto> {
    const analysis = await this.repository.findNoticeAnalysis(courtOfficeCode, caseNo, itemNo);
    if (!analysis) {
      throw new NotFoundException(`매각물건명세서를 아직 받지 못했어요: ${caseNo} ${itemNo}`);
    }
    return analysis;
  }
}
