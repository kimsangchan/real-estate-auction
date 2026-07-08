// 등기부등본 "접수정보"·"주요등기사항"/"등기원인" 컬럼 텍스트에서 접수일자·채권최고액(또는 청구금액)을
// 추출한다. 실제 응답(2026-07-08 실호출 확인)에서: 접수정보 컬럼 값은 "OOOO년 O월 O일\n제OOOO호" 형태로
// "접수"라는 단어 자체는 포함하지 않는다(컬럼 헤더에만 있음). 금액은 근저당권은 "채권최고액",
// 가압류·강제경매는 "청구금액" 문구를 쓴다.
const RECEIVED_DATE_PATTERN = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/;
const MAX_CLAIM_AMOUNT_PATTERN = /(?:채권최고액|청구금액)\s*금?\s*([0-9,]+)\s*원/;

export function extractReceivedDate(text: string): string | null {
  const match = RECEIVED_DATE_PATTERN.exec(text);
  const year = match?.[1];
  const month = match?.[2];
  const day = match?.[3];
  if (!year || !month || !day) {
    return null;
  }
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function extractMaxClaimAmount(text: string): number | null {
  const digits = MAX_CLAIM_AMOUNT_PATTERN.exec(text)?.[1];
  if (!digits) {
    return null;
  }
  const amount = Number(digits.replace(/,/g, ''));
  return Number.isFinite(amount) ? amount : null;
}
