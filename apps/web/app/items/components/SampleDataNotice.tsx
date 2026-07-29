// 예시 데이터 고지 — sample-data.ts를 렌더하는 화면이 그 물건의 실제 분석 결과로 오인되지 않게
// 최상단에 붙인다. 앱(RN)의 sampleNote와 같은 문구·위치를 쓴다 (docs/legal/copy-review-list.md §5-1)
import styles from './SampleDataNotice.module.css';

export function SampleDataNotice({ source }: { source: string }) {
  return <p className={styles.notice}>예시 데이터 — 실제 {source} 연동 전 화면 미리보기예요.</p>;
}
