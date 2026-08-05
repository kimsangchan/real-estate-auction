// 지도 마커 호버 카드 — 지도에서 볼 수 없는 정보만 보여준다.
// 주소는 넣지 않는다: 마커 위치가 이미 위치를 말하고, 좁은 카드 폭을 가장 많이 잡아먹는다.
// 핵심은 명세서 구획이다 — 입문자가 가격·유찰만 보고 놓치는 인수 부담이 여기서 처음 드러난다.
'use client';

import {
  formatAreaWithKind,
  formatDday,
  formatDropRate,
  formatWonCompact,
} from '../format';
import { assumedRightsLabel, riskFlagLabels, shortUsageName, tenantLabel } from '../notice-labels';
import { isBulkLot } from './bulk-lot';
import styles from './ItemHoverCard.module.css';

export interface HoverCardItem {
  /** 일괄매각 판정에 쓴다 — 같은 좌표에 사건이 여럿일 수 있다 */
  caseNo: string;
  usageName: string | null;
  areaKind: string | null;
  areaM2: number | null;
  bulkSale: boolean;
  appraisalAmount: number | null;
  minimumSalePrice: number | null;
  failedBidCount: number | null;
  bidDatetime: string | null;
  assumedRightsKind: string | null;
  riskFlags: string[];
  tenantCount: number | null;
}

interface Props {
  /** 이 마커가 담은 물건들. 좌표가 같으면 한 마커라 여럿일 수 있다(같은 건물 다세대 등). */
  items: HoverCardItem[];
  /** 마커 기준 화면 좌표. 카드가 뷰포트를 벗어나지 않게 호출부가 보정해 넘긴다. */
  left: number;
  top: number;
}

export function ItemHoverCard({ items, left, top }: Props) {
  const item = items[0];
  if (item === undefined) return null;

  // 묶음은 개별 물건의 명세서·면적을 대표할 수 없다 — 몇 건이고 가격이 어디부터
  // 어디까지인지만 말하고, 나머지는 눌러서 목록에서 보게 한다.
  if (items.length > 1) {
    return <GroupHoverCard items={items} left={left} top={top} />;
  }

  const usage = shortUsageName(item.usageName);
  const dday = formatDday(item.bidDatetime);
  const drop = formatDropRate(item.appraisalAmount, item.minimumSalePrice);
  const rights = assumedRightsLabel(item.assumedRightsKind);
  const tenants = tenantLabel(item.tenantCount);
  const flags = riskFlagLabels(item.riskFlags);

  // 명세서를 한 조각도 못 받은 물건 — "인수할 권리 없음"과 구분해서 말해야 한다.
  const noticeMissing = rights === null && tenants === null && flags.length === 0;

  // 면적은 평·㎡ 둘 다 보여준다 — 평이 익숙한 사람과 ㎡가 익숙한 사람이 갈린다.
  const areaText = formatAreaWithKind(item.areaM2, item.areaKind);

  const meta = [
    usage,
    areaText,
    item.failedBidCount !== null ? `유찰 ${item.failedBidCount}회` : null,
  ].filter((value): value is string => value !== null);

  return (
    <div className={styles.card} style={{ left, top }} role="tooltip">
      <div className={styles.meta}>
        {meta.map((value, index) => (
          <span key={value}>
            {index > 0 ? <span className={styles.metaDivider}>·</span> : null}
            <span className={index === 0 ? styles.usage : undefined}>{value}</span>
          </span>
        ))}
        {dday ? (
          <>
            {meta.length > 0 ? <span className={styles.metaDivider}>·</span> : null}
            <span className={styles.dday}>{dday}</span>
          </>
        ) : null}
      </div>

      <div className={styles.priceRow}>
        <span className={styles.price}>
          {item.minimumSalePrice !== null ? formatWonCompact(item.minimumSalePrice) : '최저가 미상'}
        </span>
        {drop ? <span className={styles.drop}>{drop}</span> : null}
      </div>
      {item.appraisalAmount !== null ? (
        <div className={styles.appraisal}>감정가 {formatWonCompact(item.appraisalAmount)}</div>
      ) : null}

      <div className={styles.notice}>
        {noticeMissing ? (
          <span className={styles.noticeUnknown}>매각물건명세서 미확인</span>
        ) : (
          <>
            {tenants ? <span className={styles.noticeChip}>{tenants}</span> : null}
            {rights ? <span className={styles.noticeChip}>{rights}</span> : null}
            {flags.map((flag) => (
              <span key={flag} className={styles.noticeChip}>
                {flag}
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/** 좌표가 같은 물건 묶음 — 건수와 가격 범위만 보여주고 자세한 건 패널 목록으로 넘긴다. */
function GroupHoverCard({ items, left, top }: Props) {
  const prices = items
    .map((item) => item.minimumSalePrice)
    .filter((price): price is number => price !== null);
  const usages = new Set(
    items.map((item) => shortUsageName(item.usageName)).filter((name): name is string => name !== null),
  );
  // 유찰이 한 번이라도 있는 물건 수 — 묶음 안에서 값이 갈리므로 평균 대신 건수로 말한다
  const failedCount = items.filter((item) => (item.failedBidCount ?? 0) > 0).length;
  // 일괄매각이면 각 목적물의 최저가가 모두 묶음 전체 값이라 범위가 아니라 한 값이다
  const bulkLot = isBulkLot(items);

  return (
    <div className={styles.card} style={{ left, top }} role="tooltip">
      <div className={styles.meta}>
        <span className={styles.usage}>
          {bulkLot ? `일괄매각 목적물 ${items.length}개` : `${items.length}건`}
        </span>
        {usages.size === 1 ? (
          <>
            <span className={styles.metaDivider}>·</span>
            {[...usages][0]}
          </>
        ) : null}
        {failedCount > 0 ? (
          <>
            <span className={styles.metaDivider}>·</span>
            유찰 {failedCount}건
          </>
        ) : null}
      </div>

      <div className={styles.priceRow}>
        <span className={styles.price}>
          {prices.length === 0
            ? '최저가 미상'
            : prices.length === 1 || Math.min(...prices) === Math.max(...prices)
              ? formatWonCompact(Math.min(...prices))
              : `${formatWonCompact(Math.min(...prices))} ~ ${formatWonCompact(Math.max(...prices))}`}
        </span>
      </div>

      <div className={styles.notice}>
        <span className={styles.noticeUnknown}>
          {bulkLot ? '묶음 전체 최저가 · 눌러서 목록 보기' : '눌러서 목록 보기'}
        </span>
      </div>
    </div>
  );
}
