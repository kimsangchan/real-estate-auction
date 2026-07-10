// 위험 플래그 상세(예시 데이터) — 감지된 위험 키워드의 법원 서류 원문 + 다음 행동을 함께 제시한다.
// 판단·권유 문구 없이 원문 발췌와 사실 서술만 담는다(D-011, UX-06 막다른 경고 금지).
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Badge } from '../components/Badge';
import { sampleDetectedRisks } from '../lib/rightsSample';
import type { RootStackParamList } from '../navigation';
import { colors, radius, space, text } from '../theme';

// navigation은 Partial — 기존 RisksScreen.test.tsx가 <RisksScreen />을 prop 없이 렌더한다(수정 금지 대상).
type Props = Partial<NativeStackScreenProps<RootStackParamList, 'Risks'>>;

export function RisksScreen({ navigation }: Props) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.sampleNote}>
        <Text style={styles.sampleNoteText}>
          예시 데이터 — 실제 법원 서류 연동 전 화면 미리보기예요.
        </Text>
      </View>
      <Text style={styles.subtitle}>
        법원 서류에서 감지된 내용이에요. 판단은 직접 하시고, 아래 행동으로
        확인해보세요.
      </Text>

      {sampleDetectedRisks.length === 0 ? (
        <Text style={styles.emptyState}>
          이 물건에서 감지된 위험 키워드가 없어요.
        </Text>
      ) : (
        sampleDetectedRisks.map(risk => (
          <View key={risk.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Badge tone="critical" label={risk.keyword} />
              <Text style={styles.sourceDocument}>
                {risk.sourceDocument} 원문
              </Text>
            </View>
            <View style={styles.quote}>
              <Text style={styles.quoteText}>“{risk.originalText}”</Text>
            </View>
            <Text style={styles.actionLabel}>다음 행동</Text>
            <Text style={styles.actionText}>{risk.nextAction}</Text>
            <Pressable onPress={() => navigation?.navigate('Checklist')}>
              <Text style={styles.footnoteLink}>
                임장 체크리스트에서 확인하기 →
              </Text>
            </Pressable>
          </View>
        ))
      )}
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
  subtitle: { ...text.bodySm, color: colors.steel, marginBottom: space.base },
  emptyState: {
    ...text.bodySm,
    color: colors.steel,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.base,
  },

  card: {
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.sm,
  },
  sourceDocument: { ...text.caption, color: colors.stone },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.hairline,
    backgroundColor: colors.surfaceSoft,
    borderTopRightRadius: radius.md,
    borderBottomRightRadius: radius.md,
    padding: space.base,
    marginBottom: space.base,
  },
  quoteText: { ...text.bodySm, color: colors.charcoal },
  actionLabel: {
    ...text.captionBold,
    color: colors.primaryDeep,
    marginBottom: space.xxs,
  },
  actionText: { ...text.bodySm, color: colors.ink },
  footnoteLink: {
    ...text.bodySmBold,
    color: colors.primaryDeep,
    marginTop: space.xs,
  },
});
