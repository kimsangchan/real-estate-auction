import { CodefTokenClient } from '../auth/codef-token.client';
import { CodefBusinessError, CodefTransientError } from './codef-errors';
import { CodefRegistryClient } from './codef-registry.client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

/** CODEF 실제 응답 형태 재현 — 본문 전체가 application/x-www-form-urlencoded로 인코딩돼 있다 (실호출로 확인) */
function formEncodedResponse(status: number, body: unknown): Response {
  const encoded = encodeURIComponent(JSON.stringify(body)).replace(/%20/g, '+');
  return new Response(encoded, { status, headers: { 'Content-Type': 'text/plain;charset=ISO-8859-1' } });
}

function fakeTokenClient(token = 'access-token'): CodefTokenClient {
  return { getAccessToken: jest.fn().mockResolvedValue(token) } as unknown as CodefTokenClient;
}

describe('CodefRegistryClient', () => {
  const config = { apiBaseUrl: 'https://development.codef.io' };

  it('토큰을 Bearer 헤더에 담아 확정된 경로로 조회한다', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(jsonResponse(200, { result: { code: 'CF-00000', message: 'ok' }, data: { foo: 'bar' } }));
    const client = new CodefRegistryClient(config, fakeTokenClient('access-token'), fetchFn as unknown as typeof fetch);

    const result = await client.lookup({ organization: '0002' });

    expect(result.data).toEqual({ foo: 'bar' });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://development.codef.io/v1/kr/public/ck/real-estate-register/status',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
  });

  it('CODEF의 실제 응답 형식(전체 form-urlencoded, text/plain)을 올바르게 디코딩한다', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      formEncodedResponse(200, {
        result: { code: 'CF-00000', message: '성공' },
        data: { resRealty: '서울특별시 중구 오장동 145-1' },
      }),
    );
    const client = new CodefRegistryClient(config, fakeTokenClient(), fetchFn as unknown as typeof fetch);

    const result = await client.lookup({ organization: '0002' });

    expect(result.data).toEqual({ resRealty: '서울특별시 중구 오장동 145-1' });
  });

  it('5xx 응답은 CodefTransientError(재시도 가능)로 던진다', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(503, { result: {}, data: {} }));
    const client = new CodefRegistryClient(config, fakeTokenClient(), fetchFn as unknown as typeof fetch);

    await expect(client.lookup({})).rejects.toThrow(CodefTransientError);
  });

  it('네트워크 오류는 CodefTransientError로 감싼다', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const client = new CodefRegistryClient(config, fakeTokenClient(), fetchFn as unknown as typeof fetch);

    await expect(client.lookup({})).rejects.toThrow(CodefTransientError);
  });

  it('CODEF가 실패 코드를 반환하면 CodefBusinessError(재시도 불가)로 던진다', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      jsonResponse(200, { result: { code: 'CF-09002', message: 'organization을 올바르게 입력했는지 확인하세요.' }, data: {} }),
    );
    const client = new CodefRegistryClient(config, fakeTokenClient(), fetchFn as unknown as typeof fetch);

    await expect(client.lookup({ organization: 'wrong' })).rejects.toThrow(CodefBusinessError);
  });

  describe('lookupWithTwoWay', () => {
    const TWO_WAY_DATA = {
      continue2Way: true,
      method: '추가인증방식',
      jobIndex: 0,
      threadIndex: 0,
      jti: 'jti-1',
      twoWayTimestamp: '123',
      extraInfo: { resAddrList: [{ resUserNm: '', commUniqueNo: 'unique-1', commAddrLotNumber: '', resState: '', resType: '' }] },
    };
    const FINAL_DATA = { commIssueCode: '00', resRegisterEntriesList: [] };

    it('2-Way 응답이 없으면 첫 조회 결과를 그대로 반환한다', async () => {
      const fetchFn = jest.fn().mockResolvedValue(jsonResponse(200, { result: { code: 'CF-00000', message: 'ok' }, data: FINAL_DATA }));
      const client = new CodefRegistryClient(config, fakeTokenClient(), fetchFn as unknown as typeof fetch);

      const result = await client.lookupWithTwoWay({ organization: '0002' });

      expect(result.data).toEqual(FINAL_DATA);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('후보 1건인 2-Way 응답을 받으면 자동으로 재요청해 최종 응답을 반환한다', async () => {
      const fetchFn = jest
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, { result: { code: 'CF-00000', message: 'ok' }, data: TWO_WAY_DATA }))
        .mockResolvedValueOnce(jsonResponse(200, { result: { code: 'CF-00000', message: 'ok' }, data: FINAL_DATA }));
      const client = new CodefRegistryClient(config, fakeTokenClient(), fetchFn as unknown as typeof fetch);

      const result = await client.lookupWithTwoWay({ organization: '0002' });

      expect(result.data).toEqual(FINAL_DATA);
      expect(fetchFn).toHaveBeenCalledTimes(2);
      const secondCallBody = JSON.parse((fetchFn.mock.calls[1]?.[1] as { body: string }).body);
      expect(secondCallBody.uniqueNo).toBe('unique-1');
      expect(secondCallBody.is2Way).toBe(true);
      expect(secondCallBody.twoWayInfo).toEqual({ jobIndex: 0, threadIndex: 0, jti: 'jti-1', twoWayTimestamp: '123' });
    });

    it('후보가 여러 건이면 기본 resolver가 오류를 던지고 재요청하지 않는다', async () => {
      const ambiguous = {
        ...TWO_WAY_DATA,
        extraInfo: {
          resAddrList: [
            { resUserNm: '', commUniqueNo: 'a', commAddrLotNumber: '', resState: '', resType: '' },
            { resUserNm: '', commUniqueNo: 'b', commAddrLotNumber: '', resState: '', resType: '' },
          ],
        },
      };
      const fetchFn = jest.fn().mockResolvedValue(jsonResponse(200, { result: { code: 'CF-00000', message: 'ok' }, data: ambiguous }));
      const client = new CodefRegistryClient(config, fakeTokenClient(), fetchFn as unknown as typeof fetch);

      await expect(client.lookupWithTwoWay({ organization: '0002' })).rejects.toThrow();
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
  });
});
