// FCM 클라이언트 테스트 — 네트워크는 fetch 스텁으로 대신하고, 응답 코드 해석만 못박는다.
// 400을 "죽은 토큰"으로 오판하면 물건 하나의 데이터 이상이 그 물건 등록자 전원의 토큰을 지운다.
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FcmClient, FcmUnavailableError } from './fcm.client';

const MESSAGE = { title: '제목', body: '본문', data: { itemNo: '3' } };

let accountPath: string;
const originalFetch = globalThis.fetch;

const jsonResponse = (status: number, body: unknown = {}): Response =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response;

const tokenResponse = () => jsonResponse(200, { access_token: 'access-1', expires_in: 3600 });

beforeAll(() => {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  accountPath = join(tmpdir(), `fcm-test-${randomUUID()}.json`);
  writeFileSync(
    accountPath,
    JSON.stringify({
      client_email: 'test@example.iam.gserviceaccount.com',
      private_key: privateKey,
      project_id: 'test-project',
    }),
  );
});

afterAll(() => {
  unlinkSync(accountPath);
  globalThis.fetch = originalFetch;
});

describe('FcmClient.send', () => {
  it('200이면 sent', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(200)) as typeof globalThis.fetch;

    expect(await new FcmClient(accountPath).send('tok', MESSAGE)).toBe('sent');
  });

  it('404면 죽은 토큰으로 본다', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(404, { error: { status: 'UNREGISTERED' } })) as typeof globalThis.fetch;

    expect(await new FcmClient(accountPath).send('tok', MESSAGE)).toBe('unregistered');
  });

  it('400 INVALID_ARGUMENT는 죽은 토큰이 아니다 — 페이로드 문제일 수 있다', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        jsonResponse(400, { error: { status: 'INVALID_ARGUMENT' } }),
      ) as typeof globalThis.fetch;

    // unregistered로 판정하면 호출부가 멀쩡한 기기의 토큰을 지운다.
    expect(await new FcmClient(accountPath).send('tok', MESSAGE)).toBe('failed');
  });

  it('네트워크 실패는 failed로 삼키고 토큰을 건드리지 않는다', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockRejectedValueOnce(new Error('ECONNRESET')) as typeof globalThis.fetch;

    expect(await new FcmClient(accountPath).send('tok', MESSAGE)).toBe('failed');
  });

  it('액세스 토큰을 못 받으면 개별 실패가 아니라 실행 중단 신호를 던진다', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(jsonResponse(401, {})) as typeof globalThis.fetch;

    await expect(new FcmClient(accountPath).send('tok', MESSAGE)).rejects.toThrow(
      FcmUnavailableError,
    );
  });

  it('액세스 토큰은 캐시해 매 발송마다 새로 받지 않는다', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValue(jsonResponse(200));
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const client = new FcmClient(accountPath);
    await client.send('tok-1', MESSAGE);
    await client.send('tok-2', MESSAGE);

    const tokenCalls = fetchMock.mock.calls.filter(call =>
      String(call[0]).includes('oauth2.googleapis.com'),
    );
    expect(tokenCalls).toHaveLength(1);
  });

  it('expires_in이 없어도 캐시가 꺼지지 않는다 (NaN 만료 방지)', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'access-1' }))
      .mockResolvedValue(jsonResponse(200));
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const client = new FcmClient(accountPath);
    await client.send('tok-1', MESSAGE);
    await client.send('tok-2', MESSAGE);

    const tokenCalls = fetchMock.mock.calls.filter(call =>
      String(call[0]).includes('oauth2.googleapis.com'),
    );
    expect(tokenCalls).toHaveLength(1);
  });

  it('지나치게 긴 문구는 잘라 보낸다 — 크기 초과로 발송 전체가 깨지지 않게', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(200));
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    await new FcmClient(accountPath).send('tok', {
      title: 'ㄱ'.repeat(500),
      body: 'ㄴ'.repeat(2000),
      data: {},
    });

    const sendCall = fetchMock.mock.calls.find(call => String(call[0]).includes('fcm.googleapis.com'));
    const payload = JSON.parse(String((sendCall?.[1] as RequestInit).body)) as {
      message: { notification: { title: string; body: string } };
    };
    expect(payload.message.notification.title.length).toBeLessThanOrEqual(200);
    expect(payload.message.notification.body.length).toBeLessThanOrEqual(800);
  });

  it('서비스 계정 파일에 필수 필드가 없으면 즉시 실패한다', () => {
    const badPath = join(tmpdir(), `fcm-bad-${randomUUID()}.json`);
    writeFileSync(badPath, JSON.stringify({ project_id: 'x' }));

    expect(() => new FcmClient(badPath)).toThrow();
    unlinkSync(badPath);
  });
});
