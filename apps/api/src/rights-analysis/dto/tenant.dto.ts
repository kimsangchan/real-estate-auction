// 임차인 입력 DTO — 런타임 검증 후에만 도메인으로 전달한다 (AGENTS.md 규칙 21)
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/** 확정일자별 보증금 몫 — 증액 재계약이 있을 때만 넘긴다 (domain/types.ts DepositTranche) */
export class DepositTrancheDto {
  /** 이 몫의 금액. 증액분이면 늘어난 차액만 (누적 총액이 아니다) */
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsISO8601({ strict: true })
  fixedDate?: string | null;
}

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

  /** 몫을 넘기면 금액 합계가 depositAmount와 같아야 한다 (도메인에서 검증) */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepositTrancheDto)
  depositTranches?: DepositTrancheDto[];

  @IsBoolean()
  demandedDistribution!: boolean;

  @IsOptional()
  @IsISO8601({ strict: true })
  demandedDistributionDate?: string | null;
}
