// 물건 목록 — GET /auction-items 페이지네이션을 무한 스크롤로 훑고, 카드 탭 시 상세로 이동한다.
// 당겨서 새로고침·로딩·에러·빈 상태를 모두 처리한다.
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchAuctionItems, type AuctionItem } from '../api/auctionItems';
import { ItemCard } from '../components/ItemCard';
import type { RootStackParamList, TabParamList } from '../navigation';
import { colors, space, text } from '../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'ItemList'>,
  NativeStackScreenProps<RootStackParamList>
>;

const PAGE_SIZE = 20;

const itemKey = (item: AuctionItem): string =>
  `${item.courtOfficeCode}_${item.caseNo}_${item.itemNo}`;

export function ItemListScreen({ navigation }: Props) {
  const [items, setItems] = useState<AuctionItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>(
    'loading',
  );
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);

  const loadFirstPage = useCallback(async () => {
    try {
      const page = await fetchAuctionItems(PAGE_SIZE, 0);
      setItems(page);
      setReachedEnd(page.length < PAGE_SIZE);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFirstPage();
    setRefreshing(false);
  }, [loadFirstPage]);

  const onEndReached = useCallback(async () => {
    if (loadingMore || reachedEnd || status !== 'ready') return;
    setLoadingMore(true);
    try {
      const page = await fetchAuctionItems(PAGE_SIZE, items.length);
      setItems(prev => [...prev, ...page]);
      if (page.length < PAGE_SIZE) setReachedEnd(true);
    } catch {
      // 다음 페이지 실패는 조용히 무시 — 당겨서 새로고침으로 복구할 수 있다.
    } finally {
      setLoadingMore(false);
    }
  }, [items.length, loadingMore, reachedEnd, status]);

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
        <Text style={styles.message}>목록을 불러오지 못했어요.</Text>
        <Pressable style={styles.retry} onPress={loadFirstPage}>
          <Text style={styles.retryText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={itemKey}
      renderItem={({ item }) => (
        <ItemCard
          item={item}
          onPress={() =>
            navigation.navigate('ItemDetail', {
              courtOfficeCode: item.courtOfficeCode,
              caseNo: item.caseNo,
              itemNo: item.itemNo,
              address: item.address,
            })
          }
        />
      )}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.message}>표시할 물건이 없어요.</Text>
        </View>
      }
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator style={styles.footer} color={colors.primary} />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: space.base,
    gap: space.md,
    backgroundColor: colors.surfaceSoft,
    flexGrow: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    padding: space.xl,
  },
  message: { ...text.bodyMd, color: colors.steel },
  retry: {
    marginTop: space.base,
    backgroundColor: colors.surfaceSoft,
    borderRadius: 100,
    paddingHorizontal: space.base,
    paddingVertical: space.sm,
  },
  retryText: { ...text.bodySmBold, color: colors.primary },
  footer: { paddingVertical: space.base },
});
