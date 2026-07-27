// 모바일 인증 세션 — 시스템 브라우저 로그인 시작(RFC 8252), 딥링크 교환 코드→토큰,
// Keystore 리프레시 토큰 보관, 401 시 리프레시 1회 후 재시도 (WP-08b §1-1·§1-3·§1-4).
// 인증이 필요한 호출은 전부 authedFetch 하나로 나간다 — 별도 fetch 헬퍼를 만들지 않는다.
import { Linking } from 'react-native';
import {
  getGenericPassword,
  resetGenericPassword,
  setGenericPassword,
} from 'react-native-keychain';
import { API_BASE_URL } from './auctionItems';
import { createCodeChallenge, createCodeVerifier } from './pkce';

// 로그인 시작은 반드시 웹 오리진으로 연다 — state 쿠키가 웹 오리진에 저장돼야 같은 오리진의
// 콜백에서 검증된다. 에뮬레이터는 adb reverse tcp:3000 tcp:3000으로 호스트에 포워딩된다 (§3-1).
const WEB_ORIGIN = 'http://localhost:3000';
const REFRESH_TOKEN_SERVICE = 'com.realestateauction.mobile.refreshToken';

export type AuthProvider = 'kakao' | 'naver';

export interface CurrentUser {
  nickname: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// 서버가 매달릴 때 화면이 영영 '로딩'에 갇히지 않도록 예산을 준다.
const REQUEST_TIMEOUT_MS = 5000;

// Hermes에는 AbortSignal.timeout이 없다 — AbortController로 직접 만든다.
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// 액세스 토큰은 메모리에만 둔다 — 저장소에 쓰지 않는다 (AGENTS 규칙 8, §1-3)
let accessToken: string | null = null;
let pendingCodeVerifier: string | null = null;
// 진행 중인 리프레시 1건 — 동시에 401을 받은 호출들이 같은 토큰으로 회전을 중복 요청하면
// 서버가 이를 '재사용'으로 보고 세션을 끊는다. 한 번만 보내고 결과를 공유한다.
let inFlightRefresh: Promise<boolean> | null = null;

async function readRefreshToken(): Promise<string | null> {
  const credentials = await getGenericPassword({
    service: REFRESH_TOKEN_SERVICE,
  });
  return credentials === false ? null : credentials.password;
}

async function storeTokens(pair: TokenPair): Promise<void> {
  accessToken = pair.accessToken;
  await setGenericPassword('refresh', pair.refreshToken, {
    service: REFRESH_TOKEN_SERVICE,
  });
}

/** 세션 정리 — 진행 중인 로그인(pendingCodeVerifier)은 다른 관심사라 건드리지 않는다 */
export async function clearSession(): Promise<void> {
  accessToken = null;
  await resetGenericPassword({ service: REFRESH_TOKEN_SERVICE });
}

/** 시스템 브라우저로 로그인을 시작한다 — 인앱 WebView는 쓰지 않는다 (RFC 8252 §8.12) */
export async function startLogin(provider: AuthProvider): Promise<void> {
  const codeVerifier = createCodeVerifier();
  pendingCodeVerifier = codeVerifier;
  const codeChallenge = createCodeChallenge(codeVerifier);

  await Linking.openURL(
    `${WEB_ORIGIN}/api/auth/${provider}?client=mobile&codeChallenge=${codeChallenge}`,
  );
}

/** 딥링크로 받은 일회성 교환 코드를 토큰 쌍으로 바꾼다 — verifier가 없으면 우리가 시작한 로그인이 아니다 */
export async function completeLogin(code: string): Promise<boolean> {
  const codeVerifier = pendingCodeVerifier;
  if (!codeVerifier) return false;

  const response = await fetchWithTimeout(`${API_BASE_URL}/auth/mobile/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, codeVerifier }),
  });
  if (!response.ok) {
    // 코드가 실제로 무효(401)일 때만 검증자를 버린다 — 일시적 실패면 같은 딥링크로 재시도할 수 있게 남긴다.
    if (response.status === 401) pendingCodeVerifier = null;
    return false;
  }

  pendingCodeVerifier = null;
  await storeTokens((await response.json()) as TokenPair);
  return true;
}

/**
 * 리프레시 토큰 회전. 동시 호출은 하나로 합친다 — 같은 토큰을 두 번 제출하면 서버가 재사용으로
 * 판정해 세션을 끊기 때문이다. 401(토큰이 실제로 무효)일 때만 저장된 토큰을 지운다 —
 * 5xx·네트워크 오류로 지우면 서버가 잠깐 죽은 동안 로그인이 영구히 풀린다.
 */
async function refreshTokens(refreshToken: string): Promise<boolean> {
  if (inFlightRefresh) return inFlightRefresh;

  inFlightRefresh = (async () => {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (response.status === 401) {
        // 그 사이 새 로그인이 토큰을 갈아끼웠을 수 있다 — 우리가 쓴 토큰이 그대로일 때만 지운다.
        if ((await readRefreshToken()) === refreshToken) await clearSession();
        return false;
      }
      if (!response.ok) return false;

      await storeTokens((await response.json()) as TokenPair);
      return true;
    } catch {
      // 네트워크 실패는 토큰이 무효라는 뜻이 아니다 — 저장분을 남겨 다음 시도에 되살린다.
      return false;
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

/** 앱 재실행 시 Keystore의 리프레시 토큰으로 세션을 되살린다 (§2-d 세션 유지의 근거) */
export async function restoreSession(): Promise<boolean> {
  const refreshToken = await readRefreshToken();
  if (!refreshToken) return false;
  return refreshTokens(refreshToken);
}

function sendWithAccessToken(
  path: string,
  init: RequestInit | undefined,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}

/**
 * 인증이 필요한 API 호출 — 401이면 리프레시를 1회만 시도하고 원요청을 한 번만 재시도한다.
 * 재시도도 401이면 세션을 비워 호출부가 비로그인으로 전환하게 한다 (§1-4).
 */
export async function authedFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const first = await sendWithAccessToken(path, init);
  if (first.status !== 401) return first;

  const refreshToken = await readRefreshToken();
  if (!refreshToken) return first;
  if (!(await refreshTokens(refreshToken))) return first;

  const retried = await sendWithAccessToken(path, init);
  if (retried.status === 401) {
    await clearSession();
  }
  return retried;
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const response = await authedFetch('/auth/me');
  if (!response.ok) return null;
  return (await response.json()) as CurrentUser;
}

export async function logout(): Promise<void> {
  const refreshToken = await readRefreshToken();
  if (refreshToken) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // 서버에 닿지 못해도 기기의 세션은 반드시 비운다
    }
  }
  await clearSession();
}

export async function deleteAccount(): Promise<boolean> {
  const response = await authedFetch('/auth/me', { method: 'DELETE' });
  if (!response.ok) return false;

  await clearSession();
  return true;
}
