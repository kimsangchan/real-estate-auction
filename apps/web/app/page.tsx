// 홈 플레이스홀더 — 지도 홈(F-01)은 RN 앱(WP-01b) 구현 예정, 웹은 물건 상세 SEO가 우선 (05-blueprint §3a)
import type { Metadata } from 'next';
import Link from 'next/link';
import { buildOpenGraph, SITE_NAME } from './seo';

const TITLE = `${SITE_NAME} - 법원 경매 물건 조회`;
const DESCRIPTION = '전국 법원 경매 물건을 지역별로 찾아보고 사건번호·감정가·최저매각가격을 확인해요';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: buildOpenGraph('/', TITLE, DESCRIPTION),
};

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
