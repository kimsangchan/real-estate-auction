// 홈 플레이스홀더 — 지도 홈(F-01)은 RN 앱(WP-01b) 구현 예정, 웹은 물건 상세 SEO가 우선 (05-blueprint §3a)
import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>부동산 경매 플랫폼</h1>
      <p>준비 중이에요.</p>
      <p>
        <Link href="/items">물건 목록 보기</Link>
      </p>
      <p>
        <Link href="/items/browse">지역별로 찾아보기</Link>
      </p>
    </main>
  );
}
