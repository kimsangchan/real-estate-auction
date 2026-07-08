// CODEF 예외 분류 — 재시도 가능(타임아웃/5xx) vs 불가(인증 실패·잔액 부족·대상 없음 등 도메인 오류) (WP-04 요구사항 7)
// 확인된 공통 응답 봉투: { result: { code, message, extraMessage, transactionId }, data }
export const CODEF_SUCCESS_CODE = 'CF-00000';

export interface CodefResultEnvelope {
  code: string;
  message: string;
  extraMessage?: string;
  transactionId?: string | null;
}

/** 네트워크 오류·타임아웃·5xx — 재시도가 의미 있는 일시 오류 */
export class CodefTransientError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
  }
}

/**
 * CODEF가 명시적으로 반환한 실패 코드 — 인증 실패·잔액 부족·대상 없음 등.
 * 코드별 세부 분류(예: 어떤 코드가 "잔액 부족"인지)는 실제 상품 스펙 확인 후 세분화한다 (Known Gap).
 */
export class CodefBusinessError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly transactionId?: string | null,
  ) {
    super(message);
  }
}

export function classifyCodefTransportError(cause: unknown): CodefTransientError {
  return new CodefTransientError(`CODEF 요청 전송 실패: ${(cause as Error).message}`, cause);
}

export function classifyCodefHttpStatus(status: number): CodefTransientError | null {
  if (status >= 500) {
    return new CodefTransientError(`CODEF 서버 오류: HTTP ${status}`);
  }
  return null;
}

export function classifyCodefResult(result: CodefResultEnvelope): CodefBusinessError | null {
  if (result.code === CODEF_SUCCESS_CODE) {
    return null;
  }
  return new CodefBusinessError(result.message, result.code, result.transactionId ?? null);
}
