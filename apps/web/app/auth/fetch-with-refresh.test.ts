import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { fetchWithRefresh } from './fetch-with-refresh';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** 호출 순서대로 status를 돌려주는 fetch 스텁 — 호출 경로 기록을 반환한다 */
function stubFetch(statuses: number[]): string[] {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string) => {
    calls.push(input);
    return new Response(null, { status: statuses[calls.length - 1] ?? 500 });
  }) as unknown as typeof globalThis.fetch;
  return calls;
}

test('401이 아니면 리프레시 없이 첫 응답을 그대로 반환한다', async () => {
  const calls = stubFetch([200]);

  const response = await fetchWithRefresh('/api/favorites');

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ['/api/favorites']);
});

test('401이면 리프레시 후 원요청을 한 번 재시도한다', async () => {
  const calls = stubFetch([401, 200, 200]);

  const response = await fetchWithRefresh('/api/favorites');

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ['/api/favorites', '/api/auth/refresh', '/api/favorites']);
});

test('리프레시가 실패하면 재시도 없이 첫 401을 그대로 반환한다', async () => {
  const calls = stubFetch([401, 401]);

  const response = await fetchWithRefresh('/api/favorites');

  assert.equal(response.status, 401);
  assert.deepEqual(calls, ['/api/favorites', '/api/auth/refresh']);
});

test('경계값: 재시도도 401이면 더 이상 시도하지 않는다 (1회 한정)', async () => {
  const calls = stubFetch([401, 200, 401]);

  const response = await fetchWithRefresh('/api/favorites');

  assert.equal(response.status, 401);
  assert.equal(calls.length, 3);
});
