// 지도 마커 호버 카드 — 지도에서 볼 수 없는 정보만 보여준다.
// 주소는 넣지 않는다: 마커 위치가 이미 위치를 말하고, 좁은 카드 폭을 가장 많이 잡아먹는다.
// 핵심은 명세서 구획이다 — 입문자가 가격·유찰만 보고 놓치는 인수 부담이 여기서 처음 드러난다.
'use client';

import {
  formatAreaM2,
  formatDday,
  formatDropRate,
  formatPyeong,
  formatUnitPrice,
  formatWonCompact,
} from '../format';
import { assumedRightsLabel, riskFlagLabels, shortUsageName, tenantLabel } from '../notice-labels';
import styles from './ItemHoverCard.module.css';

export interface HoverCardItem {
  usageName: string | null;
  areaM2: number | null;
  appraisalAmount: number | null;
  minimumSalePrice: number | null;
  failedBidCount: number | null;
  bidDatetime: string | null;
  assumedRightsKind: string | null;
  riskFlags: string[];
  tenantCount: number | null;
}

interface Props {
  item: HoverCardItem;
  /** 마커 기준 화면 좌표. 카드가 뷰포트를 벗어나지 않게 호출부가 보정해 넘긴다. */
  left: number;
  top: number;
}

export function ItemHoverCard({ item, left, top }: Props) {
  const usage = shortUsageName(item.usageName);
  const dday = formatDday(item.bidDatetime);
  const drop = formatDropRate(item.appraisalAmount, item.minimumSalePrice);
  const rights = assumedRightsLabel(item.assumedRightsKind);
  const tenants = tenantLabel(item.tenantCount);
  const flags = riskFlagLabels(item.riskFlags);

  // 명세서를 한 조각도 못 받은 물건 — "인수할 권리 없음"과 구분해서 말해야 한다.
  const noticeMissing = rights === null && tenants === null && flags.length === 0;

  // 면적은 평·㎡ 둘 다 보여준다 — 평이 익숙한 사람과 ㎡가 익숙한 사람이 갈린다.
  const pyeong = formatPyeong(item.areaM2);
  const areaM2 = formatAreaM2(item.areaM2);
  const perPyeong = formatUnitPrice(item.minimumSalePrice, item.areaM2, 'pyeong');
  const perM2 = formatUnitPrice(item.minimumSalePrice, item.areaM2, 'm2');

  const meta = [
    usage,
    pyeong && areaM2 ? `${pyeong} (${areaM2})` : null,
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
      {perPyeong && perM2 ? (
        <div className={styles.unitPrice}>
          {perPyeong} · {perM2}
        </div>
      ) : null}
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
