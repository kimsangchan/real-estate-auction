// 웹 루트 레이아웃 — 물건 상세 SEO 페이지의 공통 골격 (WP-01 플레이스홀더)
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '부동산 경매 플랫폼',
  description: '경매 물건을 쉽게 찾고 권리분석까지 확인해요',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
