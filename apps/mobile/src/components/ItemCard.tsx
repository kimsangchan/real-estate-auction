// 물건 목록 카드 — 용도·주소·최저가·최저가율·감정가·유찰·매각기일 요약을 보여주고 탭하면 상세로 이동한다.
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AuctionItem } from '../api/auctionItems';
import {
  computeMinimumBidRate,
  formatBidDatetime,
  formatWon,
} from '../lib/format';
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
});
