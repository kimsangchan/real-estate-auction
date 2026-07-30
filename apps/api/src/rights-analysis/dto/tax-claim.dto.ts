// 조세채권 입력 DTO — 배당 순위를 등기 접수일이 아니라 법정기일로 다투므로 등기 권리와 분리한다
import { IsBoolean, IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class TaxClaimDto {
  @IsString()
  id!: string;

  /** 당해세 여부 — 종부세·상속세·증여세·재산세 등 그 부동산 자체에 부과된 세금 */
  @IsBoolean()
  isPropertyTax!: boolean;

  /** 법정기일 (YYYY-MM-DD) */
  @IsISO8601({ strict: true })
  statutoryDate!: string;

  /** 체납액 — 외부에서 알 수 없는 것이 정상이라 선택 입력이다 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}
