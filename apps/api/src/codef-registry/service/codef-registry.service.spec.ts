import { Logger } from '@nestjs/common';
import { RegistryRequestCache } from '../cache/registry-request-cache';
import type { CodefRegistryClient, CodefRegistryRawResponse } from '../client/codef-registry.client';
import { CodefRegistryService, type RegistryResponseMapper } from './codef-registry.service';

function fakeClient(raw: CodefRegistryRawResponse): CodefRegistryClient {
  return { lookupWithTwoWay: jest.fn().mockResolvedValue(raw) } as unknown as CodefRegistryClient;
}

const SUCCESS_RAW: CodefRegistryRawResponse = { result: { code: 'CF-00000', message: 'ok' }, data: {} };
const FAKE_RIGHTS = [{ id: 'r1', type: 'MORTGAGE' as const, receivedDate: '2024-01-01' }];
const identityMapper: RegistryResponseMapper = () => FAKE_RIGHTS;

describe('CodefRegistryService', () => {
  it('첫 조회는 실제 클라이언트를 호출해 매핑 결과를 반환한다', async () => {
    const client = fakeClient(SUCCESS_RAW);
    const service = new CodefRegistryService(new RegistryRequestCache(), client, identityMapper);

    const result = await service.getRegisteredRights('req-1', { caseKey: 'B000210:2024타경1', request: {} });

    expect(result).toEqual(FAKE_RIGHTS);
    expect(client.lookupWithTwoWay).toHaveBeenCalledTimes(1);
  });

  it('같은 물건을 재조회하면 캐시를 사용해 외부 호출이 0회다', async () => {
    const client = fakeClient(SUCCESS_RAW);
    const service = new CodefRegistryService(new RegistryRequestCache(), client, identityMapper);
    const params = { caseKey: 'B000210:2024타경1', request: {} };

    await service.getRegisteredRights('req-1', params);
    await service.getRegisteredRights('req-2', params);

    expect(client.lookupWithTwoWay).toHaveBeenCalledTimes(1);
  });

  it('같은 물건을 동시에 조회해도 외부 호출은 1회만 발생한다', async () => {
    const client = fakeClient(SUCCESS_RAW);
    const service = new CodefRegistryService(new RegistryRequestCache(), client, identityMapper);
    const params = { caseKey: 'B000210:2024타경1', request: {} };

    await Promise.all([
      service.getRegisteredRights('req-1', params),
      service.getRegisteredRights('req-2', params),
    ]);

    expect(client.lookupWithTwoWay).toHaveBeenCalledTimes(1);
  });

  it('동시 요청 중 실제로 발급을 호출한 한쪽만 billed=true로 로그된다', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const client = fakeClient(SUCCESS_RAW);
    const service = new CodefRegistryService(new RegistryRequestCache(), client, identityMapper);
    const params = { caseKey: 'B000210:2024타경1', request: {} };

    await Promise.all([
      service.getRegisteredRights('req-1', params),
      service.getRegisteredRights('req-2', params),
    ]);

    const successLogs = logSpy.mock.calls.map((call) => String(call[0])).filter((m) => m.includes('success'));
    const billedTrueCount = successLogs.filter((m) => m.includes('billed=true')).length;
    const billedFalseCount = successLogs.filter((m) => m.includes('billed=false')).length;

    expect(billedTrueCount).toBe(1);
    expect(billedFalseCount).toBe(1);
    logSpy.mockRestore();
  });

  it('클라이언트 오류는 그대로 전파하고 캐시에 남기지 않는다', async () => {
    const client = {
      lookupWithTwoWay: jest.fn().mockRejectedValue(new Error('일시 오류')),
    } as unknown as CodefRegistryClient;
    const service = new CodefRegistryService(new RegistryRequestCache(), client, identityMapper);
    const params = { caseKey: 'B000210:2024타경1', request: {} };

    await expect(service.getRegisteredRights('req-1', params)).rejects.toThrow('일시 오류');
  });
});
