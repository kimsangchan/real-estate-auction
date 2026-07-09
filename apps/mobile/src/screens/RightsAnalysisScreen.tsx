// 권리분석 결과(예시 데이터) — 인수해야 할 권리를 최우선으로 보여주고 유찰 이력과 나란히 비교한다.
// CODEF 실호출(유료) 연동 전까지 예시 데이터를 렌더하며, 판단·권유 문구는 넣지 않는다(D-011).
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, type BadgeTone } from '../components/Badge';
import { formatWon } from '../lib/format';
import {
  sampleBaselineDate,
  sampleBidPrice,
  sampleRights,
  sampleSummary,
  sampleTenants,
  sampleTotalAssumedAmount,
  sampleUnregisteredRisks,
  type RightStatus,
} from '../lib/rightsSample';
import { colors, radius, space, text } from '../theme';

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

interface Row {
  id: string;
  kind: string;
  label: string;
  detail: string;
  status: RightStatus;
  isBaseline?: boolean;
}

function RowItem({ row, last }: { row: Row; last: boolean }) {
  return (
    <View
      style={[
        styles.row,
        !last && styles.rowBorder,
        row.isBaseline && styles.rowBaseline,
      ]}
    >
      <Text style={styles.rowKind}>{row.kind}</Text>
      <View style={styles.rowMain}>
        <View style={styles.rowLabelLine}>
          <Text style={styles.rowLabel}>{row.label}</Text>
          {row.isBaseline ? (
            <View style={styles.baselineTag}>
              <Text style={styles.baselineTagText}>말소기준</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.rowDetail}>{row.detail}</Text>
      </View>
      <Badge tone={STATUS_TONE[row.status]} label={STATUS_LABEL[row.status]} />
    </View>
  );
}

function RowList({ rows }: { rows: Row[] }) {
  return (
    <View style={styles.table}>
      {rows.map((row, index) => (
        <RowItem key={row.id} row={row} last={index === rows.length - 1} />
      ))}
    </View>
  );
}

export function RightsAnalysisScreen() {
  const totalBurden = sampleBidPrice + sampleTotalAssumedAmount;

  const rightRows: Row[] = sampleRights.map(right => ({
    id: `right-${right.id}`,
    kind: '등기 권리',
    label: right.label,
    detail: `접수 ${right.receivedDate}`,
    status: right.status,
    isBaseline: right.isBaseline,
  }));
  const tenantRows: Row[] = sampleTenants.map(tenant => ({
    id: `tenant-${tenant.id}`,
    kind: '임차인',
    label: `${tenant.label} · 보증금 ${formatWon(tenant.depositAmount)}`,
    detail: `대항력 ${tenant.possessionRightDate} · 인수 보증금 ${formatWon(
      tenant.assumedAmount,
    )}`,
    status: tenant.status,
  }));
  const reviewRows: Row[] = sampleUnregisteredRisks.map(risk => ({
    id: `review-${risk.id}`,
    kind: '확인 필요',
    label: risk.label,
    detail: '등기부에 없는 내용 — 임장 체크리스트에서 확인해요',
    status: 'NEEDS_REVIEW' as const,
  }));

  const allRows = [...rightRows, ...tenantRows, ...reviewRows];
  const assumedRows = allRows.filter(row => row.status === 'ASSUMED');
  const needsReviewRows = allRows.filter(row => row.status === 'NEEDS_REVIEW');
  const extinguishedRows = allRows.filter(row => row.status === 'EXTINGUISHED');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.sampleNote}>
        <Text style={styles.sampleNoteText}>
          예시 데이터 — 실제 등기부 연동 전 화면 미리보기예요.
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>
          {sampleSummary.usageName} · 유찰 {sampleSummary.failedBidCount}회 ·
          최저가율 {sampleSummary.minimumBidRate}%
        </Text>
        <Text style={styles.summaryTotal}>{formatWon(totalBurden)}</Text>
        <View style={styles.summaryBreakdown}>
          <Text style={styles.breakdownText}>
            입찰가 {formatWon(sampleBidPrice)}
          </Text>
          <Text style={styles.breakdownText}>
            + 인수 보증금 {formatWon(sampleTotalAssumedAmount)}
          </Text>
        </View>
      </View>

      <View style={styles.glanceBar}>
        <View style={[styles.glanceChip, styles.glanceAssumed]}>
          <Text style={[styles.glanceCount, styles.onWarning]}>
            {assumedRows.length}건
          </Text>
          <Text style={[styles.glanceChipLabel, styles.onWarning]}>
            인수해야 할 권리
          </Text>
        </View>
        <View style={[styles.glanceChip, styles.glanceReview]}>
          <Text style={[styles.glanceCount, styles.onCritical]}>
            {needsReviewRows.length}건
          </Text>
          <Text style={[styles.glanceChipLabel, styles.onCritical]}>
            확인이 필요해요
          </Text>
        </View>
        <View style={[styles.glanceChip, styles.glanceExtinguished]}>
          <Text style={[styles.glanceCount, styles.onMuted]}>
            {extinguishedRows.length}건
          </Text>
          <Text style={[styles.glanceChipLabel, styles.onMuted]}>말소돼요</Text>
        </View>
      </View>

      <View style={styles.group}>
        <Text style={[styles.groupTitle, styles.groupTitleAssumed]}>
          인수해야 할 권리
        </Text>
        {assumedRows.length > 0 ? (
          <RowList rows={assumedRows} />
        ) : (
          <Text style={styles.groupEmpty}>
            매수인이 추가로 떠안는 권리가 없어요.
          </Text>
        )}
      </View>

      {needsReviewRows.length > 0 ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>확인이 필요해요</Text>
          <RowList rows={needsReviewRows} />
        </View>
      ) : null}

      <View style={styles.group}>
        <Text style={styles.groupTitle}>말소되는 권리</Text>
        <View style={styles.tableMuted}>
          <RowList rows={extinguishedRows} />
        </View>
        <Text style={styles.footnote}>
          {sampleBaselineDate}에 접수된 권리가 말소기준이에요. 담보물권·압류
          계열은 말소기준 위치와 무관하게 항상 말소돼요. (규칙:
          RIGHT_CLASSIFICATION v1)
        </Text>
      </View>

      <Text style={styles.disclaimer}>
        규칙 기반으로 정리한 참고 정보예요. 실제 입찰 전 법원 서류 원문을 꼭
        확인해주세요.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.base, paddingBottom: space.xxxl },

  sampleNote: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    paddingHorizontal: space.base,
    paddingVertical: space.sm,
    marginBottom: space.base,
  },
  sampleNoteText: { ...text.caption, color: colors.steel },

  summaryCard: {
    backgroundColor: colors.canvas,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    padding: space.lg,
    marginBottom: space.base,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryLabel: { ...text.bodySm, color: colors.steel, marginBottom: 2 },
  summaryTotal: {
    fontSize: 34,
    fontWeight: '500',
    color: colors.inkDeep,
    marginBottom: space.sm,
  },
  summaryBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
    paddingTop: space.sm,
  },
  breakdownText: { ...text.bodySm, color: colors.charcoal },

  glanceBar: { flexDirection: 'row', gap: space.sm, marginBottom: space.xl },
  glanceChip: {
    flex: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space.base,
    paddingVertical: space.sm,
    alignItems: 'center',
  },
  glanceCount: { fontSize: 22, fontWeight: '500' },
  glanceChipLabel: { ...text.caption, marginTop: 2, textAlign: 'center' },
  glanceAssumed: { backgroundColor: colors.warning },
  glanceReview: { backgroundColor: colors.critical },
  glanceExtinguished: { backgroundColor: colors.surfaceSoft },
  onWarning: { color: colors.inkDeep },
  onCritical: { color: colors.canvas },
  onMuted: { color: colors.slate },

  group: { marginBottom: space.xl },
  groupTitle: {
    ...text.subtitleLg,
    color: colors.inkDeep,
    marginBottom: space.sm,
  },
  groupTitleAssumed: { color: colors.criticalStrong },
  groupEmpty: {
    ...text.bodySm,
    color: colors.steel,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.base,
  },

  table: {
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    overflow: 'hidden',
  },
  tableMuted: { opacity: 0.72 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft },
  rowBaseline: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  rowKind: { ...text.caption, width: 64, color: colors.stone },
  rowMain: { flex: 1 },
  rowLabelLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    flexWrap: 'wrap',
  },
  rowLabel: { ...text.bodySmBold, color: colors.ink },
  baselineTag: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: space.xs,
    paddingVertical: 1,
  },
  baselineTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDeep,
  },
  rowDetail: { ...text.caption, color: colors.steel, marginTop: 2 },

  footnote: { ...text.caption, color: colors.stone, marginTop: space.sm },
  disclaimer: {
    ...text.caption,
    color: colors.stone,
    textAlign: 'center',
    marginTop: space.lg,
  },
});
