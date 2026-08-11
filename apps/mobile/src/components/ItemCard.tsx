// 물건 목록 카드 — 용도·주소·최저가·최저가율·감정가·유찰·매각기일 요약을 보여주고 탭하면 상세로 이동한다.
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AuctionItem } from '../api/auctionItems';
import {
  computeMinimumBidRate,
  formatBidDatetime,
  formatWon,
  formatWonCompact,
} from '../lib/format';
import { assumedDepositCardLabel } from '../lib/notice-labels';
import { colors, radius, space, text } from '../theme';

function ItemCardComponent({
  item,
  onPress,
}: {
  item: AuctionItem;
  onPress: () => void;
}) {
  const minRate = computeMinimumBidRate(
    item.appraisalAmount,
    item.minimumSalePrice,
  );
  const bidLabel = formatBidDatetime(item.bidDatetime);
  // 가격만 보고 인수 부담을 놓치는 것이 입문자의 첫 사고다 — 목록에서부터 같이 보인다.
  // null이면 명세서를 못 받은 것이라 "인수 없음"으로 적지 않고 미확인으로 표기한다.
  const assumedLabel = assumedDepositCardLabel(
    item.assumedDeposit,
    formatWonCompact,
  );

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      android_ripple={{ color: colors.hairlineSoft }}
    >
      {item.usageName ? (
        <View style={styles.usageBadge}>
          <Text style={styles.usageText}>{item.usageName}</Text>
        </View>
      ) : null}
      <Text style={styles.address} numberOfLines={2}>
        {item.address ?? '주소 정보 없음'}
      </Text>

      <View style={styles.priceRow}>
        <Text style={styles.minPrice}>
          {item.minimumSalePrice !== null
            ? formatWon(item.minimumSalePrice)
            : '가격 정보 없음'}
        </Text>
        {minRate !== null ? (
          <Text style={styles.minRate}>최저가율 {minRate}%</Text>
        ) : null}
      </View>
      {item.appraisalAmount !== null ? (
        <Text style={styles.appraised}>
          감정가{' '}
          <Text style={styles.strike}>{formatWon(item.appraisalAmount)}</Text>
        </Text>
      ) : null}

      <View style={styles.chips}>
        {item.failedBidCount !== null ? (
          <View style={[styles.chip, styles.chipFailed]}>
            <Text style={styles.chipFailedText}>
              {item.failedBidCount}회 유찰
            </Text>
          </View>
        ) : null}
        {bidLabel ? (
          <View style={[styles.chip, styles.chipDate]}>
            <Text style={styles.chipDateText}>매각기일 {bidLabel}</Text>
          </View>
        ) : null}
        {assumedLabel ? (
          <View style={[styles.chip, styles.chipAssumed]}>
            <Text style={styles.chipAssumedText}>{assumedLabel}</Text>
          </View>
        ) : (
          <View style={[styles.chip, styles.chipUnknown]}>
            <Text style={styles.chipUnknownText}>명세서 미확인</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export const ItemCard = memo(ItemCardComponent);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.canvas,
    borderRadius: radius.xxxl,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    padding: space.xl,
  },
  usageBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    marginBottom: space.sm,
  },
  usageText: { ...text.captionBold, color: colors.slate },
  address: {
    ...text.subtitleLg,
    color: colors.inkDeep,
    marginBottom: space.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
    marginBottom: 2,
  },
  minPrice: { ...text.headingSm, color: colors.inkDeep },
  minRate: { ...text.bodySmBold, color: colors.criticalStrong },
  appraised: { ...text.caption, color: colors.stone, marginBottom: space.base },
  strike: { textDecorationLine: 'line-through' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: {
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  chipFailed: { backgroundColor: colors.critical },
  chipFailedText: { ...text.captionBold, color: colors.canvas },
  chipDate: { backgroundColor: colors.inkDeep },
  chipDateText: { ...text.captionBold, color: colors.canvas },
  // 인수 보증금 — 권리분석 화면의 인수 배지와 같은 톤
  chipAssumed: { backgroundColor: colors.warning },
  chipAssumedText: { ...text.captionBold, color: colors.inkDeep },
  // 명세서 미확인. "인수 없음"과 같아 보이면 안 된다
  chipUnknown: { backgroundColor: colors.surfaceSoft },
  chipUnknownText: { ...text.caption, color: colors.slate },
});
