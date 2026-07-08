// CODEF 2-Way(2단계) 인증 흐름 — 주소 검색이 여러 물건과 매칭되면 후보 목록을 돌려주고,
// jobIndex/threadIndex/jti/twoWayTimestamp를 그대로 실어 재요청해야 최종 응답을 받는다.
// 확인된 스펙(2026-07-08, 사용자 제공): "추가인증방식" — 주소 후보 선택 흐름만 확인됨.
// SMS/ARS 등 사용자 입력이 필요한 다른 2-Way 방식은 미확인 — 만나면 명시적으로 오류를 던진다.
import type { CodefRegisterAddressCandidate } from '../mapper/codef-register-response';

export interface CodefTwoWayContinuation {
  continue2Way: true;
  method: string;
  jobIndex: number;
  threadIndex: number;
  jti: string;
  twoWayTimestamp: string | number;
  extraInfo?: { resAddrList?: CodefRegisterAddressCandidate[] };
}

export function isTwoWayContinuation(data: unknown): data is CodefTwoWayContinuation {
  return (
    typeof data === 'object' && data !== null && (data as Record<string, unknown>).continue2Way === true
  );
}

export function buildTwoWayContinuationRequest(
  originalRequest: Record<string, unknown>,
  continuation: CodefTwoWayContinuation,
  uniqueNo: string,
): Record<string, unknown> {
  return {
    ...originalRequest,
    uniqueNo,
    is2Way: true,
    twoWayInfo: {
      jobIndex: continuation.jobIndex,
      threadIndex: continuation.threadIndex,
      jti: continuation.jti,
      twoWayTimestamp: continuation.twoWayTimestamp,
    },
  };
}

export class UnsupportedTwoWayMethodError extends Error {
  constructor(method: string) {
    super(`지원하지 않는 2-Way 인증 방식입니다: ${method} — 주소 후보 선택 흐름만 자동 처리한다`);
  }
}

export class AmbiguousAddressCandidateError extends Error {
  constructor(readonly candidates: CodefRegisterAddressCandidate[]) {
    super(`주소 검색 결과가 ${candidates.length}건이라 자동으로 하나를 고를 수 없습니다`);
  }
}

/** 주소 후보가 정확히 1건이면 그 고유번호를 고른다 — 0건/여러 건이면 명시적으로 예외를 던진다. */
export function resolveSingleAddressCandidate(continuation: CodefTwoWayContinuation): string {
  const candidates = continuation.extraInfo?.resAddrList ?? [];
  if (candidates.length !== 1) {
    throw candidates.length === 0
      ? new UnsupportedTwoWayMethodError(continuation.method)
      : new AmbiguousAddressCandidateError(candidates);
  }

  const uniqueNo = candidates[0]?.commUniqueNo;
  if (!uniqueNo) {
    throw new UnsupportedTwoWayMethodError(continuation.method);
  }
  return uniqueNo;
}
