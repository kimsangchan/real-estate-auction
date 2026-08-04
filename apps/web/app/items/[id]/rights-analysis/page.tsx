// 권리분석 결과 화면 — "인수해야 할 권리가 있는지"를 최우선으로 보여주고, 유찰 이력(가격 정보)과
// 나란히 비교할 수 있게 구성한다. 인수 위험이 없다는 사실도 명시적으로 드러내 "유찰이 잦았던 이유가
// 가격 때문인지 권리 때문인지" 사용자가 스스로 판단할 근거를 준다. 판단·권유 문구는 넣지 않는다 (D-011).
// 본문은 지도 패널과 공유한다 (components/RightsAnalysisView.tsx) — 두 화면이 갈라지면 안 된다.
// 실제 등기부 조회는 CODEF 유료 호출이 필요해(WP-04) 이 화면은 아직 sample-data.ts 예시로 남아있다.
import type { Metadata } from 'next';
import { RightsAnalysisView } from '../../components/RightsAnalysisView';
import { NOINDEX } from '../../../seo';
import styles from './page.module.css';

// 아직 sample-data를 렌더해 물건 ID와 무관하게 본문이 같다 — 색인되면 중복 콘텐츠이자
// 예시 분석이 특정 물건의 실제 분석처럼 노출된다. 실데이터 연동 시 해제 (WP-10 §1-3)
export const metadata: Metadata = { robots: NOINDEX };

export default async function RightsAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>권리분석 결과</h1>
      <RightsAnalysisView itemId={id} />
    </main>
  );
}
