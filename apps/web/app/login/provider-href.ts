// 로그인 버튼 href 빌더 — returnTo 쿼리를 유지한 채 서버 OAuth 시작 라우트로 보낸다
export type LoginProvider = 'kakao' | 'naver';

export function buildProviderHref(provider: LoginProvider, returnTo: string | undefined): string {
  return returnTo ? `/api/auth/${provider}?returnTo=${encodeURIComponent(returnTo)}` : `/api/auth/${provider}`;
}
