import { PermissionsAndroid, Platform } from 'react-native';
import { getToken, onTokenRefresh } from '@react-native-firebase/messaging';
import { registerDeviceToken, unregisterDeviceToken } from '../api/notifications';
import { clearPushRegistration, syncPushRegistration } from './push';

jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(() => ({})),
  getToken: jest.fn(),
  onTokenRefresh: jest.fn(),
}));
jest.mock('../api/notifications', () => ({
  registerDeviceToken: jest.fn(),
  unregisterDeviceToken: jest.fn(),
}));

const mockedGetToken = getToken as jest.Mock;
const mockedOnTokenRefresh = onTokenRefresh as jest.Mock;
const mockedRegister = registerDeviceToken as jest.Mock;
const mockedUnregister = unregisterDeviceToken as jest.Mock;

// RN jest 프리셋의 Platform.OS 기본값은 ios라 안드로이드 경로를 명시적으로 켠다.
function setPlatform(os: string, version: number): void {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  Object.defineProperty(Platform, 'Version', { value: version, configurable: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform('android', 33);
  mockedGetToken.mockResolvedValue('fcm-token');
  mockedRegister.mockResolvedValue(true);
  mockedUnregister.mockResolvedValue(true);
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('syncPushRegistration', () => {
  it('권한이 허용되면 토큰을 등록한다', async () => {
    await syncPushRegistration();

    expect(mockedRegister).toHaveBeenCalledWith('fcm-token', 'android');
  });

  it('이미 허용된 상태면 권한 창을 다시 띄우지 않는다', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
    const request = jest.spyOn(PermissionsAndroid, 'request');

    await syncPushRegistration();

    expect(request).not.toHaveBeenCalled();
    expect(mockedRegister).toHaveBeenCalled();
  });

  it('권한을 거부하면 토큰을 요청하지도 등록하지도 않는다 (T-04)', async () => {
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);

    await syncPushRegistration();

    expect(mockedGetToken).not.toHaveBeenCalled();
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it('Android 12 이하는 런타임 권한 없이 바로 등록한다', async () => {
    setPlatform('android', 32);
    const request = jest.spyOn(PermissionsAndroid, 'request');

    await syncPushRegistration();

    expect(request).not.toHaveBeenCalled();
    expect(mockedRegister).toHaveBeenCalledWith('fcm-token', 'android');
  });

  it('토큰 갱신 구독을 건다 — 갱신분을 올리지 않으면 서버 토큰이 죽는다', async () => {
    await syncPushRegistration();

    expect(mockedOnTokenRefresh).toHaveBeenCalled();
    const handler = mockedOnTokenRefresh.mock.calls[0][1] as (token: string) => void;
    handler('rotated-token');
    await Promise.resolve();

    expect(mockedRegister).toHaveBeenCalledWith('rotated-token', 'android');
  });

  it('토큰 발급이 실패해도 예외를 밖으로 던지지 않는다 (로그인 흐름 보호)', async () => {
    mockedGetToken.mockRejectedValue(new Error('no play services'));

    await expect(syncPushRegistration()).resolves.toBeUndefined();
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it('등록 호출이 깨져도 예외를 밖으로 던지지 않는다', async () => {
    mockedRegister.mockRejectedValue(new Error('network'));

    await expect(syncPushRegistration()).resolves.toBeUndefined();
  });
});

describe('clearPushRegistration', () => {
  it('등록했던 토큰을 서버에서 지운다', async () => {
    await syncPushRegistration();
    await clearPushRegistration();

    expect(mockedUnregister).toHaveBeenCalledWith('fcm-token');
  });

  it('이번 세션에 등록하지 않았어도 기기 토큰으로 해제를 시도한다', async () => {
    // 권한을 껐다 켠 뒤 재실행하면 캐시는 비어 있지만 서버 행은 남아 있다.
    await clearPushRegistration();

    expect(mockedUnregister).toHaveBeenCalledWith('fcm-token');
  });

  it('기기에 토큰이 없으면 아무 것도 부르지 않는다', async () => {
    mockedGetToken.mockResolvedValue(null);

    await clearPushRegistration();

    expect(mockedUnregister).not.toHaveBeenCalled();
  });

  it('서버에 못 닿아도 예외를 밖으로 던지지 않는다 (로그아웃은 진행)', async () => {
    mockedUnregister.mockRejectedValue(new Error('network'));

    await expect(clearPushRegistration()).resolves.toBeUndefined();
  });
});
