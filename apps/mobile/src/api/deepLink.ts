// 로그인 콜백 딥링크 파싱 — 서버가 auction://auth/callback?code=… 로 되돌려준다 (WP-08b §1-1).
// URL 클래스 동작이 커스텀 스킴에서 엔진마다 다르므로 문자열로 직접 파싱한다.
const CALLBACK_PREFIX = 'auction://auth/callback';

export function parseAuthCallbackCode(url: string | null): string | null {
  if (!url) return null;

  const queryStart = url.indexOf('?');
  if (queryStart === -1) return null;
  // 경로가 정확히 일치할 때만 받는다 — .../callbackXYZ 같은 느슨한 접두 일치는 거부한다
  if (url.slice(0, queryStart) !== CALLBACK_PREFIX) return null;

  for (const pair of url.slice(queryStart + 1).split('&')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator) !== 'code') continue;

    const code = decodeURIComponent(pair.slice(separator + 1));
    return code.length > 0 ? code : null;
  }
  return null;
}
