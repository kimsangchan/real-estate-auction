// 알림 페이로드 → 물건 상세 라우트 파라미터 (WP-09 §1-9).
// FCM data는 문자열만 담기므로 세 키가 모두 문자열로 채워졌을 때만 유효한 라우트로 본다.
export interface ItemRoute {
  courtOfficeCode: string;
  caseNo: string;
  itemNo: string;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

export function parseItemRoute(data: unknown): ItemRoute | null {
  if (!data || typeof data !== 'object') return null;

  const { courtOfficeCode, caseNo, itemNo } = data as Record<string, unknown>;
  if (!isNonEmptyString(courtOfficeCode) || !isNonEmptyString(caseNo) || !isNonEmptyString(itemNo)) {
    return null;
  }

  return { courtOfficeCode, caseNo, itemNo };
}
