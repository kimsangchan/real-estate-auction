// 임장 체크리스트 화면 — 물건별 자동 생성 체크리스트, 체크 상태는 기기에 저장해 오프라인에서도
// 유지된다 (F-04). 위험 플래그에서 파생된 항목은 배지로 구분해 위험 화면과 연결한다 (UX-06).
'use client';

import { useEffect, useState } from 'react';
import { Badge } from '../../components/Badge';
import { SampleDataNotice } from '../../components/SampleDataNotice';
import { sampleChecklistItems, sampleItem } from '../../sample-data';
import styles from './page.module.css';

const STORAGE_KEY = `auction-checklist:${sampleItem.caseNo}`;

function loadChecked(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export default function ChecklistPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setChecked(loadChecked());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
  }, [checked, loaded]);

  const toggle = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const total = sampleChecklistItems.length;
  const doneCount = sampleChecklistItems.filter((item) => checked[item.id]).length;
  const progressPercent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  const categories = Array.from(new Set(sampleChecklistItems.map((item) => item.category)));

  return (
    <main className={styles.page}>
      <SampleDataNotice source="물건" />
      <h1 className={styles.title}>임장 체크리스트</h1>
      <p className={styles.subtitle}>온라인으로 확인할 수 없는 항목이에요. 현장에서 하나씩 확인해보세요.</p>

      <div className={styles.progressBar}>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
        </div>
        <span className={styles.progressText}>
          {doneCount}/{total} 확인함
        </span>
      </div>

      {categories.map((category) => (
        <section key={category} className={styles.groupBlock}>
          <h2 className={styles.groupTitle}>{category}</h2>
          {sampleChecklistItems
            .filter((item) => item.category === category)
            .map((item) => {
              const isChecked = Boolean(checked[item.id]);
              return (
                <label
                  key={item.id}
                  className={isChecked ? `${styles.itemCard} ${styles.itemChecked}` : styles.itemCard}
                >
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={isChecked}
                    onChange={() => toggle(item.id)}
                  />
                  <div className={styles.itemMain}>
                    <div className={styles.itemLabelLine}>
                      <span className={isChecked ? `${styles.itemLabel} ${styles.itemLabelChecked}` : styles.itemLabel}>
                        {item.label}
                      </span>
                      {item.fromRisk ? <Badge tone="critical">위험 감지</Badge> : null}
                    </div>
                    <p className={styles.itemHelp}>{item.help}</p>
                  </div>
                </label>
              );
            })}
        </section>
      ))}

      <p className={styles.savedNotice}>체크한 내용은 이 기기에 저장되고 서버로 전송되지 않아요.</p>
    </main>
  );
}
