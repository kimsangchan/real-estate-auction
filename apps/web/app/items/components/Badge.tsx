// 공용 상태 배지 — 등기 권리 상태(인수/말소/확인필요), 위험 플래그 표시에 공통으로 쓴다
import type { ReactNode } from 'react';
import styles from './Badge.module.css';

export type BadgeTone = 'critical' | 'warning' | 'muted';

const TONE_CLASS: Record<BadgeTone, string> = {
  critical: styles.critical ?? '',
  warning: styles.warning ?? '',
  muted: styles.muted ?? '',
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`${styles.badge} ${TONE_CLASS[tone]}`}>{children}</span>;
}
