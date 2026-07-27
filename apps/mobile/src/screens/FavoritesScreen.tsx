// 관심 물건 탭 — 로그인 상태면 목록을, 비로그인이면 로그인 안내를 보여준다(탭 진입 자체는 막지 않음, T-04).
// 계정 화면을 따로 만들지 않고 이 화면 상단에 닉네임·로그아웃·회원 탈퇴를 최소 배치한다 (WP-08b §1-6).
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  useFocusEffect,
  type CompositeScreenProps,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuctionItem } from '../api/auctionItems';
import { fetchFavorites, removeFavorite } from '../api/favorites';
import { useAuth } from '../auth/AuthContext';
import { ItemCard } from '../components/ItemCard';
import type { RootStackParamList, TabParamList } from '../navigation';
import { colors, radius, space, text } from '../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Favorites'>,
  NativeStackScreenProps<RootStackParamList>
>;

const itemKey = (item: AuctionItem): string =>
  `${item.courtOfficeCode}_${item.caseNo}_${item.itemNo}`;

export function FavoritesScreen({ navigation }: Props) {
  const { status, user, signOut, removeAccount } = useAuth();
  const [items, setItems] = useState<AuctionItem[]>([]);
  const [listStatus, setListStatus] = useState<'loading' | 'error' | 'ready'>(
    'loading',
  );

  const load = useCallback(async () => {
    setListStatus('loading');
    try {
      const favorites = await fetchFavorites();
      setItems(favorites ?? []);
      setListStatus('ready');
    } catch {
      setListStatus('error');
    }
  }, []);

  // 상세에서 관심을 등록·해제하고 돌아올 수 있어 탭에 들어올 때마다 다시 읽는다.
  useFocusEffect(
    useCallback(() => {
      if (status === 'authenticated') load();
    }, [status, load]),
  );

  const onRemove = useCallback(async (item: AuctionItem) => {
    if (await removeFavorite(item)) {
      setItems(prev => prev.filter(prev_ => itemKey(prev_) !== itemKey(item)));
    }
  }, []);

  const onDeleteAccount = useCallback(() => {
    Alert.alert(
      '회원 탈퇴',
      '관심 목록과 계정 정보가 즉시 삭제돼요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: () => {
            removeAccount();
          },
        },
      ],
      { cancelable: true },
    );
  }, [removeAccount]);

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'anonymous') {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          로그인하면 관심 물건을 모아볼 수 있어요.
        </Text>
        <Pressable
          style={styles.primaryButton}
          accessibilityRole="button"
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.primaryButtonText}>로그인</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={itemKey}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View style={styles.accountBar}>
          <Text style={styles.nickname}>{user?.nickname ?? ''}님</Text>
          <View style={styles.accountActions}>
            <Pressable accessibilityRole="button" onPress={signOut}>
              <Text style={styles.accountAction}>로그아웃</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onDeleteAccount}>
              <Text style={styles.accountAction}>회원 탈퇴</Text>
            </Pressable>
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <View>
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
          <Pressable
            style={styles.removeButton}
            accessibilityRole="button"
            accessibilityLabel={`${item.address ?? '이 물건'} 관심 해제`}
            onPress={() => onRemove(item)}
          >
            <Text style={styles.removeButtonText}>관심 해제</Text>
          </Pressable>
        </View>
      )}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.message}>
            {listStatus === 'error'
              ? '관심 목록을 불러오지 못했어요.'
              : '등록한 관심 물건이 없어요.'}
          </Text>
          {listStatus === 'error' ? (
            <Pressable style={styles.retry} onPress={load}>
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          ) : null}
        </View>
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
  message: { ...text.bodyMd, color: colors.steel, textAlign: 'center' },

  accountBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: space.sm,
  },
  nickname: { ...text.bodyMdBold, color: colors.inkDeep },
  accountActions: { flexDirection: 'row', gap: space.base },
  accountAction: { ...text.bodySm, color: colors.steel },

  removeButton: {
    position: 'absolute',
    top: space.base,
    right: space.base,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
  },
  removeButtonText: { ...text.captionBold, color: colors.steel },

  primaryButton: {
    marginTop: space.base,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
  },
  primaryButtonText: { ...text.buttonMd, color: colors.onPrimary },
  retry: {
    marginTop: space.base,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.full,
    paddingHorizontal: space.base,
    paddingVertical: space.sm,
  },
  retryText: { ...text.bodySmBold, color: colors.primary },
});
