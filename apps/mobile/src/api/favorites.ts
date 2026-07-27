// 관심 물건 API — 서버가 auction_item과 조인해 카드 필드까지 채워주므로 목록은 AuctionItem 그대로다
// (웹 apps/web/app/favorites와 동일 계약, WP-08 §1-6).
import type { AuctionItem, ItemKey } from './auctionItems';
import { authedFetch } from './authSession';

function favoritePath(key: ItemKey): string {
  return `/favorites/${encodeURIComponent(
    key.courtOfficeCode,
  )}/${encodeURIComponent(key.caseNo)}/${encodeURIComponent(key.itemNo)}`;
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

export async function addFavorite(key: ItemKey): Promise<boolean> {
  const response = await authedFetch(favoritePath(key), { method: 'PUT' });
  return response.ok;
}

export async function removeFavorite(key: ItemKey): Promise<boolean> {
  const response = await authedFetch(favoritePath(key), { method: 'DELETE' });
  return response.ok;
}
