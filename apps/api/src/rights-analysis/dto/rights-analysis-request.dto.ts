// 권리분석 요청 DTO — 서비스 입력 계약. HTTP Controller가 없으므로 서비스 진입점에서
// validateRightsAnalysisRequest()로 직접 검증한다 (AGENTS.md 규칙 5·21)
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsISO8601, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import type { RegionTier } from '../domain/types';
import { RegisteredRightDto } from './registered-right.dto';
import { TaxClaimDto } from './tax-claim.dto';
import { TenantDto } from './tenant.dto';
import { UnregisteredRiskDto } from './unregistered-risk.dto';

export const REGION_TIERS: RegionTier[] = ['SEOUL', 'OVERCONCENTRATION', 'METRO', 'OTHER'];

export class RightsAnalysisRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RegisteredRightDto)
  registeredRights!: RegisteredRightDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TenantDto)
  tenants!: TenantDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UnregisteredRiskDto)
  unregisteredRisks?: UnregisteredRiskDto[];

  /** 조세채권 — 당해세는 확정일자 임차인보다 앞서 배당된다 */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxClaimDto)
  taxClaims?: TaxClaimDto[];

  @IsIn(REGION_TIERS)
  region!: RegionTier;

  /** 매각결정기일 — 당해세 우선 특례(2023-04-01 시행) 적용 여부 판정용 */
  @IsOptional()
  @IsISO8601({ strict: true })
  saleDecisionDate?: string;

  /** 배당요구종기 (YYYY-MM-DD) */
  @IsISO8601({ strict: true })
  distributionDemandDeadline!: string;

  /** 낙찰대금 — 배당표 계산에 사용. 없으면 배당·총부담액 계산은 생략한다 */
  @IsOptional()
  @IsNumber()
  saleAmount?: number;

  @IsOptional()
  @IsNumber()
  auctionCost?: number;

  /** 총 부담액 계산기 입력 (UX-02) */
  @IsOptional()
  @IsNumber()
  bidPrice?: number;
}
