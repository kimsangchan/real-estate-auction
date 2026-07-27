// 웹 세션 자동 연장 — 액세스 토큰(15분)이 만료돼도 리프레시 쿠키가 살아 있으면 페이지 요청 중에
// 조용히 갱신해 14일 세션 의도를 실현한다 (WP-08b §1-7)
import { NextResponse, type NextRequest } from 'next/server';
import { needsSessionRefresh, withAccessTokenCookie } from './app/auth/session-cookie';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

// 회전은 되돌릴 수 없는 조작이라 짧은 타임아웃으로 끊으면 서버는 갱신했는데 브라우저는 옛 토큰을
// 들고 있는 상태가 된다(다음 요청에서 재사용으로 오인돼 로그아웃). 넉넉히 준다.
const REFRESH_TIMEOUT_MS = 8000;

// /api를 제외한다 — 리프레시 호출이 다시 middleware를 타면 재귀가 된다 (WP-08b §3-6).
// 경계를 `/`나 문자열 끝으로 못박아 /apiary 같은 미래 경로가 조용히 빠지지 않게 한다.
export const config = {
  matcher: ['/((?!(?:api|_next)(?:/|$)|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$).*)'],
};

/**
 * 진행 중인 갱신을 리프레시 토큰별로 1건만 유지한다.
 * 액세스 쿠키가 만료된 시점에 페이지 요청이 여러 개(특히 Next의 <Link> prefetch) 동시에 뜨면
 * 같은 토큰으로 회전을 중복 요청하게 되는데, 서버는 이를 토큰 재사용(도난)으로 판정해
 * 세션을 끊는다 — 자동 연장이 오히려 로그아웃을 만든다.
 */
const inFlight = new Map<string, Promise<RefreshOutcome>>();

interface RefreshOutcome {
  accessToken?: string;
  setCookies: string[];
}

function refreshOnce(cookieHeader: string, refreshToken: string): Promise<RefreshOutcome> {
  const running = inFlight.get(refreshToken);
  if (running) return running;

  const attempt = (async (): Promise<RefreshOutcome> => {
    try {
      // 프록시(/api)가 아니라 API 오리진을 직접 부른다 — Next 자기 자신 경유 금지 (§3-6)
      const refreshed = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { cookie: cookieHeader },
        cache: 'no-store',
        signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
      });

      // 실패면 API가 만료 쿠키를 보낸다 — 그대로 전달해 죽은 쿠키로 매 요청 재시도하는 것을 막는다.
      const setCookies = refreshed.headers.getSetCookie();
      if (!refreshed.ok) return { setCookies };

      const { accessToken } = (await refreshed.json()) as { accessToken?: string };
      return { accessToken, setCookies };
    } catch {
      // 갱신 실패로 공개 페이지 탐색이 막히면 안 된다 — 비로그인 상태로 그대로 진행한다 (T-04)
      return { setCookies: [] };
    } finally {
      inFlight.delete(refreshToken);
    }
  })();

  inFlight.set(refreshToken, attempt);
  return attempt;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const cookieHeader = request.headers.get('cookie');
  if (!needsSessionRefresh(cookieHeader)) return NextResponse.next();

  const refreshToken = request.cookies.get('refresh_token')?.value;
  if (!refreshToken) return NextResponse.next();

  const { accessToken, setCookies } = await refreshOnce(cookieHeader ?? '', refreshToken);

  const response = accessToken
    ? NextResponse.next({ request: { headers: withRefreshedCookie(request, cookieHeader, accessToken) } })
    : NextResponse.next();

  for (const setCookie of setCookies) {
    response.headers.append('set-cookie', setCookie);
  }
  return response;
}

/** 브라우저가 Set-Cookie를 받기 전인 이번 요청도 로그인 상태로 렌더되게 한다 */
function withRefreshedCookie(
  request: NextRequest,
  cookieHeader: string | null,
  accessToken: string,
): Headers {
  const headers = new Headers(request.headers);
  headers.set('cookie', withAccessTokenCookie(cookieHeader, accessToken));
  return headers;
}
