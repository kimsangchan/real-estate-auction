// 웹 세션 자동 연장 — 액세스 토큰(15분)이 만료돼도 리프레시 쿠키가 살아 있으면 페이지 요청 중에
// 조용히 갱신해 14일 세션 의도를 실현한다 (WP-08b §1-7)
import { NextResponse, type NextRequest } from 'next/server';
import { needsSessionRefresh, withAccessTokenCookie } from './app/auth/session-cookie';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

// /api를 제외한다 — 리프레시 호출이 다시 middleware를 타면 재귀가 된다 (WP-08b §3-6)
export const config = {
  matcher: ['/((?!api|_next|favicon.ico|robots.txt|sitemap.xml).*)'],
};

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const cookieHeader = request.headers.get('cookie');
  if (!needsSessionRefresh(cookieHeader)) return NextResponse.next();

  try {
    // 프록시(/api)가 아니라 API 오리진을 직접 부른다 — Next 자기 자신 경유 금지 (§3-6)
    const refreshed = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { cookie: cookieHeader ?? '' },
      cache: 'no-store',
      // API가 응답 없이 매달리면 공개 페이지 전체가 지연된다 — layout.tsx의 /auth/me와 같은 기준 (T-04)
      signal: AbortSignal.timeout(2000),
    });

    let response: NextResponse;
    if (refreshed.ok) {
      const { accessToken } = (await refreshed.json()) as { accessToken?: string };
      const headers = new Headers(request.headers);
      if (accessToken) headers.set('cookie', withAccessTokenCookie(cookieHeader, accessToken));
      response = NextResponse.next({ request: { headers } });
    } else {
      // 실패면 API가 만료 쿠키를 보낸다 — 그대로 전달해 죽은 리프레시 쿠키로 매 요청 재시도하는 것을 막는다
      response = NextResponse.next();
    }

    for (const setCookie of refreshed.headers.getSetCookie()) {
      response.headers.append('set-cookie', setCookie);
    }
    return response;
  } catch {
    // 갱신 실패로 공개 페이지 탐색이 막히면 안 된다 — 비로그인 상태로 그대로 진행한다 (T-04)
    return NextResponse.next();
  }
}
