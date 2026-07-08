// 등기부 외 위험 신호 입력 DTO (예: 매각물건명세서의 유치권 신고 키워드 탐지 결과)
import { IsIn, IsString } from 'class-validator';
import type { UnregisteredRiskType } from '../domain/types';

export const UNREGISTERED_RISK_TYPES: UnregisteredRiskType[] = [
  'LIEN',
  'STATUTORY_SUPERFICIES',
  'GRAVE_BASE_RIGHT',
];

export class UnregisteredRiskDto {
  @IsString()
  id!: string;

  @IsIn(UNREGISTERED_RISK_TYPES)
  type!: UnregisteredRiskType;
}
