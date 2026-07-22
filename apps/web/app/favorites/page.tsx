// 관심 물건 목록 화면 — GET /favorites(서버가 auction_item과 조인해 카드 필드까지 채워줌)를 그대로
// 기존 ItemCard로 렌더한다. 비로그인 접근은 /login으로 보낸다 (WP-08 §1-8.3)
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { AuctionItem } from '../items/api-client';
import { ItemCard } from '../items/components/ItemCard';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: '관심 물건 - 부동산 경매 플랫폼',
  description: '내가 등록한 관심 물건 목록이에요',
};

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

export default async function FavoritesPage() {
  const cookieHeader = (await headers()).get('cookie');
  const response = await fetch(`${API_BASE_URL}/favorites`, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: 'no-store',
  });

  if (response.status === 401) {
    redirect('/login?returnTo=/favorites');
  }
  if (!response.ok) {
    throw new Error(`관심 목록 조회 실패: ${response.status}`);
  }

  const items = (await response.json()) as AuctionItem[];

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>관심 물건</h1>
      <p className={styles.subtitle}>내가 등록한 관심 물건이에요.</p>

      {items.length === 0 ? (
        <p className={styles.emptyState}>등록한 관심 물건이 없어요.</p>
      ) : (
        <div className={styles.list}>
          {items.map((item) => (
            <ItemCard key={`${item.courtOfficeCode}-${item.caseNo}-${item.itemNo}`} item={item} />
          ))}
        </div>
      )}
    </main>
  );
}
