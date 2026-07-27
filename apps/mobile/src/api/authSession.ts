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

// 액세스 토큰은 메모리에만 둔다 — 저장소에 쓰지 않는다 (AGENTS 규칙 8, §1-3)
let accessToken: string | null = null;
let pendingCodeVerifier: string | null = null;

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

export async function clearSession(): Promise<void> {
  accessToken = null;
  pendingCodeVerifier = null;
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
  pendingCodeVerifier = null;
  if (!codeVerifier) return false;

  const response = await fetch(`${API_BASE_URL}/auth/mobile/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, codeVerifier }),
  });
  if (!response.ok) return false;

  await storeTokens((await response.json()) as TokenPair);
  return true;
}

async function refreshTokens(refreshToken: string): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    await clearSession();
    return false;
  }

  await storeTokens((await response.json()) as TokenPair);
  return true;
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
