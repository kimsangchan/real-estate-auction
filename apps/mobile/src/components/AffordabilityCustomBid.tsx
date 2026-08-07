// 입찰가 직접 입력 — "내가 이 가격을 쓰면 결국 얼마가 드나"를 그 자리에서 계산한다.
// 웹 원본: apps/web/app/items/components/AffordabilityCustomBid.tsx (같은 동작, RN 입력으로).
// 계산은 API가 한다 — 취득세율·명도 구간 정의를 클라이언트에 복제하면 두 곳이 갈라진다.
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { fetchAffordability } from '../api/auctionItems';
import {
  formatRatioRange,
  formatWonRangeCompact,
  type Affordability,
} from '../lib/affordability';
import { formatWon } from '../lib/format';
import { colors, radius, space, text } from '../theme';

export function AffordabilityCustomBid({
  courtOfficeCode,
  caseNo,
  itemNo,
}: {
  courtOfficeCode: string;
  caseNo: string;
  itemNo: string;
}) {
  const [raw, setRaw] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Affordability | null>(null);

  const bidPrice = Number(raw.replace(/[,\s]/g, ''));
  const valid = raw.trim() !== '' && Number.isFinite(bidPrice) && bidPrice > 0;

  async function compute() {
    if (!valid || pending) return;
    setPending(true);
    setError(null);
    try {
      const data = await fetchAffordability(
        { courtOfficeCode, caseNo, itemNo },
        Math.round(bidPrice),
      );
      if (!data) {
        setError('계산하지 못했어요. 잠시 뒤 다시 시도해주세요.');
        return;
      }
      setResult(data);
    } catch {
      setError('계산하지 못했어요. 잠시 뒤 다시 시도해주세요.');
    } finally {
      setPending(false);
    }
  }

  const custom = result?.scenarios.find(s => s.kind === 'CUSTOM') ?? null;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>입찰가를 직접 넣어보기</Text>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          placeholder="입찰가 (원)"
          placeholderTextColor={colors.stone}
          accessibilityLabel="입찰가 (원)"
          value={raw}
          onChangeText={setRaw}
          onSubmitEditing={() => {
            compute();
          }}
        />
        <Pressable
          style={[styles.button, (!valid || pending) && styles.buttonDisabled]}
          accessibilityRole="button"
          accessibilityLabel="입찰가로 총부담 계산"
          disabled={!valid || pending}
          onPress={() => {
            compute();
          }}
        >
          {pending ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>계산</Text>
          )}
        </Pressable>
      </View>
      {valid ? <Text style={styles.echo}>{formatWon(bidPrice)}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {custom ? (
        <Text style={styles.result}>
          인수·취득세·등기·명도비까지 총{' '}
          {formatWonRangeCompact(custom.totalWithExtras)}
          {result?.assumedIsLowerBound ? ' 이상' : ''}
          {custom.appraisalRatio
            ? ` · 감정가의 ${formatRatioRange(custom.appraisalRatio)}`
            : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    padding: space.base,
    marginBottom: space.xl,
  },
  title: { ...text.subtitleLg, color: colors.inkDeep, marginBottom: space.sm },
  form: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: {
    flex: 1,
    ...text.bodySm,
    color: colors.ink,
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    paddingHorizontal: space.base,
    paddingVertical: space.sm,
  },
  button: {
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: space.base,
    paddingVertical: space.sm,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { ...text.bodySmBold, color: colors.onPrimary },
  echo: { ...text.caption, color: colors.steel, marginTop: space.xs },
  error: {
    ...text.caption,
    color: colors.criticalStrong,
    marginTop: space.xs,
  },
  result: { ...text.bodySm, color: colors.ink, marginTop: space.sm },
});
