// 웹 루트 레이아웃 — 디자인 토큰(CSS 변수) 주입 + 물건 상세 SEO 페이지의 공통 골격
import './globals.css';
import { buildCssVariablesText, colors, typography } from '@auction/design-tokens';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '부동산 경매 플랫폼',
  description: '경매 물건을 쉽게 찾고 권리분석까지 확인해요',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <style>{buildCssVariablesText()}</style>
      </head>
      <body
        style={{
          fontFamily: typography.bodyMd.fontFamily,
          backgroundColor: colors.canvas,
          color: colors.ink,
          margin: 0,
        }}
      >
        {children}
      </body>
    </html>
  );
}
