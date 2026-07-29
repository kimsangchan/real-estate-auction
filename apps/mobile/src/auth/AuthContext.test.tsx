import React from 'react';
import { Text } from 'react-native';
import { Linking } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import {
  completeLogin,
  fetchCurrentUser,
  logout,
  restoreSession,
} from '../api/authSession';
import { AuthProvider, useAuth } from './AuthContext';

// 푸시 등록은 네이티브 모듈을 타므로 여기서는 흐름만 확인한다 (전용 테스트는 notifications/push.test.ts)
jest.mock('../notifications/push', () => ({
  syncPushRegistration: jest.fn().mockResolvedValue(undefined),
  clearPushRegistration: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../api/authSession', () => ({
  completeLogin: jest.fn(),
  deleteAccount: jest.fn(),
  fetchCurrentUser: jest.fn(),
  logout: jest.fn(),
  restoreSession: jest.fn(),
  startLogin: jest.fn(),
}));

const mockedCompleteLogin = completeLogin as jest.Mock;
const mockedFetchCurrentUser = fetchCurrentUser as jest.Mock;
const mockedLogout = logout as jest.Mock;
const mockedRestoreSession = restoreSession as jest.Mock;

type UrlHandler = (event: { url: string }) => void;
let urlHandler: UrlHandler | undefined;
let mounted: TestRenderer.ReactTestRenderer | undefined;

function Probe() {
  const { status, user, signOut } = useAuth();
  // 상태 전환을 문자열로 노출해 단언한다. signOut은 렌더 트리에 실어 테스트에서 호출한다.
  return (
    <Text accessibilityLabel="probe" onPress={signOut}>
      {`${status}:${user?.nickname ?? '-'}`}
    </Text>
  );
}

async function renderProvider() {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    renderer = TestRenderer.create(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
  });
  if (!renderer) throw new Error('renderer not created');
  mounted = renderer;
  return renderer;
}

const stateOf = (renderer: TestRenderer.ReactTestRenderer): string =>
  String(
    renderer.root.findAll(node => node.props.accessibilityLabel === 'probe')[0]
      ?.props.children,
  );

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    urlHandler = undefined;
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest
      .spyOn(Linking, 'addEventListener')
      .mockImplementation((_event: string, handler: UrlHandler) => {
        urlHandler = handler;
        return { remove: jest.fn() } as never;
      });
  });

  afterEach(async () => {
    await act(async () => {
      mounted?.unmount();
    });
    mounted = undefined;
    jest.restoreAllMocks();
  });

  it('저장된 세션을 되살리면 로그인 상태가 된다', async () => {
    mockedRestoreSession.mockResolvedValue(true);
    mockedFetchCurrentUser.mockResolvedValue({ nickname: '홍길동' });

    const renderer = await renderProvider();

    expect(stateOf(renderer)).toBe('authenticated:홍길동');
  });

  it('되살릴 세션이 없으면 비로그인 상태가 된다', async () => {
    mockedRestoreSession.mockResolvedValue(false);

    const renderer = await renderProvider();

    expect(stateOf(renderer)).toBe('anonymous:-');
    expect(mockedFetchCurrentUser).not.toHaveBeenCalled();
  });

  it('세션 복구가 예외로 깨져도 로딩에 갇히지 않고 비로그인으로 떨어진다', async () => {
    mockedRestoreSession.mockRejectedValue(new Error('network'));

    const renderer = await renderProvider();

    expect(stateOf(renderer)).toBe('anonymous:-');
  });

  it('딥링크로 깨어나면 교환 코드로 로그인한다', async () => {
    jest
      .spyOn(Linking, 'getInitialURL')
      .mockResolvedValue('auction://auth/callback?code=abc');
    mockedCompleteLogin.mockResolvedValue(true);
    mockedFetchCurrentUser.mockResolvedValue({ nickname: '카카오사용자' });

    const renderer = await renderProvider();

    expect(mockedCompleteLogin).toHaveBeenCalledWith('abc');
    // 딥링크 로그인이 성공했으면 저장 토큰 복구로 덮어쓰지 않는다.
    expect(mockedRestoreSession).not.toHaveBeenCalled();
    expect(stateOf(renderer)).toBe('authenticated:카카오사용자');
  });

  it('앱이 떠 있는 동안 도착한 딥링크로도 로그인한다', async () => {
    mockedRestoreSession.mockResolvedValue(false);
    const renderer = await renderProvider();
    expect(stateOf(renderer)).toBe('anonymous:-');

    mockedCompleteLogin.mockResolvedValue(true);
    mockedFetchCurrentUser.mockResolvedValue({ nickname: '홍길동' });
    await act(async () => {
      urlHandler?.({ url: 'auction://auth/callback?code=abc' });
    });

    expect(stateOf(renderer)).toBe('authenticated:홍길동');
  });

  it('이미 소비된 딥링크가 다시 도착해도 로그인 상태를 잃지 않는다', async () => {
    mockedRestoreSession.mockResolvedValue(true);
    mockedFetchCurrentUser.mockResolvedValue({ nickname: '홍길동' });
    const renderer = await renderProvider();
    expect(stateOf(renderer)).toBe('authenticated:홍길동');

    // 브라우저 탭 복원·타 앱이 던진 딥링크 — 교환은 실패한다.
    mockedCompleteLogin.mockResolvedValue(false);
    await act(async () => {
      urlHandler?.({ url: 'auction://auth/callback?code=stale' });
    });

    expect(stateOf(renderer)).toBe('authenticated:홍길동');
  });

  it('딥링크 교환이 예외로 깨져도 로그인 상태를 잃지 않는다', async () => {
    mockedRestoreSession.mockResolvedValue(true);
    mockedFetchCurrentUser.mockResolvedValue({ nickname: '홍길동' });
    const renderer = await renderProvider();

    mockedCompleteLogin.mockRejectedValue(new Error('network'));
    await act(async () => {
      urlHandler?.({ url: 'auction://auth/callback?code=boom' });
    });

    expect(stateOf(renderer)).toBe('authenticated:홍길동');
  });

  it('로그아웃하면 비로그인 상태가 된다', async () => {
    mockedRestoreSession.mockResolvedValue(true);
    mockedFetchCurrentUser.mockResolvedValue({ nickname: '홍길동' });
    mockedLogout.mockResolvedValue(undefined);
    const renderer = await renderProvider();

    await act(async () => {
      renderer.root
        .findAll(node => node.props.accessibilityLabel === 'probe')[0]
        ?.props.onPress();
    });

    expect(stateOf(renderer)).toBe('anonymous:-');
  });
});
