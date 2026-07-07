// 법원 사건번호 형식 검증 유틸 (예: 2026타경12345) — 외부 입력 검증에 사용 (AGENTS.md 규칙 5)
const CASE_NO_PATTERN = /^\d{4}타경\d{1,10}$/;

export function isValidCaseNo(value: string): boolean {
  return CASE_NO_PATTERN.test(value);
}
