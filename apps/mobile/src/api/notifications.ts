// 기기 토큰 등록·해제 API — 인증 호출은 authedFetch 하나로 나간다 (WP-08b §1-4, 새 fetch 헬퍼 금지).
import { authedFetch } from './authSession';

export async function registerDeviceToken(token: string, platform: string): Promise<boolean> {
  const response = await authedFetch('/notifications/device', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform }),
  });
  return response.ok;
}

export async function unregisterDeviceToken(token: string): Promise<boolean> {
  const response = await authedFetch('/notifications/device', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return response.ok;
}
