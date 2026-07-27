// 세션 쿠키 헤더 판정·갱신 — middleware가 액세스 토큰 만료를 감지하고, 갱신분을 이번 요청의
// SSR에 바로 반영할 때 쓴다 (WP-08b §1-7)
const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

function cookieName(part: string): string {
  return part.split('=')[0]?.trim() ?? '';
}

/** 액세스 토큰만 만료되고 리프레시 토큰은 남아 있는 상태 — 이때만 갱신을 시도한다 */
export function needsSessionRefresh(cookieHeader: string | null | undefined): boolean {
  const names = new Set((cookieHeader ?? '').split(';').map(cookieName));
  return !names.has(ACCESS_TOKEN_COOKIE) && names.has(REFRESH_TOKEN_COOKIE);
}

/**
 * 갱신한 액세스 토큰을 쿠키 헤더에 얹는다 — 브라우저가 Set-Cookie를 받기 전인 이번 요청도
 * 로그인 상태로 렌더되게 한다(새로고침 한 번에 세션이 이어지는 이유).
 */
export function withAccessTokenCookie(cookieHeader: string | null | undefined, accessToken: string): string {
  const kept = (cookieHeader ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && cookieName(part) !== ACCESS_TOKEN_COOKIE);
  return [...kept, `${ACCESS_TOKEN_COOKIE}=${accessToken}`].join('; ');
}
