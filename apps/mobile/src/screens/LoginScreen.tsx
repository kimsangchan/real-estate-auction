// 로그인 화면 — 카카오·네이버 버튼 2개. 시스템 브라우저로 나갔다가 딥링크로 돌아오면
// 로그인 상태가 되고 원래 화면으로 되돌아간다 (WP-08b §1-6, 웹 /login과 같은 문구)
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthProvider } from '../api/authSession';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation';
import { colors, radius, space, text } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

// 카카오·네이버 브랜드 색은 DESIGN-meta.md 팔레트 밖의 공식 브랜드 값이라 여기서만 예외로 둔다
// (웹 login/page.module.css와 같은 예외 처리).
const brand = {
  kakao: '#FEE500',
  kakaoText: '#000000',
  naver: '#03C75A',
  naverText: '#FFFFFF',
} as const;

export function LoginScreen({ navigation }: Props) {
  const { status, signIn } = useAuth();
  const [failed, setFailed] = useState(false);

  // 딥링크로 돌아와 로그인이 끝나면 이 화면은 할 일이 없다 — 원래 보던 화면으로 돌려보낸다.
  useEffect(() => {
    if (status === 'authenticated' && navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [status, navigation]);

  const onPress = async (provider: AuthProvider) => {
    setFailed(false);
    try {
      await signIn(provider);
    } catch {
      setFailed(true);
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>로그인</Text>
      <Text style={styles.subtitle}>
        카카오 또는 네이버 계정으로 로그인해요.
      </Text>

      {failed ? (
        <Text style={styles.error}>
          로그인에 실패했어요. 다시 시도해주세요.
        </Text>
      ) : null}

      <View style={styles.providerList}>
        <Pressable
          style={[styles.providerButton, styles.kakao]}
          accessibilityRole="button"
          onPress={() => onPress('kakao')}
        >
          <Text style={[styles.providerText, styles.kakaoText]}>
            카카오로 로그인
          </Text>
        </Pressable>
        <Pressable
          style={[styles.providerButton, styles.naver]}
          accessibilityRole="button"
          onPress={() => onPress('naver')}
        >
          <Text style={[styles.providerText, styles.naverText]}>
            네이버로 로그인
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, padding: space.xl },
  title: { ...text.headingSm, color: colors.inkDeep, marginBottom: space.xxs },
  subtitle: { ...text.bodySm, color: colors.steel, marginBottom: space.xl },
  error: {
    ...text.bodySm,
    color: colors.criticalStrong,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    padding: space.base,
    marginBottom: space.xl,
  },
  providerList: { gap: space.base },
  providerButton: {
    borderRadius: radius.full,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  providerText: { ...text.buttonMd },
  kakao: { backgroundColor: brand.kakao },
  kakaoText: { color: brand.kakaoText },
  naver: { backgroundColor: brand.naver },
  naverText: { color: brand.naverText },
});
