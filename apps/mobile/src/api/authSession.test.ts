import {
  getGenericPassword,
  resetGenericPassword,
  setGenericPassword,
} from 'react-native-keychain';
import { authedFetch } from './authSession';

jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
}));

const mockedGetGenericPassword = getGenericPassword as jest.Mock;
const mockedSetGenericPassword = setGenericPassword as jest.Mock;
const mockedResetGenericPassword = resetGenericPassword as jest.Mock;

function response(status: number, body: unknown = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

const TOKEN_PAIR = { accessToken: 'new-access', refreshToken: 'new-refresh' };

/** fetch 호출의 Authorization 헤더를 읽는다 */
function authHeaderOf(call: unknown[]): string | null {
  const init = call[1] as RequestInit | undefined;
  return new Headers(init?.headers).get('Authorization');
}

describe('authedFetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetGenericPassword.mockResolvedValue({
      username: 'refresh',
      password: 'stored-refresh',
    });
  });

  it('401이 아니면 리프레시 없이 첫 응답을 반환한다', async () => {
    const fetchMock = jest.fn().mockResolvedValue(response(200, []));
    globalThis.fetch = fetchMock;

    const result = await authedFetch('/favorites');

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('401이면 리프레시 후 원요청을 한 번 재시도하고, 재시도는 새 액세스 토큰을 쓴다', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, TOKEN_PAIR))
      .mockResolvedValueOnce(response(200, []));
    globalThis.fetch = fetchMock;

    const result = await authedFetch('/favorites');

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain('/auth/refresh');
    // 회전된 토큰을 실제로 쓰지 않으면 재시도는 매번 401이 된다 — 개수만 세면 못 잡는다.
    expect(authHeaderOf(fetchMock.mock.calls[2])).toBe(
      `Bearer ${TOKEN_PAIR.accessToken}`,
    );
    expect(mockedSetGenericPassword).toHaveBeenCalledWith(
      'refresh',
      TOKEN_PAIR.refreshToken,
      expect.anything(),
    );
  });

  it('재시도도 401이면 더 시도하지 않고 세션을 비운다 (1회 한정)', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, TOKEN_PAIR))
      .mockResolvedValueOnce(response(401));
    globalThis.fetch = fetchMock;

    const result = await authedFetch('/favorites');

    expect(result.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(mockedResetGenericPassword).toHaveBeenCalled();
  });

  it('리프레시가 401이면 세션을 비운다', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(401));
    globalThis.fetch = fetchMock;

    const result = await authedFetch('/favorites');

    expect(result.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mockedResetGenericPassword).toHaveBeenCalled();
  });

  it('리프레시가 서버 오류(5xx)면 저장된 토큰을 지우지 않는다', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(503));
    globalThis.fetch = fetchMock;

    const result = await authedFetch('/favorites');

    expect(result.status).toBe(401);
    // 서버가 잠깐 죽었다고 로그인을 영구히 풀면 안 된다.
    expect(mockedResetGenericPassword).not.toHaveBeenCalled();
  });

  it('리프레시가 네트워크 오류로 깨져도 저장된 토큰을 지우지 않는다', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockRejectedValueOnce(new Error('network'));
    globalThis.fetch = fetchMock;

    const result = await authedFetch('/favorites');

    expect(result.status).toBe(401);
    expect(mockedResetGenericPassword).not.toHaveBeenCalled();
  });

  it('동시에 401을 받아도 리프레시는 한 번만 나간다 (재사용 오판 방지)', async () => {
    let refreshCalls = 0;
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (String(url).includes('/auth/refresh')) {
        refreshCalls += 1;
        return new Promise(resolve =>
          setTimeout(() => resolve(response(200, TOKEN_PAIR)), 10),
        );
      }
      return Promise.resolve(response(refreshCalls === 0 ? 401 : 200, []));
    });
    globalThis.fetch = fetchMock;

    const [a, b] = await Promise.all([
      authedFetch('/favorites'),
      authedFetch('/favorites'),
    ]);

    expect(refreshCalls).toBe(1);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
  });

  it('저장된 리프레시 토큰이 없으면 리프레시를 시도하지 않는다', async () => {
    mockedGetGenericPassword.mockResolvedValue(false);
    const fetchMock = jest.fn().mockResolvedValueOnce(response(401));
    globalThis.fetch = fetchMock;

    const result = await authedFetch('/favorites');

    expect(result.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
