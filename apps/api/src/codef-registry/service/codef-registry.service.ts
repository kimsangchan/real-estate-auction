// 등기부 커넥터 오케스트레이션 — 캐시 확인 → (미스 시) 조회 → 매핑 → 캐시 저장, 요청ID·물건키·과금여부 로깅.
// 응답 매핑(mapResponse)은 실제 CODEF 응답 스펙에 의존하므로 이 서비스에 하드코딩하지 않고 주입받는다 —
// 스펙이 확정되는 대로 실제 매퍼 구현체를 연결한다 (Known Gap, WP-04 work order 참고).
import { Logger } from '@nestjs/common';
import type { RegisteredRightDto } from '../../rights-analysis/dto/registered-right.dto';
import type { RegistryRequestCache } from '../cache/registry-request-cache';
import type {
  CodefRegistryClient,
  CodefRegistryLookupRequest,
  CodefRegistryRawResponse,
} from '../client/codef-registry.client';

export type RegistryResponseMapper = (raw: CodefRegistryRawResponse) => RegisteredRightDto[];

export interface CodefRegistryLookupParams {
  /** 사건 단위 캐시 키 (예: `${법원사무소코드}:${사건번호}`) — 동일 물건 재조회 시 발급 호출을 막는다 */
  caseKey: string;
  request: CodefRegistryLookupRequest;
}

export class CodefRegistryService {
  private readonly logger = new Logger(CodefRegistryService.name);

  constructor(
    private readonly cache: RegistryRequestCache<RegisteredRightDto[]>,
    private readonly client: CodefRegistryClient,
    private readonly mapResponse: RegistryResponseMapper,
  ) {}

  async getRegisteredRights(
    requestId: string,
    params: CodefRegistryLookupParams,
  ): Promise<RegisteredRightDto[]> {
    this.logger.log(`codef_registry_lookup_start requestId=${requestId} case=${params.caseKey}`);

    // fetcher가 실제로 실행된 호출만 CODEF에 발급을 요청한 것이다 — 캐시 적중이나 동시 요청 dedup으로
    // 재사용된 호출은 fetcher가 실행되지 않으므로 billed=false로 정확히 기록된다.
    let billed = false;

    try {
      const result = await this.cache.getOrFetch(params.caseKey, async () => {
        billed = true;
        const raw = await this.client.lookupWithTwoWay(params.request);
        return this.mapResponse(raw);
      });

      this.logger.log(
        `codef_registry_lookup_success requestId=${requestId} case=${params.caseKey} billed=${billed} rightCount=${result.length}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `codef_registry_lookup_failure requestId=${requestId} case=${params.caseKey} error=${(error as Error).message}`,
      );
      throw error;
    }
  }
}
