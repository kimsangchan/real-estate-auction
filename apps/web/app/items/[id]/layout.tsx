// 물건 하위 화면(상세/권리분석/위험/체크리스트) 공용 셸 — 너비·중앙 정렬을 한 곳에서 관리한다
import type { ReactNode } from 'react';
import styles from './layout.module.css';

export default function ItemLayout({ children }: { children: ReactNode }) {
  return <div className={styles.shell}>{children}</div>;
}
