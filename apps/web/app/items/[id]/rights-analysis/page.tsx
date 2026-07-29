// 권리분석 결과 화면 — "인수해야 할 권리가 있는지"를 최우선으로 보여주고, 유찰 이력(가격 정보)과
// 나란히 비교할 수 있게 구성한다. 인수 위험이 없다는 사실도 명시적으로 드러내 "유찰이 잦았던 이유가
// 가격 때문인지 권리 때문인지" 사용자가 스스로 판단할 근거를 준다. 판단·권유 문구는 넣지 않는다 (D-011).
// 실제 등기부 조회는 CODEF 유료 호출이 필요해(WP-04) 이 화면은 아직 sample-data.ts 예시로 남아있다.
import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, type BadgeTone } from '../../components/Badge';
import { formatWon } from '../../format';
import {
  sampleBaselineDate,
  sampleBidPrice,
  sampleItem,
  sampleRights,
  sampleTenants,
  sampleTotalAssumedAmount,
  sampleUnregisteredRisks,
  type RightStatus,
} from '../../sample-data';
import { NOINDEX } from '../../../seo';
import styles from './page.module.css';

// 아직 sample-data를 렌더해 물건 ID와 무관하게 본문이 같다 — 색인되면 중복 콘텐츠이자
// 예시 분석이 특정 물건의 실제 분석처럼 노출된다. 실데이터 연동 시 해제 (WP-10 §1-3)
export const metadata: Metadata = { robots: NOINDEX };

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

interface SummaryRow {
  id: string;
  kind: string;
  label: string;
  detail: string;
  status: RightStatus;
  isBaseline?: boolean;
}

function RowList({ rows }: { rows: SummaryRow[] }) {
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

export default async function RightsAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const totalBurden = sampleBidPrice + sampleTotalAssumedAmount;

  const rightRows: SummaryRow[] = sampleRights.map((right) => ({
    id: right.id,
    kind: '등기 권리',
    label: right.label,
    detail: `접수 ${right.receivedDate}`,
    status: right.status,
    isBaseline: right.isBaseline,
  }));

  const tenantRows: SummaryRow[] = sampleTenants.map((tenant) => ({
    id: tenant.id,
    kind: '임차인',
    label: `${tenant.label} · 보증금 ${formatWon(tenant.depositAmount)}`,
    detail: `대항력 ${tenant.possessionRightDate} · 인수 보증금 ${formatWon(tenant.assumedAmount)}`,
    status: tenant.status,
  }));

  const reviewRows: SummaryRow[] = sampleUnregisteredRisks.map((risk) => ({
    id: risk.id,
    kind: '확인 필요',
    label: risk.label,
    detail: '등기부에 없는 내용 — 임장 체크리스트에서 확인해요',
    status: 'NEEDS_REVIEW' as const,
  }));

  const allRows = [...rightRows, ...tenantRows, ...reviewRows];
  const assumedRows = allRows.filter((row) => row.status === 'ASSUMED');
  const needsReviewRows = allRows.filter((row) => row.status === 'NEEDS_REVIEW');
  const extinguishedRows = allRows.filter((row) => row.status === 'EXTINGUISHED');

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>권리분석 결과</h1>

      <section className={styles.summaryCard}>
        <p className={styles.summaryLabel}>
          {sampleItem.usageName} · 유찰 {sampleItem.failedBidCount}회 · 최저가율 {sampleItem.minimumBidRate}%
        </p>
        <p className={styles.summaryTotal}>{formatWon(totalBurden)}</p>
        <div className={styles.summaryBreakdown}>
          <span>입찰가 {formatWon(sampleBidPrice)}</span>
          <span>+ 인수 보증금 {formatWon(sampleTotalAssumedAmount)}</span>
        </div>
      </section>

      <div className={styles.glanceBar}>
        <div className={`${styles.glanceChip} ${styles.glanceAssumed}`}>
          <span className={styles.glanceChipCount}>{assumedRows.length}건</span>
          <span className={styles.glanceChipLabel}>인수해야 할 권리</span>
        </div>
        <div className={`${styles.glanceChip} ${styles.glanceReview}`}>
          <span className={styles.glanceChipCount}>{needsReviewRows.length}건</span>
          <span className={styles.glanceChipLabel}>확인이 필요해요</span>
        </div>
        <div className={`${styles.glanceChip} ${styles.glanceExtinguished}`}>
          <span className={styles.glanceChipCount}>{extinguishedRows.length}건</span>
          <span className={styles.glanceChipLabel}>말소돼요</span>
        </div>
      </div>

      <section className={styles.groupBlock}>
        <h2 className={`${styles.groupTitle} ${styles.groupTitleAssumed}`}>인수해야 할 권리</h2>
        {assumedRows.length > 0 ? (
          <RowList rows={assumedRows} />
        ) : (
          <p className={styles.groupEmpty}>매수인이 추가로 떠안는 권리가 없어요.</p>
        )}
      </section>

      {needsReviewRows.length > 0 ? (
        <section className={styles.groupBlock}>
          <h2 className={styles.groupTitle}>확인이 필요해요</h2>
          <RowList rows={needsReviewRows} />
          <Link href={`/items/${id}/risks`} className={styles.footnoteLink}>
            원문·다음 행동 자세히 보기 →
          </Link>
        </section>
      ) : null}

      <section className={styles.groupBlock}>
        <h2 className={styles.groupTitle}>말소되는 권리</h2>
        <div className={styles.tableMuted}>
          <RowList rows={extinguishedRows} />
        </div>
        <p className={styles.footnote}>
          {sampleBaselineDate}에 접수된 권리가 말소기준이에요. 담보물권·압류 계열은 말소기준 위치와
          무관하게 항상 말소돼요. (규칙: RIGHT_CLASSIFICATION v1)
        </p>
      </section>

      <p className={styles.disclaimer}>
        규칙 기반으로 정리한 참고 정보예요. 실제 입찰 전 법원 서류 원문을 꼭 확인해주세요.
      </p>
    </main>
  );
}
