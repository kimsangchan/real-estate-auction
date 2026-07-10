// 지역 드릴다운 화면 — 시/도 선택 → 시/군/구 선택 → 해당 지역 물건 목록 순으로 좁혀본다 (3사 벤치마크
// "세밀한 조건 필터 + 목록 우선 뷰" 중 지역 축, 05-blueprint §3a).
import Link from 'next/link';
import { fetchAuctionItems, fetchRegionCounts } from '../api-client';
import { ItemCard } from '../components/ItemCard';
import { Pagination } from '../components/Pagination';
import styles from './page.module.css';

const PAGE_SIZE = 20;

function RegionList({ regions, buildHref }: { regions: { name: string; count: number }[]; buildHref: (name: string) => string }) {
  if (regions.length === 0) {
    return <p className={styles.emptyState}>표시할 지역이 없어요.</p>;
  }
  return (
    <div className={styles.regionList}>
      {regions.map((region) => (
        <Link key={region.name} href={buildHref(region.name)} className={styles.regionRow}>
          <span className={styles.regionName}>{region.name}</span>
          <span className={styles.regionCount}>{region.count}건</span>
        </Link>
      ))}
    </div>
  );
}

export default async function ItemBrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ sido?: string; sigungu?: string; offset?: string }>;
}) {
  const { sido, sigungu, offset: offsetParam } = await searchParams;

  if (!sido) {
    const regions = await fetchRegionCounts();
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>지역별 물건 찾기</h1>
        <p className={styles.subtitle}>시/도를 선택해주세요.</p>
        <Link href="/items/map" className={styles.mapLink}>
          지도로 보기
        </Link>
        <RegionList regions={regions} buildHref={(name) => `/items/browse?sido=${encodeURIComponent(name)}`} />
      </main>
    );
  }

  if (!sigungu) {
    const regions = await fetchRegionCounts(sido);
    return (
      <main className={styles.page}>
        <p className={styles.breadcrumb}>
          <Link href="/items/browse">지역별 물건 찾기</Link> &gt; {sido}
        </p>
        <h1 className={styles.title}>{sido}</h1>
        <p className={styles.subtitle}>시/군/구를 선택해주세요.</p>
        <RegionList
          regions={regions}
          buildHref={(name) => `/items/browse?sido=${encodeURIComponent(sido)}&sigungu=${encodeURIComponent(name)}`}
        />
      </main>
    );
  }

  const offset = Math.max(Number(offsetParam) || 0, 0);
  const items = await fetchAuctionItems(PAGE_SIZE, offset, { sido, sigungu });
  const prevOffset = Math.max(offset - PAGE_SIZE, 0);
  const pageHref = (o: number) =>
    `/items/browse?sido=${encodeURIComponent(sido)}&sigungu=${encodeURIComponent(sigungu)}&offset=${o}`;

  return (
    <main className={styles.page}>
      <p className={styles.breadcrumb}>
        <Link href="/items/browse">지역별 물건 찾기</Link> &gt;{' '}
        <Link href={`/items/browse?sido=${encodeURIComponent(sido)}`}>{sido}</Link> &gt; {sigungu}
      </p>
      <h1 className={styles.title}>
        {sido} {sigungu}
      </h1>
      <p className={styles.subtitle}>이 지역 물건이에요.</p>

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
        prevHref={pageHref(prevOffset)}
        nextHref={pageHref(offset + PAGE_SIZE)}
        hasPrev={offset > 0}
        hasNext={items.length === PAGE_SIZE}
      />
    </main>
  );
}
