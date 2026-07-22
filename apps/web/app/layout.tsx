// 웹 루트 레이아웃 — 디자인 토큰(CSS 변수) 주입 + 로그인 상태 헤더(닉네임/로그아웃 또는 로그인 링크,
// WP-08 §1-8.4) + 물건 상세 SEO 페이지의 공통 골격
import './globals.css';
import { buildCssVariablesText, colors, typography } from '@auction/design-tokens';
import { headers } from 'next/headers';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { LogoutButton } from './components/LogoutButton';
import styles from './layout.module.css';

export const metadata: Metadata = {
  title: '부동산 경매 플랫폼',
  description: '경매 물건을 쉽게 찾고 권리분석까지 확인해요',
};

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

interface CurrentUser {
  nickname: string;
}

// API 서버가 죽어있어도 전체 사이트가 함께 죽지 않도록 실패 시 비로그인으로 취급한다 (T-04)
async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const cookieHeader = (await headers()).get('cookie');
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as CurrentUser;
  } catch {
    return null;
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await fetchCurrentUser();

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
        <header className={styles.header}>
          {user ? (
            <div className={styles.authStatus}>
              <Link href="/favorites" className={styles.favoritesLink}>
                관심 물건
              </Link>
              <span className={styles.nickname}>{user.nickname}님</span>
              <LogoutButton />
            </div>
          ) : (
            <Link href="/login" className={styles.loginLink}>
              로그인
            </Link>
          )}
        </header>
        {children}
      </body>
    </html>
  );
}
