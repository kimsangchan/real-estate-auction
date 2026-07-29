// 푸시 등록 — 로그인하면 FCM 토큰을 서버에 올리고, 로그아웃·탈퇴 직전에 지운다 (WP-09 §1-6,9).
// 권한을 거부해도 앱의 나머지 기능은 그대로 쓸 수 있어야 한다 (T-04).
import { getMessaging, getToken } from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import { registerDeviceToken, unregisterDeviceToken } from '../api/notifications';

// Android 13(API 33)부터 알림 표시에 런타임 권한이 필요하다.
const ANDROID_NOTIFICATION_PERMISSION_SDK = 33;

let currentToken: string | null = null;

/**
 * messaging의 requestPermission()은 Android에서 no-op이라 이걸로는 권한 창이 뜨지 않는다 —
 * POST_NOTIFICATIONS는 PermissionsAndroid로 직접 요청해야 한다 (WP-09 §3-5).
 */
async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (typeof Platform.Version === 'number' && Platform.Version < ANDROID_NOTIFICATION_PERMISSION_SDK) {
    return true;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/** 로그인 직후 호출 — 실패해도 로그인 흐름을 막지 않는다 */
export async function syncPushRegistration(): Promise<void> {
  try {
    if (!(await ensureNotificationPermission())) return;

    const token = await getToken(getMessaging());
    if (!token) return;

    currentToken = token;
    await registerDeviceToken(token, Platform.OS);
  } catch {
    // 푸시가 안 붙어도 앱은 그대로 동작해야 한다.
  }
}

/** 로그아웃·탈퇴 **직전**에 호출 — 세션이 살아 있어야 서버가 토큰을 지운다 */
export async function clearPushRegistration(): Promise<void> {
  const token = currentToken;
  currentToken = null;
  if (!token) return;

  try {
    await unregisterDeviceToken(token);
  } catch {
    // 서버에 못 닿아도 로그아웃은 진행한다.
  }
}
