// 물건 상세 화면 — apps/api의 실제 수집 데이터를 조회해 가격 헤더 + 물건 개요 표 + 하단 고정 CTA
// "권리분석 보기"를 렌더링한다 (05-blueprint §3a). 권리분석 이후 화면은 아직 예시 데이터로 남아있다.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchAuctionItem } from '../api-client';
import { FavoriteButton } from '../components/FavoriteButton';
import { computeMinimumBidRate, formatBidDatetime, formatWon } from '../format';
import { decodeItemId, encodeItemId } from '../item-id';
import styles from './page.module.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const key = decodeItemId(id);
  const item = key ? await fetchAuctionItem(key) : null;
  if (!item) {
    return { title: '물건을 찾을 수 없어요 - 부동산 경매 플랫폼' };
  }

  const priceLabel = item.minimumSalePrice !== null ? `${formatWon(item.minimumSalePrice)} 경매` : '경매 물건';
  const title = `${item.address ?? item.caseNo} - ${priceLabel} | 부동산 경매 플랫폼`;
  const description = `${item.courtName ?? ''} ${item.caseNo} · ${item.usageName ?? '물건'} · 감정가 ${
    item.appraisalAmount !== null ? formatWon(item.appraisalAmount) : '정보 없음'
  }, 최저가 ${item.minimumSalePrice !== null ? formatWon(item.minimumSalePrice) : '정보 없음'}`;

  return { title, description };
}

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const key = decodeItemId(id);
  if (!key) notFound();

  const item = await fetchAuctionItem(key);
  if (!item) notFound();

  const minimumBidRate = computeMinimumBidRate(item.appraisalAmount, item.minimumSalePrice);
  const bidDatetimeLabel = formatBidDatetime(item.bidDatetime);

  return (
    <main className={styles.page}>
      <p className={styles.breadcrumb}>물건상세검색 &gt; {item.usageName ?? '물건'}</p>

      <section className={styles.priceHeader}>
        <p className={styles.courtLine}>
          {item.courtName} {item.deptName} · {item.caseNo}
        </p>
        {item.usageName ? <span className={styles.usageBadge}>{item.usageName}</span> : null}
        <h1 className={styles.address}>{item.address ?? '주소 정보 없음'}</h1>

        <div className={styles.priceRow}>
          <span className={styles.minPrice}>
            {item.minimumSalePrice !== null ? formatWon(item.minimumSalePrice) : '가격 정보 없음'}
          </span>
          {minimumBidRate !== null ? <span className={styles.minRate}>최저가율 {minimumBidRate}%</span> : null}
        </div>
        {item.appraisalAmount !== null ? (
          <p className={styles.appraisedLine}>
            감정가 <s>{formatWon(item.appraisalAmount)}</s>
          </p>
        ) : null}

        <div className={styles.metaChips}>
          {item.failedBidCount !== null ? (
            <span className={`${styles.chip} ${styles.chipFailed}`}>{item.failedBidCount}회 유찰</span>
          ) : null}
          {bidDatetimeLabel ? (
            <span className={`${styles.chip} ${styles.chipDate}`}>매각기일 {bidDatetimeLabel}</span>
          ) : null}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>물건 개요</h2>
        <div className={styles.specsTable}>
          <div className={styles.specsRow}>
            <span className={styles.specsLabel}>사건번호</span>
            <span className={styles.specsValue}>{item.caseNo}</span>
          </div>
          <div className={styles.specsRow}>
            <span className={styles.specsLabel}>물건종류</span>
            <span className={styles.specsValue}>{item.usageName ?? '정보 없음'}</span>
          </div>
          <div className={styles.specsRow}>
            <span className={styles.specsLabel}>담당계</span>
            <span className={styles.specsValue}>{item.deptName ?? '정보 없음'}</span>
          </div>
        </div>
      </section>

      <div className={styles.ctaBar}>
        <div className={styles.ctaRow}>
          <FavoriteButton
            courtOfficeCode={item.courtOfficeCode}
            caseNo={item.caseNo}
            itemNo={item.itemNo}
            currentPath={`/items/${encodeItemId(key)}`}
          />
          <Link href={`/items/${id}/rights-analysis`} className={styles.ctaLink}>
            권리분석 보기
          </Link>
        </div>
      </div>
    </main>
  );
}
