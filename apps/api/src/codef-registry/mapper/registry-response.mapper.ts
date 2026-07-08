// CODEF 등기부등본 응답 → WP-03 RegisteredRightDto[] 정규화.
// 실제 응답(2026-07-08 실호출 확인) 기준: resRegistrationSumList는 이미 말소된 권리를 제외한 현재
// 유효 권리만 담고 있다 — WP-03이 날짜 비교로 인수/말소를 직접 판정하므로 그대로 사용한다.
// 구획(갑구/을구) 중 "등기목적" 컬럼이 있는 것만 권리 표로 간주한다(소유지분현황·개별공시지가 등은 제외).
import type { RegisteredRightDto } from '../../rights-analysis/dto/registered-right.dto';
import type { CodefRegistryRawResponse } from '../client/codef-registry.client';
import type { CodefRegisterOutput, CodefRegisterSection } from './codef-register-response';
import { resolveRegistrationPurposeType } from './registration-purpose';
import { getColumn, hasColumn, parseRegistryRows, type RegistryRow } from './registry-row-table';
import { extractMaxClaimAmount, extractReceivedDate } from './registry-text-parser';

export class UnparseableRegistrationEntryError extends Error {
  constructor(rank: string, rawText: string) {
    super(`등기 항목(순위번호 ${rank})에서 접수일자를 추출하지 못했습니다: ${rawText}`);
  }
}

function mapRow(row: RegistryRow): RegisteredRightDto | null {
  const purposeText = getColumn(row, '등기목적');
  if (!purposeText) {
    return null;
  }

  const type = resolveRegistrationPurposeType(purposeText);
  if (!type) {
    // 소유권보존·소유권이전 등 WP-03 범위 밖 등기목적은 건너뛴다
    return null;
  }

  const rank = getColumn(row, '순위번호') ?? purposeText;
  const receivedText = getColumn(row, '접수정보', '접수');
  const receivedDate = receivedText ? extractReceivedDate(receivedText) : null;
  if (!receivedDate) {
    throw new UnparseableRegistrationEntryError(rank, receivedText ?? '');
  }

  const amountText = getColumn(row, '주요등기사항', '등기원인', '권리자 및 기타사항') ?? '';
  const amount = extractMaxClaimAmount(amountText);

  return {
    id: rank,
    type,
    receivedDate,
    ...(amount !== null ? { amount } : {}),
  } as RegisteredRightDto;
}

function mapRightsSection(section: CodefRegisterSection): RegisteredRightDto[] {
  if (!hasColumn(section, '등기목적')) {
    return [];
  }
  return parseRegistryRows(section)
    .map(mapRow)
    .filter((dto): dto is RegisteredRightDto => dto !== null);
}

export function mapRegistryResponseToRegisteredRights(
  raw: CodefRegistryRawResponse,
): RegisteredRightDto[] {
  const data = raw.data as CodefRegisterOutput;

  return data.resRegisterEntriesList.flatMap((entry) =>
    entry.resRegistrationSumList.flatMap(mapRightsSection),
  );
}
