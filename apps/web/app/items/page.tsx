// 물건 목록 화면 — WP-02 실제 수집 데이터를 최신순으로 훑어보고 상세로 진입한다 (다방식 목록 우선 뷰,
// 필터·지도는 RN 지도 홈(2-2)의 영역이라 이 화면은 목록만 다룬다). 지역으로 좁혀보려면 /items/browse.
import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchAuctionItems } from './api-client';
import { ItemCard } from './components/ItemCard';
import { Pagination } from './components/Pagination';
import { buildOpenGraph, SITE_NAME } from '../seo';
import styles from './page.module.css';

const TITLE = `경매 물건 목록 | ${SITE_NAME}`;
const DESCRIPTION = '법원 경매 물건을 최신순으로 훑어보고 감정가·최저매각가격·매각기일을 확인해요';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/items' },
  openGraph: buildOpenGraph('/items', TITLE, DESCRIPTION),
};

const PAGE_SIZE = 20;

export default async function ItemListPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>;
}) {
  const { offset: offsetParam } = await searchParams;
  const offset = Math.max(Number(offsetParam) || 0, 0);
  const items = await fetchAuctionItems(PAGE_SIZE, offset);

  const prevOffset = Math.max(offset - PAGE_SIZE, 0);

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>물건 목록</h1>
      <p className={styles.subtitle}>최근 수집된 경매 물건이에요.</p>
      <Link href="/items/map" className={styles.mapLink}>
        지도로 보기
      </Link>

      {items.length === 0 ? (
        <p className={styles.emptyState}>표시할 물건이 없어요.</p>
      ) : (
        <div className={styles.list}>
          {items.map((item) => (
            <ItemCard key={`${item.courtOfficeCode}-${item.caseNo}-${item.itemNo}`} item={item} />
          ))}
        </div>
      )}

      <Pagination
        prevHref={`/items?offset=${prevOffset}`}
        nextHref={`/items?offset=${offset + PAGE_SIZE}`}
        hasPrev={offset > 0}
        hasNext={items.length === PAGE_SIZE}
      />
    </main>
  );
}
