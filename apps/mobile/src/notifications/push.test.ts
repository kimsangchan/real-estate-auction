import { PermissionsAndroid, Platform } from 'react-native';
import { getToken } from '@react-native-firebase/messaging';
import {
  registerDeviceToken,
  unregisterDeviceToken,
} from '../api/notifications';
import { clearPushRegistration, syncPushRegistration } from './push';

jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(() => ({})),
  getToken: jest.fn(),
}));
jest.mock('../api/notifications', () => ({
  registerDeviceToken: jest.fn(),
  unregisterDeviceToken: jest.fn(),
}));

const mockedGetToken = getToken as jest.Mock;
const mockedRegister = registerDeviceToken as jest.Mock;
const mockedUnregister = unregisterDeviceToken as jest.Mock;

// RN jest 프리셋의 Platform.OS 기본값은 ios라 안드로이드 경로를 명시적으로 켠다.
function setPlatform(os: string, version: number): void {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  Object.defineProperty(Platform, 'Version', {
    value: version,
    configurable: true,
  });
}

describe('syncPushRegistration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setPlatform('android', 33);
    mockedGetToken.mockResolvedValue('fcm-token');
    mockedRegister.mockResolvedValue(true);
    mockedUnregister.mockResolvedValue(true);
    jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('권한이 허용되면 토큰을 등록한다', async () => {
    await syncPushRegistration();

    expect(mockedRegister).toHaveBeenCalledWith('fcm-token', 'android');
  });

  it('권한을 거부하면 토큰을 요청하지도 등록하지도 않는다 (T-04)', async () => {
    jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);

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
  beforeEach(() => {
    jest.clearAllMocks();
    setPlatform('android', 33);
    mockedGetToken.mockResolvedValue('fcm-token');
    mockedRegister.mockResolvedValue(true);
    mockedUnregister.mockResolvedValue(true);
    jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('등록했던 토큰을 서버에서 지운다', async () => {
    await syncPushRegistration();
    await clearPushRegistration();

    expect(mockedUnregister).toHaveBeenCalledWith('fcm-token');
  });

  it('등록한 적이 없으면 아무 것도 부르지 않는다', async () => {
    await clearPushRegistration();

    expect(mockedUnregister).not.toHaveBeenCalled();
  });

  it('두 번 불러도 서버 호출은 한 번뿐이다', async () => {
    await syncPushRegistration();
    await clearPushRegistration();
    await clearPushRegistration();

    expect(mockedUnregister).toHaveBeenCalledTimes(1);
  });

  it('서버에 못 닿아도 예외를 밖으로 던지지 않는다 (로그아웃은 진행)', async () => {
    await syncPushRegistration();
    mockedUnregister.mockRejectedValue(new Error('network'));

    await expect(clearPushRegistration()).resolves.toBeUndefined();
  });
});
