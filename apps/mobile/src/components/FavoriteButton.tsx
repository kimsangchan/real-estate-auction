// 관심 등록/해제 버튼 — 웹 apps/web FavoriteButton과 같은 로직·문구(사실 서술만, D-011).
// 비로그인 상태에서 누르면 로그인 화면으로 보낸다 (WP-08b §1-6).
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { ItemKey } from '../api/auctionItems';
import { addFavorite, fetchFavorites, removeFavorite } from '../api/favorites';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, space, text } from '../theme';

type Status = 'loading' | 'anonymous' | 'favorited' | 'not-favorited';

const sameItem = (a: ItemKey, b: ItemKey): boolean =>
  a.courtOfficeCode === b.courtOfficeCode &&
  a.caseNo === b.caseNo &&
  a.itemNo === b.itemNo;

export function FavoriteButton({
  item,
  onRequireLogin,
}: {
  item: ItemKey;
  onRequireLogin: () => void;
}) {
  const { status: authStatus } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [pending, setPending] = useState(false);

  // 호출부가 사건키 객체를 JSX에서 만들어 넘기므로 참조가 매 렌더 바뀐다 —
  // 의존성은 반드시 원시값으로 둔다(객체를 걸면 조회가 무한 반복된다).
  const { courtOfficeCode, caseNo, itemNo } = item;

  useEffect(() => {
    if (authStatus === 'loading') {
      return undefined;
    }
    if (authStatus === 'anonymous') {
      setStatus('anonymous');
      return undefined;
    }

    let cancelled = false;
    fetchFavorites()
      .then(favorites => {
        if (cancelled) return;
        if (favorites === null) {
          setStatus('anonymous');
          return;
        }
        setStatus(
          favorites.some(favorite =>
            sameItem(favorite, { courtOfficeCode, caseNo, itemNo }),
          )
            ? 'favorited'
            : 'not-favorited',
        );
      })
      .catch(() => {
        // 상태를 판정하지 못하면 미등록으로 둔다 — 눌러서 재시도하면 된다.
        if (!cancelled) setStatus('not-favorited');
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, courtOfficeCode, caseNo, itemNo]);

  const favorited = status === 'favorited';

  const onPress = async () => {
    if (status === 'loading' || pending) return;
    if (status === 'anonymous') {
      onRequireLogin();
      return;
    }

    setPending(true);
    try {
      const result = favorited
        ? await removeFavorite(item)
        : await addFavorite(item);

      if (result === 'ok') {
        setStatus(favorited ? 'not-favorited' : 'favorited');
      } else if (result === 'unauthorized') {
        // 재시도까지 401이면 세션이 끊긴 것 — 로그인 안내로 되돌린다 (§1-4)
        setStatus('anonymous');
      }
      // 그 밖의 실패(5xx·네트워크)는 상태를 그대로 둔다 — 로그인은 살아 있으므로 다시 누르면 된다.
    } catch {
      // 네트워크 오류로 프라미스가 깨져도 버튼이 잠기지 않게 삼킨다.
    } finally {
      setPending(false);
    }
  };

  return (
    <Pressable
      style={[styles.button, favorited && styles.active]}
      onPress={onPress}
      disabled={status === 'loading' || pending}
      accessibilityRole="button"
      accessibilityState={{ selected: favorited }}
      accessibilityLabel={favorited ? '관심 해제' : '관심 등록'}
    >
      <Text style={[styles.icon, favorited && styles.activeIcon]}>
        {favorited ? '♥' : '♡'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 52,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    backgroundColor: colors.canvas,
    paddingVertical: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { borderColor: colors.critical, backgroundColor: colors.surfaceSoft },
  icon: { ...text.buttonMd, color: colors.steel },
  activeIcon: { color: colors.criticalStrong },
});
