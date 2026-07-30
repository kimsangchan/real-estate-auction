// 물건 상세 — 라우트 파라미터의 사건키로 실제 수집 데이터를 조회해 가격 헤더·물건 개요·하단 CTA를 표시한다.
// 하단 CTA는 권리분석 화면(예시 데이터)으로 이동한다(웹 apps/web의 상세 화면과 동일한 구성).
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  fetchAuctionItem,
  fetchAuctionItemPhotos,
  photoImageUrl,
  type AuctionItem,
  type AuctionItemPhoto,
} from '../api/auctionItems';
import { FavoriteButton } from '../components/FavoriteButton';
import {
  computeMinimumBidRate,
  formatBidDatetime,
  formatWon,
} from '../lib/format';
import type { RootStackParamList } from '../navigation';
import { colors, radius, space, text } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemDetail'>;
type Status = 'loading' | 'error' | 'notfound' | 'ok';

export function ItemDetailScreen({ route, navigation }: Props) {
  const { courtOfficeCode, caseNo, itemNo } = route.params;
  const [item, setItem] = useState<AuctionItem | null>(null);
  const [photos, setPhotos] = useState<AuctionItemPhoto[]>([]);
  const [status, setStatus] = useState<Status>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await fetchAuctionItem({ courtOfficeCode, caseNo, itemNo });
      if (!data) {
        setStatus('notfound');
        return;
      }
      setItem(data);
      // 사진은 부가 정보라 조회에 실패해도 상세 화면을 막지 않는다
      try {
        setPhotos(
          await fetchAuctionItemPhotos({ courtOfficeCode, caseNo, itemNo }),
        );
      } catch {
        setPhotos([]);
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

  if (status !== 'ok' || !item) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          {status === 'notfound'
            ? '물건을 찾을 수 없어요.'
            : '불러오지 못했어요.'}
        </Text>
        <Pressable style={styles.retry} onPress={load}>
          <Text style={styles.retryText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  const minRate = computeMinimumBidRate(
    item.appraisalAmount,
    item.minimumSalePrice,
  );
  const bidLabel = formatBidDatetime(item.bidDatetime);
  const courtLine = [item.courtName, item.deptName].filter(Boolean).join(' ');

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.court}>
          {courtLine ? `${courtLine} · ${item.caseNo}` : item.caseNo}
        </Text>
        {item.usageName ? (
          <View style={styles.usageBadge}>
            <Text style={styles.usageText}>{item.usageName}</Text>
          </View>
        ) : null}
        <Text style={styles.address}>{item.address ?? '주소 정보 없음'}</Text>

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

        {photos.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>물건 사진</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoRow}
            >
              {photos.map(photo => (
                <Image
                  key={photo.id}
                  source={{ uri: photoImageUrl(photo.id) }}
                  style={styles.photo}
                  accessibilityLabel={
                    photo.caption?.trim() ||
                    photo.categoryName?.trim() ||
                    '경매물건 사진'
                  }
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>물건 개요</Text>
          <SpecRow label="사건번호" value={item.caseNo} />
          <SpecRow label="물건종류" value={item.usageName ?? '정보 없음'} />
          <SpecRow label="담당계" value={item.deptName ?? '정보 없음'} />
        </View>
      </ScrollView>

      <View style={styles.ctaBar}>
        <FavoriteButton
          item={{ courtOfficeCode, caseNo, itemNo }}
          onRequireLogin={() => navigation.navigate('Login')}
        />
        <Pressable
          style={styles.cta}
          onPress={() => navigation.navigate('RightsAnalysis')}
        >
          <Text style={styles.ctaText}>권리분석 보기</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.base, paddingBottom: 96 },
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

  court: { ...text.caption, color: colors.steel },
  usageBadge: {
    alignSelf: 'flex-start',
    marginTop: space.xs,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
  },
  usageText: { ...text.captionBold, color: colors.slate },
  address: {
    ...text.headingSm,
    color: colors.inkDeep,
    marginTop: space.xs,
    marginBottom: space.sm,
  },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  minPrice: { ...text.headingSm, color: colors.inkDeep },
  minRate: { ...text.bodySmBold, color: colors.criticalStrong },
  appraised: { ...text.caption, color: colors.stone, marginTop: 2 },
  strike: { textDecorationLine: 'line-through' },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    marginTop: space.base,
  },
  chip: {
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  chipFailed: { backgroundColor: colors.critical },
  chipFailedText: { ...text.captionBold, color: colors.canvas },
  chipDate: { backgroundColor: colors.inkDeep },
  chipDateText: { ...text.captionBold, color: colors.canvas },

  photoRow: { gap: space.sm },
  photo: {
    width: 200,
    height: 150,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
  },

  section: { marginTop: space.xl },
  sectionTitle: {
    ...text.bodyMdBold,
    color: colors.inkDeep,
    marginBottom: space.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
    gap: space.base,
  },
  rowLabel: { ...text.bodySm, color: colors.steel },
  rowValue: {
    ...text.bodySm,
    color: colors.ink,
    flexShrink: 1,
    textAlign: 'right',
  },

  ctaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineSoft,
    backgroundColor: colors.canvas,
    padding: space.base,
  },
  cta: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  ctaText: { ...text.buttonMd, color: colors.onPrimary },
});
