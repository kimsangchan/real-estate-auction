// 위험 플래그 상세 화면 — 감지된 위험 키워드의 법원 서류 원문 + 다음 행동을 함께 제시한다.
// 판단·권유 문구 없이 원문 발췌와 사실 서술만 담는다 (D-011, F-04, UX-06 막다른 경고 금지).
import Link from 'next/link';
import { Badge } from '../../components/Badge';
import { sampleDetectedRisks } from '../../sample-data';
import styles from './page.module.css';

export default async function RisksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>확인이 필요해요</h1>
      <p className={styles.subtitle}>법원 서류에서 감지된 내용이에요. 판단은 직접 하시고, 아래 행동으로 확인해보세요.</p>

      {sampleDetectedRisks.length === 0 ? (
        <p className={styles.emptyState}>이 물건에서 감지된 위험 키워드가 없어요.</p>
      ) : (
        sampleDetectedRisks.map((risk) => (
          <div key={risk.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <Badge tone="critical">{risk.keyword}</Badge>
              <span className={styles.sourceDocument}>{risk.sourceDocument} 원문</span>
            </div>
            <blockquote className={styles.quote}>&ldquo;{risk.originalText}&rdquo;</blockquote>
            <p className={styles.actionLabel}>다음 행동</p>
            <p className={styles.actionText}>{risk.nextAction}</p>
            <Link href={`/items/${id}/checklist`} className={styles.checklistLink}>
              임장 체크리스트에서 확인하기 →
            </Link>
          </div>
        ))
      )}
    </main>
  );
}
