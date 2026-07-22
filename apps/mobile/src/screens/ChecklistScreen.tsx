// 임장 체크리스트 화면 — 물건별 자동 생성 체크리스트, 체크 상태는 기기에 저장해 오프라인에서도
// 유지된다 (F-04). 위험 플래그에서 파생된 항목은 배지로 구분해 위험 화면과 연결한다 (UX-06).
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { Badge } from '../components/Badge';
import { sampleChecklistItems } from '../lib/rightsSample';
import { colors, radius, space, text } from '../theme';

export const CHECKLIST_STORAGE_DB = 'auction-mobile';
export const CHECKLIST_STORAGE_KEY = 'auction-checklist:sample';

const storage = createAsyncStorage(CHECKLIST_STORAGE_DB);

function parseChecked(raw: string | null): Record<string, boolean> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }
    // 값 타입까지 검증한다 — 손상된 payload의 비불리언 값이 체크로 집계되지 않게.
    const result: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'boolean') result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

const categories = Array.from(
  new Set(sampleChecklistItems.map(item => item.category)),
);

export function ChecklistScreen() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    storage
      .getItem(CHECKLIST_STORAGE_KEY)
      .then(raw => {
        if (cancelled) return;
        // 로드 완료 전에 탭한 체크가 로드 결과에 덮이지 않게 병합한다.
        setChecked(prev => ({ ...parseChecked(raw), ...prev }));
        setLoaded(true);
      })
      .catch(() => {
        // 읽기 실패 시 쓰기 게이트를 열지 않는다 — 저장된 기록을 빈 상태로 덮어쓰는 사고 방지.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    // 기기 저장 실패는 복구 수단이 없어 무시한다(메모리 상태는 유지) — unhandled rejection 방지.
    storage
      .setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checked))
      .catch(() => {});
  }, [checked, loaded]);

  const toggle = (id: string) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const total = sampleChecklistItems.length;
  const doneCount = sampleChecklistItems.filter(
    item => checked[item.id],
  ).length;
  const progressPercent =
    total === 0 ? 0 : Math.round((doneCount / total) * 100);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.sampleNote}>
        <Text style={styles.sampleNoteText}>
          예시 데이터 — 실제 물건 연동 전 화면 미리보기예요.
        </Text>
      </View>
      <Text style={styles.subtitle}>
        온라인으로 확인할 수 없는 항목이에요. 현장에서 하나씩 확인해보세요.
      </Text>

      <View style={styles.progressBar}>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${progressPercent}%` }]}
          />
        </View>
        <Text
          style={styles.progressText}
        >{`${doneCount}/${total} 확인함`}</Text>
      </View>

      {categories.map(category => (
        <View key={category} style={styles.group}>
          <Text style={styles.groupTitle}>{category}</Text>
          {sampleChecklistItems
            .filter(item => item.category === category)
            .map(item => {
              const isChecked = Boolean(checked[item.id]);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggle(item.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isChecked }}
                  accessibilityLabel={`${item.label}${
                    item.fromRisk ? ', 위험 감지' : ''
                  }. ${item.help}`}
                  style={[styles.itemCard, isChecked && styles.itemCardChecked]}
                >
                  <View
                    style={[
                      styles.checkbox,
                      isChecked && styles.checkboxChecked,
                    ]}
                  >
                    {isChecked ? (
                      <Text style={styles.checkboxMark}>✓</Text>
                    ) : null}
                  </View>
                  <View style={styles.itemMain}>
                    <View style={styles.itemLabelLine}>
                      <Text
                        style={[
                          styles.itemLabel,
                          isChecked && styles.itemLabelChecked,
                        ]}
                      >
                        {item.label}
                      </Text>
                      {item.fromRisk ? (
                        <Badge tone="critical" label="위험 감지" />
                      ) : null}
                    </View>
                    <Text style={styles.itemHelp}>{item.help}</Text>
                  </View>
                </Pressable>
              );
            })}
        </View>
      ))}

      <Text style={styles.savedNotice}>
        체크한 내용은 이 기기에 저장되고 서버로 전송되지 않아요.
      </Text>
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

  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.xl,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSoft,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  progressText: { ...text.bodySmBold, color: colors.ink, flexShrink: 0 },

  group: { marginBottom: space.xl },
  groupTitle: {
    ...text.headingSm,
    color: colors.inkDeep,
    marginBottom: space.sm,
  },

  itemCard: {
    flexDirection: 'row',
    gap: space.base,
    backgroundColor: colors.canvas,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    padding: space.lg,
    marginBottom: space.sm,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  itemCardChecked: { backgroundColor: colors.surfaceSoft },

  checkbox: {
    width: 22,
    height: 22,
    marginTop: 2,
    flexShrink: 0,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxMark: { color: colors.canvas, fontSize: 14, fontWeight: '700' },

  itemMain: { flex: 1 },
  itemLabelLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  itemLabel: { ...text.bodyMdBold, color: colors.ink },
  itemLabelChecked: {
    color: colors.steel,
    textDecorationLine: 'line-through',
  },
  itemHelp: { ...text.bodySm, color: colors.steel },

  savedNotice: {
    ...text.caption,
    color: colors.stone,
    textAlign: 'center',
    marginTop: space.lg,
  },
});
