// 관심 물건 API — 서버가 auction_item과 조인해 카드 필드까지 채워주므로 목록은 AuctionItem 그대로다
// (웹 apps/web/app/favorites와 동일 계약, WP-08 §1-6).
import type { AuctionItem, ItemKey } from './auctionItems';
import { authedFetch } from './authSession';

/** 401(세션 없음)과 그 밖의 실패를 구분한다 — 5xx를 로그아웃으로 오인하지 않기 위해 필요하다 */
export type FavoriteResult = 'ok' | 'unauthorized' | 'failed';

function favoritePath(key: ItemKey): string {
  return `/favorites/${encodeURIComponent(
    key.courtOfficeCode,
  )}/${encodeURIComponent(key.caseNo)}/${encodeURIComponent(key.itemNo)}`;
}

async function toggleFavorite(
  key: ItemKey,
  method: 'PUT' | 'DELETE',
): Promise<FavoriteResult> {
  const response = await authedFetch(favoritePath(key), { method });
  if (response.ok) return 'ok';
  return response.status === 401 ? 'unauthorized' : 'failed';
}

/** 비로그인(401)이면 null — 호출부가 로그인 안내로 전환한다 */
export async function fetchFavorites(): Promise<AuctionItem[] | null> {
  const response = await authedFetch('/favorites');
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`관심 목록 조회 실패: ${response.status}`);
  }
  return (await response.json()) as AuctionItem[];
}

export function addFavorite(key: ItemKey): Promise<FavoriteResult> {
  return toggleFavorite(key, 'PUT');
}

export function removeFavorite(key: ItemKey): Promise<FavoriteResult> {
  return toggleFavorite(key, 'DELETE');
}
