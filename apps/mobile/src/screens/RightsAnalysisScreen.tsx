// 권리분석 결과 — 사건키로 매각물건명세서 기반 인수 판정과 실부담 시나리오를 조회해 보여준다.
// 웹 원본: apps/web/app/items/components/RightsAnalysisView.tsx (+ [id]/rights-analysis/page.tsx).
//
// 등기부(CODEF, WP-04) 연동 전이라 **매각물건명세서만으로** 계산한 결과다. 명세서에 없는 것은
// 등기 권리 목록과 채권액이라 배당표를 만들 수 없고, 그래서 인수액이 확정되지 않는 임차인이
// 생긴다. 그 한계를 화면에 반드시 적는다 — 빈 값이 "위험 없음"으로 읽히면 안 된다.
// 판단·권유 문구는 넣지 않는다 (D-011).
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchAffordability, fetchNoticeAnalysis } from '../api/auctionItems';
import { AffordabilityCustomBid } from '../components/AffordabilityCustomBid';
import { Badge, type BadgeTone } from '../components/Badge';
import {
  formatRatioRange,
  formatWonRangeCompact,
  SCENARIO_LABELS,
  type Affordability,
} from '../lib/affordability';
import { formatWon, formatWonCompact } from '../lib/format';
import {
  assumedHeadline,
  assumedTotal,
  type AnalyzedTenant,
  type NoticeAnalysis,
  type NoticeAssumption,
} from '../lib/notice-analysis';
import {
  assumedRightsLabel,
  noticeAssumptionLabel,
  noticeAssumptionReason,
  riskFlagLabels,
} from '../lib/notice-labels';
import type { RootStackParamList } from '../navigation';
import { colors, radius, space, text } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'RightsAnalysis'>;
type Status = 'loading' | 'error' | 'ok';

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

function TenantRow({
  tenant,
  last,
}: {
  tenant: AnalyzedTenant;
  last: boolean;
}) {
  const reason = noticeAssumptionReason(tenant.assumption);
  const facts = [
    tenant.moveInDate ? `전입 ${tenant.moveInDate}` : null,
    tenant.fixedDate ? `확정일자 ${tenant.fixedDate}` : null,
    tenant.demandedDistributionDate
      ? `배당요구 ${tenant.demandedDistributionDate}`
      : null,
  ].filter((value): value is string => value !== null);

  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowKind}>{tenantTitle(tenant)}</Text>
      <View style={styles.rowMain}>
        <View style={styles.rowLabelLine}>
          <Text style={styles.rowLabel}>
            {tenant.depositAmount !== null
              ? `보증금 ${formatWon(tenant.depositAmount)}`
              : '보증금 미상'}
          </Text>
        </View>
        <Text style={styles.rowDetail}>
          {facts.join(' · ') || '명세서에 적힌 값이 없어요'}
        </Text>
        {reason ? <Text style={styles.rowDetail}>{reason}</Text> : null}
      </View>
      <Badge
        tone={ASSUMPTION_TONE[tenant.assumption]}
        label={noticeAssumptionLabel(tenant.assumption)}
      />
    </View>
  );
}

/**
 * 실부담 시나리오 — "결국 얼마 들고, 감정가 대비 몇 %인가". 감정가는 시세가 아니므로
 * 기준을 화면에 밝힌다 (실거래가 연동 전 한계).
 */
function AffordabilitySection({
  affordability,
}: {
  affordability: Affordability;
}) {
  const stats = affordability.comparableSales;

  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>결국 얼마가 드나</Text>
      {affordability.bulkSale ? (
        <Text style={styles.groupEmpty}>
          일괄매각 물건이라 최저가가 묶음 전체 값이에요. 목적물 하나 기준의
          시나리오를 만들면 숫자가 틀리게 나와서 계산하지 않아요.
        </Text>
      ) : affordability.scenarios.length === 0 ? (
        <Text style={styles.groupEmpty}>
          시나리오를 만들 가격 정보가 부족해요.
        </Text>
      ) : (
        <View style={styles.table}>
          {affordability.scenarios.map((scenario, index) => (
            <View
              key={scenario.kind}
              style={[
                styles.row,
                index < affordability.scenarios.length - 1 && styles.rowBorder,
              ]}
            >
              <Text style={styles.rowKind}>
                {formatWonCompact(scenario.bidPrice)}
              </Text>
              <View style={styles.rowMain}>
                <View style={styles.rowLabelLine}>
                  <Text style={styles.rowLabel}>
                    총 {formatWonRangeCompact(scenario.totalWithExtras)}
                    {affordability.assumedIsLowerBound ? ' 이상' : ''}
                  </Text>
                </View>
                <Text style={styles.rowDetail}>
                  {SCENARIO_LABELS[scenario.kind]} · 인수·취득세·등기·명도비
                  포함
                  {scenario.appraisalRatio
                    ? ` · 감정가의 ${formatRatioRange(scenario.appraisalRatio)}`
                    : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.footnote}>
        비교 기준은 감정가예요 — 감정가는 시세가 아니라서 실거래 시세 연동
        전까지는 참고 기준이에요. 취득세는 매수인 사정(주택 수·면적)에 따라 달라
        구간으로 계산했고, 등기·명도 비용은 추정치예요. 체납 관리비(공용부분)는
        금액을 알 수 없어 합산에 없어요.
        {stats.sampleCount > 0
          ? ` 유사 가격대는 같은 용도(${stats.usage ?? '미상'}) 낙찰 ${
              stats.sampleCount
            }건의 실측 분포예요.`
          : ''}
      </Text>
    </View>
  );
}

export function RightsAnalysisScreen({ route }: Props) {
  // 인라인 객체를 그대로 의존성에 걸면 매 렌더마다 재조회된다 — 원시값으로 분해해서 건다.
  const { courtOfficeCode, caseNo, itemNo } = route.params;
  const [analysis, setAnalysis] = useState<NoticeAnalysis | null>(null);
  const [affordability, setAffordability] = useState<Affordability | null>(
    null,
  );
  const [status, setStatus] = useState<Status>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    const key = { courtOfficeCode, caseNo, itemNo };
    try {
      setAnalysis(await fetchNoticeAnalysis(key));
      // 실부담은 부가 정보라 조회에 실패해도 권리분석 본문을 막지 않는다
      try {
        setAffordability(await fetchAffordability(key));
      } catch {
        setAffordability(null);
      }
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }, [courtOfficeCode, caseNo, itemNo]);

  useEffect(() => {
    load();
  }, [load]);

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>권리분석을 불러오지 못했어요.</Text>
        <Pressable
          style={styles.retry}
          accessibilityRole="button"
          onPress={load}
        >
          <Text style={styles.retryText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  // 명세서를 아직 못 받은 물건 — "인수할 권리 없음"과 반드시 구분해 적는다
  if (analysis === null) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.groupEmpty}>
          아직 매각물건명세서를 받지 못했어요. 인수할 권리가 없다는 뜻이 아니라
          확인되지 않았다는 뜻이에요. 명세서는 매각기일 1주일 전부터 열람할 수
          있어요.
        </Text>
      </ScrollView>
    );
  }

  // API가 이미 사람 단위로 합쳐서 준다 (notice-tenant-merge.ts)
  const tenants = analysis.tenants;
  const headline = assumedHeadline(assumedTotal(tenants));
  const assumed = tenants.filter(t => t.assumption === 'ASSUMED_FULL');
  const unknown = tenants.filter(
    t =>
      t.assumption === 'ASSUMED_AMOUNT_UNKNOWN' || t.assumption === 'UNKNOWN',
  );
  const notAssumed = tenants.filter(t => t.assumption === 'NOT_ASSUMED');
  const rights = assumedRightsLabel(analysis.assumedRightsKind);
  const flags = riskFlagLabels(analysis.riskFlags);
  // 최저가는 실부담 응답이 같은 물건 값으로 함께 내려준다 — 물건 상세를 한 번 더 부르지 않는다
  const minimumSalePrice = affordability?.minimumSalePrice ?? null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.sourceNote}>
        <Text style={styles.sourceNoteText}>
          매각물건명세서로만 계산했어요. 등기부는 아직 연동하지 않아서 등기
          권리와 채권액은 빠져 있어요.
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>
          매수인이 인수하는 보증금
          {headline.kind === 'AMOUNT' && headline.isLowerBound ? ' (최소)' : ''}
        </Text>
        {/* 0원과 "모른다"를 같은 화면으로 내지 않는다 — 여기가 가장 크게 읽히는 값이다 */}
        <Text style={styles.summaryTotal}>
          {headline.kind === 'AMOUNT' ? formatWon(headline.amount) : null}
          {headline.kind === 'UNCONFIRMED' ? '확인 필요' : null}
          {headline.kind === 'NONE' ? formatWon(0) : null}
        </Text>
        <View style={styles.summaryBreakdown}>
          <Text style={styles.breakdownText}>임차인 {tenants.length}명</Text>
          {minimumSalePrice !== null ? (
            <Text style={styles.breakdownText}>
              최저가 {formatWon(minimumSalePrice)}
            </Text>
          ) : null}
        </View>
      </View>

      {headline.kind === 'UNCONFIRMED' ? (
        <Text style={styles.footnote}>
          대항력이 있는 임차인이 배당으로 보증금을 다 못 받으면 그만큼을
          매수인이 인수해요. 얼마를 회수하는지는 등기부의 권리와 채권액이 있어야
          계산할 수 있어요.
        </Text>
      ) : null}
      {headline.kind === 'AMOUNT' && headline.isLowerBound ? (
        <Text style={styles.footnote}>
          금액이 확정되지 않은 임차인이 있어 실제 인수액은 위 금액보다 클 수
          있어요.
        </Text>
      ) : null}

      {affordability ? (
        <AffordabilitySection affordability={affordability} />
      ) : null}

      <View style={styles.glanceBar}>
        <View style={[styles.glanceChip, styles.glanceAssumed]}>
          <Text style={[styles.glanceCount, styles.onWarning]}>
            {assumed.length}명
          </Text>
          <Text style={[styles.glanceChipLabel, styles.onWarning]}>
            보증금 전액 인수
          </Text>
        </View>
        <View style={[styles.glanceChip, styles.glanceReview]}>
          <Text style={[styles.glanceCount, styles.onCritical]}>
            {unknown.length}명
          </Text>
          <Text style={[styles.glanceChipLabel, styles.onCritical]}>
            금액 확인 필요
          </Text>
        </View>
        <View style={[styles.glanceChip, styles.glanceExtinguished]}>
          <Text style={[styles.glanceCount, styles.onMuted]}>
            {notAssumed.length}명
          </Text>
          <Text style={[styles.glanceChipLabel, styles.onMuted]}>
            인수 안 함
          </Text>
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>최선순위 설정</Text>
        <View style={styles.table}>
          <View style={[styles.row, styles.rowBaseline]}>
            <Text style={styles.rowKind}>말소기준</Text>
            <View style={styles.rowMain}>
              <View style={styles.rowLabelLine}>
                <Text style={styles.rowLabel}>
                  {analysis.baselineRaw ?? '명세서에 없음'}
                </Text>
              </View>
              <Text style={styles.rowDetail}>
                이 날짜보다 전입이 빠른 임차인은 매수인에게 대항할 수 있어요
                {analysis.distributionDemandDeadline
                  ? ` · 배당요구종기 ${analysis.distributionDemandDeadline}`
                  : ''}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {rights !== null || flags.length > 0 ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>명세서 기재사항</Text>
          <View style={styles.table}>
            <View style={styles.row}>
              <Text style={styles.rowKind}>법원 기재</Text>
              <View style={styles.rowMain}>
                <View style={styles.rowLabelLine}>
                  <Text style={styles.rowLabel}>
                    {rights ?? '인수되는 권리 기재 없음'}
                  </Text>
                </View>
                {flags.length > 0 ? (
                  <Text style={styles.rowDetail}>{flags.join(' · ')}</Text>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.group}>
        <Text style={[styles.groupTitle, styles.groupTitleAssumed]}>
          임차인
        </Text>
        {tenants.length > 0 ? (
          <View style={styles.table}>
            {tenants.map((tenant, index) => (
              <TenantRow
                key={tenant.tenantSeq}
                tenant={tenant}
                last={index === tenants.length - 1}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.groupEmpty}>법원이 조사한 점유자가 없어요.</Text>
        )}
      </View>

      {/* 직접 입력은 상세에서만 — 시나리오 정의는 API 한 곳에 있다 */}
      <AffordabilityCustomBid
        courtOfficeCode={courtOfficeCode}
        caseNo={caseNo}
        itemNo={itemNo}
      />

      <Text style={styles.disclaimer}>
        명세서에 적힌 사실을 규칙대로 정리한 참고 정보예요. 실제 입찰 전
        등기사항전부증명서와 명세서 원문을 꼭 확인해주세요.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.base, paddingBottom: space.xxxl },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
  message: { ...text.bodyMd, color: colors.steel },
  retry: {
    marginTop: space.base,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.full,
    paddingHorizontal: space.base,
    paddingVertical: space.sm,
  },
  retryText: { ...text.bodySmBold, color: colors.primary },

  sourceNote: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    paddingHorizontal: space.base,
    paddingVertical: space.sm,
    marginBottom: space.base,
  },
  sourceNoteText: { ...text.caption, color: colors.steel },

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
  rowDetail: { ...text.caption, color: colors.steel, marginTop: 2 },

  footnote: { ...text.caption, color: colors.stone, marginTop: space.sm },
  disclaimer: {
    ...text.caption,
    color: colors.stone,
    textAlign: 'center',
    marginTop: space.lg,
  },
});
