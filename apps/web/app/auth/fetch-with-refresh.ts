// 클라이언트 fetch 401 보강 — 페이지 로드 후 15분 이상 머문 탭에서도 관심 버튼이 동작하도록
// 리프레시를 1회만 시도하고 원요청을 한 번만 재시도한다 (WP-08b §1-7)
export async function fetchWithRefresh(input: string, init?: RequestInit): Promise<Response> {
  const first = await fetch(input, init);
  if (first.status !== 401) return first;

  const refreshed = await fetch('/api/auth/refresh', { method: 'POST' });
  if (!refreshed.ok) return first;

  // 재시도는 여기서 끝난다 — 또 401이면 호출부가 비로그인으로 처리한다 (무한 루프 금지)
  return fetch(input, init);
}
