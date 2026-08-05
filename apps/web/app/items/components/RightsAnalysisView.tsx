// 권리분석 본문 — 상세 페이지(/items/[id]/rights-analysis)와 지도 패널이 함께 쓴다.
// 같은 물건이 두 화면에서 다르게 읽히면 안 되므로 마크업을 한 곳에만 둔다.
//
// 등기부(CODEF, WP-04) 연동 전이라 **매각물건명세서만으로** 계산한 결과를 보여준다.
// 명세서에 없는 것은 등기 권리 목록과 채권액이라, 배당표를 만들 수 없고 그래서 인수액이
// 확정되지 않는 임차인이 생긴다. 그 한계를 화면에 반드시 적는다 — 빈 값이 "위험 없음"으로
// 읽히면 안 된다. 판단·권유 문구는 넣지 않는다 (D-011).
import { Badge, type BadgeTone } from './Badge';
import { formatWon } from '../format';
import {
  assumedHeadline,
  assumedTotal,
  dedupeTenants,
  type AnalyzedTenant,
  type NoticeAnalysis,
  type NoticeAssumption,
} from '../notice-analysis';
import {
  assumedRightsLabel,
  noticeAssumptionLabel,
  noticeAssumptionReason,
  riskFlagLabels,
} from '../notice-labels';
import styles from './RightsAnalysisView.module.css';

const ASSUMPTION_TONE: Record<NoticeAssumption, BadgeTone> = {
  NOT_ASSUMED: 'muted',
  ASSUMED_FULL: 'warning',
  ASSUMED_AMOUNT_UNKNOWN: 'critical',
  UNKNOWN: 'critical',
};

function tenantTitle(tenant: AnalyzedTenant): string {
  // 성명은 API가 내려주지 않는다 — 점유부분이 사람을 가리키는 유일한 값이다
  return tenant.occupiedPart ?? `점유자 ${tenant.tenantSeq}`;
}

function TenantRow({ tenant }: { tenant: AnalyzedTenant }) {
  const reason = noticeAssumptionReason(tenant.assumption);
  const facts = [
    tenant.moveInDate ? `전입 ${tenant.moveInDate}` : null,
    tenant.fixedDate ? `확정일자 ${tenant.fixedDate}` : null,
    tenant.demandedDistributionDate ? `배당요구 ${tenant.demandedDistributionDate}` : null,
  ].filter((value): value is string => value !== null);

  return (
    <div className={styles.row}>
      <span className={styles.rowKind}>{tenantTitle(tenant)}</span>
      <div className={styles.rowMain}>
        <div className={styles.rowLabelLine}>
          <span className={styles.rowLabel}>
            {tenant.depositAmount !== null ? `보증금 ${formatWon(tenant.depositAmount)}` : '보증금 미상'}
          </span>
        </div>
        <p className={styles.rowDetail}>{facts.join(' · ') || '명세서에 적힌 값이 없어요'}</p>
        {reason ? <p className={styles.rowDetail}>{reason}</p> : null}
      </div>
      <Badge tone={ASSUMPTION_TONE[tenant.assumption]}>
        {noticeAssumptionLabel(tenant.assumption)}
      </Badge>
    </div>
  );
}

export interface RightsBasis {
  minimumSalePrice: number | null;
}

export function RightsAnalysisView({
  analysis,
  basis,
}: {
  /** null이면 명세서를 아직 못 받은 물건이다 — "인수할 권리 없음"과 다르다 */
  analysis: NoticeAnalysis | null;
  basis?: RightsBasis;
}) {
  if (analysis === null) {
    return (
      <div className={styles.root}>
        <p className={styles.groupEmpty}>
          아직 매각물건명세서를 받지 못했어요. 인수할 권리가 없다는 뜻이 아니라 확인되지 않았다는
          뜻이에요. 명세서는 매각기일 1주일 전부터 열람할 수 있어요.
        </p>
      </div>
    );
  }

  const tenants = dedupeTenants(analysis.tenants);
  const headline = assumedHeadline(assumedTotal(tenants));
  const assumed = tenants.filter((t) => t.assumption === 'ASSUMED_FULL');
  const unknown = tenants.filter(
    (t) => t.assumption === 'ASSUMED_AMOUNT_UNKNOWN' || t.assumption === 'UNKNOWN',
  );
  const notAssumed = tenants.filter((t) => t.assumption === 'NOT_ASSUMED');
  const rights = assumedRightsLabel(analysis.assumedRightsKind);
  const flags = riskFlagLabels(analysis.riskFlags);

  return (
    <div className={styles.root}>
      <p className={styles.sourceNote}>
        매각물건명세서로만 계산했어요. 등기부는 아직 연동하지 않아서 등기 권리와 채권액은 빠져
        있어요.
      </p>

      <section className={styles.summaryCard}>
        <p className={styles.summaryLabel}>
          매수인이 인수하는 보증금
          {headline.kind === 'AMOUNT' && headline.isLowerBound ? ' (최소)' : ''}
        </p>
        {/* 0원과 "모른다"를 같은 화면으로 내지 않는다 — 여기가 가장 크게 읽히는 값이다 */}
        <p className={styles.summaryTotal}>
          {headline.kind === 'AMOUNT' ? formatWon(headline.amount) : null}
          {headline.kind === 'UNCONFIRMED' ? '확인 필요' : null}
          {headline.kind === 'NONE' ? formatWon(0) : null}
        </p>
        <div className={styles.summaryBreakdown}>
          <span>임차인 {tenants.length}명</span>
          {basis?.minimumSalePrice != null ? (
            <span>최저가 {formatWon(basis.minimumSalePrice)}</span>
          ) : null}
        </div>
      </section>

      {headline.kind === 'UNCONFIRMED' ? (
        <p className={styles.footnote}>
          대항력이 있는 임차인이 배당으로 보증금을 다 못 받으면 그만큼을 매수인이 인수해요.
          얼마를 회수하는지는 등기부의 권리와 채권액이 있어야 계산할 수 있어요.
        </p>
      ) : null}
      {headline.kind === 'AMOUNT' && headline.isLowerBound ? (
        <p className={styles.footnote}>
          금액이 확정되지 않은 임차인이 있어 실제 인수액은 위 금액보다 클 수 있어요.
        </p>
      ) : null}

      <div className={styles.glanceBar}>
        <div className={`${styles.glanceChip} ${styles.glanceAssumed}`}>
          <span className={styles.glanceChipCount}>{assumed.length}명</span>
          <span className={styles.glanceChipLabel}>보증금 전액 인수</span>
        </div>
        <div className={`${styles.glanceChip} ${styles.glanceReview}`}>
          <span className={styles.glanceChipCount}>{unknown.length}명</span>
          <span className={styles.glanceChipLabel}>금액 확인 필요</span>
        </div>
        <div className={`${styles.glanceChip} ${styles.glanceExtinguished}`}>
          <span className={styles.glanceChipCount}>{notAssumed.length}명</span>
          <span className={styles.glanceChipLabel}>인수 안 함</span>
        </div>
      </div>

      <section className={styles.groupBlock}>
        <h3 className={styles.groupTitle}>최선순위 설정</h3>
        <div className={styles.table}>
          <div className={`${styles.row} ${styles.rowBaseline}`}>
            <span className={styles.rowKind}>말소기준</span>
            <div className={styles.rowMain}>
              <div className={styles.rowLabelLine}>
                <span className={styles.rowLabel}>{analysis.baselineRaw ?? '명세서에 없음'}</span>
              </div>
              <p className={styles.rowDetail}>
                이 날짜보다 전입이 빠른 임차인은 매수인에게 대항할 수 있어요
                {analysis.distributionDemandDeadline
                  ? ` · 배당요구종기 ${analysis.distributionDemandDeadline}`
                  : ''}
              </p>
            </div>
          </div>
        </div>
      </section>

      {rights !== null || flags.length > 0 ? (
        <section className={styles.groupBlock}>
          <h3 className={styles.groupTitle}>명세서 기재사항</h3>
          <div className={styles.table}>
            <div className={styles.row}>
              <span className={styles.rowKind}>법원 기재</span>
              <div className={styles.rowMain}>
                <div className={styles.rowLabelLine}>
                  <span className={styles.rowLabel}>{rights ?? '인수되는 권리 기재 없음'}</span>
                </div>
                {flags.length > 0 ? <p className={styles.rowDetail}>{flags.join(' · ')}</p> : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.groupBlock}>
        <h3 className={`${styles.groupTitle} ${styles.groupTitleAssumed}`}>임차인</h3>
        {tenants.length > 0 ? (
          <div className={styles.table}>
            {tenants.map((tenant) => (
              <TenantRow key={`${tenant.tenantSeq}-${tenant.sourceKind}`} tenant={tenant} />
            ))}
          </div>
        ) : (
          <p className={styles.groupEmpty}>법원이 조사한 점유자가 없어요.</p>
        )}
      </section>

      <p className={styles.disclaimer}>
        명세서에 적힌 사실을 규칙대로 정리한 참고 정보예요. 실제 입찰 전 등기사항전부증명서와
        명세서 원문을 꼭 확인해주세요.
      </p>
    </div>
  );
}
