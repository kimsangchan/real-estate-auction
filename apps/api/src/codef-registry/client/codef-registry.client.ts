// 등기부 조회 전송 계층 — 인증·전송·오류 분류·2-Way 인증 흐름을 담당한다. 요청 필드 구성(payload)은
// 이 클라이언트의 책임이 아니다 — `registry-lookup-request.ts`의 request builder가 조립한다.
//
// 확인된 사실(2026-07-08 실호출·문서 검증): 엔드포인트 경로, 공통 응답 봉투(result/data),
// organization="0002"가 대법원 인터넷등기소를 가리킴, 요청 스키마 전체 필드명.
import type { CodefTokenClient } from '../auth/codef-token.client';
import {
  buildTwoWayContinuationRequest,
  isTwoWayContinuation,
  resolveSingleAddressCandidate,
  type CodefTwoWayContinuation,
} from './codef-two-way';
import {
  classifyCodefHttpStatus,
  classifyCodefResult,
  classifyCodefTransportError,
  type CodefResultEnvelope,
} from './codef-errors';

export interface CodefRegistryRawResponse {
  result: CodefResultEnvelope;
  data: unknown;
}

export interface CodefRegistryClientConfig {
  apiBaseUrl: string;
}

/** 등기부 조회 요청 필드 — 실제 스펙 확정 전까지는 호출자가 구성한 raw payload를 그대로 전달한다. */
export type CodefRegistryLookupRequest = Record<string, unknown>;

const REGISTRY_LOOKUP_PATH = '/v1/kr/public/ck/real-estate-register/status';

/**
 * CODEF는 응답을 `Content-Type: text/plain`으로 보내고, 본문 전체를
 * application/x-www-form-urlencoded 방식(%XX + '+'는 공백)으로 인코딩한다 — 실호출로 확인(2026-07-08).
 * `response.json()`은 이 형식에서 항상 SyntaxError를 던지므로 직접 디코딩한다.
 * 이미 정상 JSON(테스트 mock 등)이면 그대로 파싱되므로 안전하다.
 */
async function parseCodefResponseBody(response: Response): Promise<CodefRegistryRawResponse> {
  const rawText = await response.text();
  try {
    return JSON.parse(rawText) as CodefRegistryRawResponse;
  } catch {
    const decoded = decodeURIComponent(rawText.replace(/\+/g, ' '));
    return JSON.parse(decoded) as CodefRegistryRawResponse;
  }
}

export class CodefRegistryClient {
  constructor(
    private readonly config: CodefRegistryClientConfig,
    private readonly tokenClient: CodefTokenClient,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async lookup(request: CodefRegistryLookupRequest): Promise<CodefRegistryRawResponse> {
    const token = await this.tokenClient.getAccessToken();

    let response: Response;
    try {
      response = await this.fetchFn(`${this.config.apiBaseUrl}${REGISTRY_LOOKUP_PATH}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
    } catch (cause) {
      throw classifyCodefTransportError(cause);
    }

    const transientError = classifyCodefHttpStatus(response.status);
    if (transientError) {
      throw transientError;
    }

    const envelope = await parseCodefResponseBody(response);
    const businessError = classifyCodefResult(envelope.result);
    if (businessError) {
      throw businessError;
    }

    return envelope;
  }

  /**
   * 주소 검색이 여러 물건과 매칭되면 CODEF가 `continue2Way` 응답을 돌려준다 — 후보를 골라
   * jobIndex/threadIndex/jti/twoWayTimestamp를 실어 재요청해야 최종 응답을 받는다.
   * 기본 동작은 후보가 정확히 1건일 때만 자동으로 이어간다(resolveCandidate로 교체 가능).
   */
  async lookupWithTwoWay(
    request: CodefRegistryLookupRequest,
    resolveCandidate: (continuation: CodefTwoWayContinuation) => string = resolveSingleAddressCandidate,
    maxRounds = 3,
  ): Promise<CodefRegistryRawResponse> {
    let currentRequest = request;
    let response = await this.lookup(currentRequest);

    for (let round = 0; isTwoWayContinuation(response.data) && round < maxRounds; round += 1) {
      const uniqueNo = resolveCandidate(response.data);
      currentRequest = buildTwoWayContinuationRequest(currentRequest, response.data, uniqueNo);
      response = await this.lookup(currentRequest);
    }

    return response;
  }
}
