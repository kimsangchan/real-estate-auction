// 물건 목록 공용 이전/다음 페이지네이션 — /items, /items/browse가 함께 쓴다
import Link from 'next/link';
import styles from './Pagination.module.css';

export function Pagination({
  prevHref,
  nextHref,
  hasPrev,
  hasNext,
}: {
  prevHref: string;
  nextHref: string;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  return (
    <div className={styles.bar}>
      <Link href={prevHref} className={hasPrev ? styles.link : `${styles.link} ${styles.linkDisabled}`}>
        ← 이전
      </Link>
      <Link href={nextHref} className={hasNext ? styles.link : `${styles.link} ${styles.linkDisabled}`}>
        다음 →
      </Link>
    </div>
  );
}
