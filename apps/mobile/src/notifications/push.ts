// 푸시 등록 — 로그인하면 FCM 토큰을 서버에 올리고, 로그아웃·탈퇴 직전에 지운다 (WP-09 §1-6,9).
// 권한을 거부해도 앱의 나머지 기능은 그대로 쓸 수 있어야 한다 (T-04).
import {
  getMessaging,
  getToken,
  onTokenRefresh,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  registerDeviceToken,
  unregisterDeviceToken,
} from '../api/notifications';

// Android 13(API 33)부터 알림 표시에 런타임 권한이 필요하다.
const ANDROID_NOTIFICATION_PERMISSION_SDK = 33;

let currentToken: string | null = null;
let unsubscribeTokenRefresh: (() => void) | null = null;

/**
 * messaging의 requestPermission()은 Android에서 no-op이라 이걸로는 권한 창이 뜨지 않는다 —
 * POST_NOTIFICATIONS는 PermissionsAndroid로 직접 요청해야 한다 (WP-09 §3-5).
 * 이미 허용/거부한 사용자에게 매번 창을 띄우지 않도록 먼저 확인한다.
 */
async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (
    typeof Platform.Version === 'number' &&
    Platform.Version < ANDROID_NOTIFICATION_PERMISSION_SDK
  ) {
    return true;
  }

  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(permission)) return true;

  return (
    (await PermissionsAndroid.request(permission)) ===
    PermissionsAndroid.RESULTS.GRANTED
  );
}

async function upload(token: string): Promise<void> {
  // 등록에 성공했을 때만 기억한다 — 실패한 토큰을 기억하면 로그아웃 때 엉뚱한 걸 지우려 한다.
  if (await registerDeviceToken(token, Platform.OS)) {
    currentToken = token;
  }
}

/** 로그인 직후 호출 — 실패해도 로그인 흐름을 막지 않는다 */
export async function syncPushRegistration(): Promise<void> {
  try {
    if (!(await ensureNotificationPermission())) return;

    const token = await getToken(getMessaging());
    if (!token) return;
    await upload(token);

    // FCM이 토큰을 갱신하면 서버 것이 죽는다 — 갱신분을 올리도록 구독한다.
    // 이전 구독은 해제해 중복 등록을 남기지 않는다.
    unsubscribeTokenRefresh?.();
    unsubscribeTokenRefresh = onTokenRefresh(
      getMessaging(),
      (refreshed: string) => {
        upload(refreshed).catch(() => {});
      },
    );
  } catch {
    // 푸시가 안 붙어도 앱은 그대로 동작해야 한다.
  }
}

/**
 * 로그아웃·탈퇴 **직전**에 호출 — 세션이 살아 있어야 서버가 토큰을 지운다.
 * 캐시에만 의존하면 이번 세션에서 등록하지 않은 경우(권한 거부 후 재실행 등) 서버 행이 남는다.
 */
export async function clearPushRegistration(): Promise<void> {
  try {
    const token = currentToken ?? (await getToken(getMessaging()));
    currentToken = null;
    if (!token) return;

    await unregisterDeviceToken(token);
  } catch {
    // 서버에 못 닿아도 로그아웃은 진행한다.
  }
}
