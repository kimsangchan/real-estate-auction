// 관심 물건 컨트롤러 — 로그인한 사용자 본인의 관심 목록만 조회·등록·해제한다 (JWT guard, WP-08 §1-6)
import { BadRequestException, Controller, Delete, Get, Param, Put, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { FavoriteRecord } from './favorites.repository';
import { FavoritesRepository } from './favorites.repository';

function assertNonEmpty(name: string, value: string): void {
  if (!value || value.trim().length === 0) {
    throw new BadRequestException(`${name} 값이 필요해요`);
  }
}

function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user) {
    throw new UnauthorizedException();
  }
  return req.user.id;
}

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly repository: FavoritesRepository) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest): Promise<FavoriteRecord[]> {
    return this.repository.findByUser(requireUserId(req));
  }

  @Put(':courtOfficeCode/:caseNo/:itemNo')
  async add(
    @Req() req: AuthenticatedRequest,
    @Param('courtOfficeCode') courtOfficeCode: string,
    @Param('caseNo') caseNo: string,
    @Param('itemNo') itemNo: string,
  ): Promise<{ success: true }> {
    assertNonEmpty('courtOfficeCode', courtOfficeCode);
    assertNonEmpty('caseNo', caseNo);
    assertNonEmpty('itemNo', itemNo);

    await this.repository.add(requireUserId(req), courtOfficeCode, caseNo, itemNo);
    return { success: true };
  }

  @Delete(':courtOfficeCode/:caseNo/:itemNo')
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('courtOfficeCode') courtOfficeCode: string,
    @Param('caseNo') caseNo: string,
    @Param('itemNo') itemNo: string,
  ): Promise<{ success: true }> {
    await this.repository.remove(requireUserId(req), courtOfficeCode, caseNo, itemNo);
    return { success: true };
  }
}
