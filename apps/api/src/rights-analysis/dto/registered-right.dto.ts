// 등기 권리 입력 DTO — 런타임 검증 후에만 도메인으로 전달한다 (AGENTS.md 규칙 21)
import { IsBoolean, IsIn, IsISO8601, IsNumber, IsOptional, IsString } from 'class-validator';
import type { RegisteredRightType } from '../domain/types';

export const REGISTERED_RIGHT_TYPES: RegisteredRightType[] = [
  'MORTGAGE',
  'SEIZURE',
  'PROVISIONAL_SEIZURE',
  'COLLATERAL_PROVISIONAL_REGISTRATION',
  'AUCTION_COMMENCEMENT',
  'LEASEHOLD',
  'SUPERFICIES',
  'EASEMENT',
  'PROVISIONAL_REGISTRATION',
  'PROVISIONAL_DISPOSITION',
];

export class RegisteredRightDto {
  @IsString()
  id!: string;

  @IsIn(REGISTERED_RIGHT_TYPES)
  type!: RegisteredRightType;

  @IsISO8601({ strict: true })
  receivedDate!: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsBoolean()
  isWholeBuilding?: boolean;

  @IsOptional()
  @IsBoolean()
  demandedDistribution?: boolean;
}
