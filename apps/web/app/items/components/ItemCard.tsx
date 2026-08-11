// 물건 목록 공용 카드 — /items, /items/browse가 함께 쓴다
import Link from 'next/link';
import type { AuctionItem } from '../api-client';
import { computeMinimumBidRate, formatBidDatetime, formatWon, formatWonCompact } from '../format';
import { encodeItemId } from '../item-id';
import { assumedDepositCardLabel } from '../notice-labels';
import styles from './ItemCard.module.css';

export function ItemCard({ item }: { item: AuctionItem }) {
  const id = encodeItemId({ courtOfficeCode: item.courtOfficeCode, caseNo: item.caseNo, itemNo: item.itemNo });
  const minimumBidRate = computeMinimumBidRate(item.appraisalAmount, item.minimumSalePrice);
  const bidDatetimeLabel = formatBidDatetime(item.bidDatetime);
  // 가격만 보고 인수 부담을 놓치는 것이 입문자의 첫 사고다 — 목록에서부터 같이 보인다.
  // null이면 명세서를 못 받은 것이라 "인수 없음"으로 적지 않고 미확인으로 표기한다.
  const assumedLabel = assumedDepositCardLabel(item.assumedDeposit, formatWonCompact);

  return (
    <Link href={`/items/${id}`} className={styles.card}>
      {item.usageName ? <span className={styles.usageBadge}>{item.usageName}</span> : null}
      <p className={styles.address}>{item.address ?? '주소 정보 없음'}</p>

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
        {bidDatetimeLabel ? <span className={`${styles.chip} ${styles.chipDate}`}>매각기일 {bidDatetimeLabel}</span> : null}
        {assumedLabel ? (
          <span className={`${styles.chip} ${styles.chipAssumed}`}>{assumedLabel}</span>
        ) : (
          <span className={`${styles.chip} ${styles.chipUnknown}`}>명세서 미확인</span>
        )}
      </div>
    </Link>
  );
}
