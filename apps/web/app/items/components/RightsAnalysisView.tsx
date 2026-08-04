// 권리분석 본문 — 상세 페이지(/items/[id]/rights-analysis)와 지도 패널이 함께 쓴다.
// 같은 물건이 두 화면에서 다르게 읽히면 안 되므로 마크업을 한 곳에만 둔다.
// 예시 데이터 고지를 컴포넌트 안에 넣은 이유: 쓰는 쪽이 고지를 빠뜨리면 예시가 실제 분석으로 읽힌다.
import Link from 'next/link';
import { Badge, type BadgeTone } from './Badge';
import { SampleDataNotice } from './SampleDataNotice';
import { formatWon } from '../format';
import { buildRightsSummary, type RightsRow } from '../rights-rows';
import {
  sampleBaselineDate,
  sampleBidPrice,
  sampleItem,
  sampleRights,
  sampleTenants,
  sampleTotalAssumedAmount,
  sampleUnregisteredRisks,
  type RightStatus,
} from '../sample-data';
import styles from './RightsAnalysisView.module.css';

const STATUS_LABEL: Record<RightStatus, string> = {
  ASSUMED: '인수',
  EXTINGUISHED: '말소',
  NEEDS_REVIEW: '확인 필요',
};

const STATUS_TONE: Record<RightStatus, BadgeTone> = {
  ASSUMED: 'warning',
  EXTINGUISHED: 'muted',
  NEEDS_REVIEW: 'critical',
};

function RowList({ rows }: { rows: RightsRow[] }) {
  return (
    <div className={styles.table}>
      {rows.map((row) => (
        <div key={row.id} className={row.isBaseline ? `${styles.row} ${styles.rowBaseline}` : styles.row}>
          <span className={styles.rowKind}>{row.kind}</span>
          <div className={styles.rowMain}>
            <div className={styles.rowLabelLine}>
              <span className={styles.rowLabel}>{row.label}</span>
              {row.isBaseline ? <span className={styles.baselineTag}>말소기준</span> : null}
            </div>
            <p className={styles.rowDetail}>{row.detail}</p>
          </div>
          <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
        </div>
      ))}
    </div>
  );
}

/**
 * 총 부담 계산의 기준 금액. 이 물건의 최저가를 넘기면 "최저가로 낙찰받았을 때"를 계산하고,
 * 넘기지 않으면 예시 입찰가를 쓴다.
 *
 * 지도 패널처럼 실제 물건 정보 바로 아래에 붙을 때 예시 요약(유찰 17회 등)을 같이 띄우면
 * 한 화면에 서로 다른 숫자가 나란히 보여 어느 쪽이 이 물건 것인지 읽을 수 없다.
 */
export interface RightsBasis {
  minimumSalePrice: number | null;
}

export function RightsAnalysisView({ itemId, basis }: { itemId: string; basis?: RightsBasis }) {
  const basisAmount = basis ? basis.minimumSalePrice : sampleBidPrice;
  const totalBurden = basisAmount === null ? null : basisAmount + sampleTotalAssumedAmount;
  const { assumed, needsReview, extinguished } = buildRightsSummary(
    sampleRights,
    sampleTenants,
    sampleUnregisteredRisks,
  );

  return (
    <div className={styles.root}>
      <SampleDataNotice source="등기부" />

      {totalBurden !== null ? (
        <section className={styles.summaryCard}>
          {basis ? null : (
            <p className={styles.summaryLabel}>
              {sampleItem.usageName} · 유찰 {sampleItem.failedBidCount}회 · 최저가율{' '}
              {sampleItem.minimumBidRate}%
            </p>
          )}
          <p className={styles.summaryTotal}>{formatWon(totalBurden)}</p>
          <div className={styles.summaryBreakdown}>
            <span>
              {basis ? '최저가' : '입찰가'} {formatWon(basisAmount as number)}
            </span>
            <span>+ 인수 보증금 {formatWon(sampleTotalAssumedAmount)}</span>
          </div>
        </section>
      ) : null}

      <div className={styles.glanceBar}>
        <div className={`${styles.glanceChip} ${styles.glanceAssumed}`}>
          <span className={styles.glanceChipCount}>{assumed.length}건</span>
          <span className={styles.glanceChipLabel}>인수해야 할 권리</span>
        </div>
        <div className={`${styles.glanceChip} ${styles.glanceReview}`}>
          <span className={styles.glanceChipCount}>{needsReview.length}건</span>
          <span className={styles.glanceChipLabel}>확인이 필요해요</span>
        </div>
        <div className={`${styles.glanceChip} ${styles.glanceExtinguished}`}>
          <span className={styles.glanceChipCount}>{extinguished.length}건</span>
          <span className={styles.glanceChipLabel}>말소돼요</span>
        </div>
      </div>

      <section className={styles.groupBlock}>
        <h3 className={`${styles.groupTitle} ${styles.groupTitleAssumed}`}>인수해야 할 권리</h3>
        {assumed.length > 0 ? (
          <RowList rows={assumed} />
        ) : (
          <p className={styles.groupEmpty}>매수인이 추가로 떠안는 권리가 없어요.</p>
        )}
      </section>

      {needsReview.length > 0 ? (
        <section className={styles.groupBlock}>
          <h3 className={styles.groupTitle}>확인이 필요해요</h3>
          <RowList rows={needsReview} />
          <Link href={`/items/${itemId}/risks`} className={styles.footnoteLink}>
            원문·다음 행동 자세히 보기 →
          </Link>
        </section>
      ) : null}

      <section className={styles.groupBlock}>
        <h3 className={styles.groupTitle}>말소되는 권리</h3>
        <div className={styles.tableMuted}>
          <RowList rows={extinguished} />
        </div>
        <p className={styles.footnote}>
          {sampleBaselineDate}에 접수된 권리가 말소기준이에요. 담보물권·압류 계열은 말소기준 위치와
          무관하게 항상 말소돼요. (규칙: RIGHT_CLASSIFICATION v1)
        </p>
      </section>

      <p className={styles.disclaimer}>
        규칙 기반으로 정리한 참고 정보예요. 실제 입찰 전 법원 서류 원문을 꼭 확인해주세요.
      </p>
    </div>
  );
}
