// 공용 상태 배지 — 등기 권리 상태(인수/말소/확인필요) 표시(웹 Badge와 동일 tone).
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, text } from '../theme';

export type BadgeTone = 'critical' | 'warning' | 'muted';

export function Badge({ tone, label }: { tone: BadgeTone; label: string }) {
  return (
    <View style={[styles.badge, styles[tone]]}>
      <Text style={[styles.text, textTone[tone]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  text: { ...text.captionBold },
  critical: { backgroundColor: colors.critical },
  warning: { backgroundColor: colors.warning },
  muted: { backgroundColor: colors.surfaceSoft },
});

const textTone: Record<BadgeTone, { color: string }> = {
  critical: { color: colors.canvas },
  warning: { color: colors.inkDeep },
  muted: { color: colors.slate },
};
