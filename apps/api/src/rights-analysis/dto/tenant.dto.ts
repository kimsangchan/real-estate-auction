// 임차인 입력 DTO — 런타임 검증 후에만 도메인으로 전달한다 (AGENTS.md 규칙 21)
import { IsBoolean, IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class TenantDto {
  @IsString()
  id!: string;

  @IsISO8601({ strict: true })
  moveInDate!: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  fixedDate?: string | null;

  @IsNumber()
  @Min(0)
  depositAmount!: number;

  @IsBoolean()
  demandedDistribution!: boolean;

  @IsOptional()
  @IsISO8601({ strict: true })
  demandedDistributionDate?: string | null;
}
