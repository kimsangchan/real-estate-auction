import {
  getGenericPassword,
  resetGenericPassword,
} from 'react-native-keychain';
import { authedFetch } from './authSession';

jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
}));

const mockedGetGenericPassword = getGenericPassword as jest.Mock;
const mockedResetGenericPassword = resetGenericPassword as jest.Mock;

function response(status: number, body: unknown = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

const TOKEN_PAIR = { accessToken: 'new-access', refreshToken: 'new-refresh' };

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

  it('401이면 리프레시 후 원요청을 한 번 재시도한다', async () => {
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

  it('리프레시 자체가 실패하면 재시도하지 않고 세션을 비운다', async () => {
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

  it('저장된 리프레시 토큰이 없으면 리프레시를 시도하지 않는다', async () => {
    mockedGetGenericPassword.mockResolvedValue(false);
    const fetchMock = jest.fn().mockResolvedValueOnce(response(401));
    globalThis.fetch = fetchMock;

    const result = await authedFetch('/favorites');

    expect(result.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
