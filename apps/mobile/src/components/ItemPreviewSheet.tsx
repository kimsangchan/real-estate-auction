// 지도 마커 탭 시 뜨는 하단 시트 — 웹 호버 카드(ItemHoverCard)의 모바일 대응물이다.
// 모바일에는 호버가 없어 "상세로 바로 이동" 대신 미리보기를 한 단계 둔다: 지도에서 볼 수 없는
// 정보를 먼저 보여주고, 더 볼 가치가 있을 때만 상세로 들어가게 한다.
//
// 주소는 넣지 않는다 — 마커 위치가 이미 위치를 말한다(웹 카드와 같은 판단).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AuctionItem } from '../api/auctionItems';
import { formatDday, formatDropRate, formatWonCompact } from '../lib/format';
import {
  assumedRightsLabel,
  riskFlagLabels,
  shortUsageName,
  tenantLabel,
} from '../lib/notice-labels';
import { colors, radius, space, text } from '../theme';

interface Props {
  item: AuctionItem;
  onClose: () => void;
  onOpenDetail: () => void;
}

export function ItemPreviewSheet({ item, onClose, onOpenDetail }: Props) {
  const usage = shortUsageName(item.usageName);
  const dday = formatDday(item.bidDatetime);
  const drop = formatDropRate(item.appraisalAmount, item.minimumSalePrice);
  const rights = assumedRightsLabel(item.assumedRightsKind);
  const tenants = tenantLabel(item.tenantCount);
  const flags = riskFlagLabels(item.riskFlags);

  // 명세서를 한 조각도 못 받은 물건 — "인수할 권리 없음"과 구분해서 말해야 한다.
  const noticeMissing =
    rights === null && tenants === null && flags.length === 0;

  const meta = [
    usage,
    item.failedBidCount !== null ? `유찰 ${item.failedBidCount}회` : null,
    dday,
  ].filter((value): value is string => value !== null);

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.meta}>{meta.join(' · ')}</Text>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="미리보기 닫기"
        >
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.price}>
          {item.minimumSalePrice !== null
            ? formatWonCompact(item.minimumSalePrice)
            : '최저가 미상'}
        </Text>
        {drop !== null ? <Text style={styles.drop}>{drop}</Text> : null}
      </View>
      {item.appraisalAmount !== null ? (
        <Text style={styles.appraisal}>
          감정가 {formatWonCompact(item.appraisalAmount)}
        </Text>
      ) : null}

      <View style={styles.notice}>
        {noticeMissing ? (
          <Text style={styles.noticeUnknown}>매각물건명세서 미확인</Text>
        ) : (
          <View style={styles.chips}>
            {tenants !== null ? (
              <Text style={styles.chip}>{tenants}</Text>
            ) : null}
            {rights !== null ? <Text style={styles.chip}>{rights}</Text> : null}
            {flags.map(flag => (
              <Text key={flag} style={styles.chip}>
                {flag}
              </Text>
            ))}
          </View>
        )}
      </View>

      <Pressable
        style={styles.cta}
        onPress={onOpenDetail}
        accessibilityRole="button"
      >
        <Text style={styles.ctaText}>상세 보기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.base,
    paddingTop: space.base,
    paddingBottom: space.lg,
    shadowColor: '#111111',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meta: { ...text.caption, color: colors.slate, flexShrink: 1 },
  close: { ...text.bodyMd, color: colors.steel, paddingHorizontal: space.xs },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xs,
    marginTop: space.xs,
  },
  price: { ...text.subtitleLg, color: colors.inkDeep },
  drop: { ...text.caption, color: colors.slate },
  appraisal: { ...text.caption, color: colors.steel, marginTop: 2 },
  notice: {
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: {
    ...text.caption,
    color: colors.inkDeep,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  // 명세서를 못 받은 상태. "인수할 권리 없음"과 절대 같아 보이면 안 된다.
  noticeUnknown: { ...text.caption, color: colors.steel, fontStyle: 'italic' },
  cta: {
    marginTop: space.base,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    alignItems: 'center',
  },
  ctaText: { ...text.buttonMd, color: colors.onPrimary },
});
