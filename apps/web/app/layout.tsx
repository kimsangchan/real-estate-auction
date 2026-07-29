// 웹 루트 레이아웃 — 디자인 토큰(CSS 변수) 주입 + 로그인 상태 헤더(닉네임/로그아웃 또는 로그인 링크,
// WP-08 §1-8.4) + 물건 상세 SEO 페이지의 공통 골격
import './globals.css';
import { buildCssVariablesText, colors, typography } from '@auction/design-tokens';
import { headers } from 'next/headers';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { LogoutButton } from './components/LogoutButton';
import { SITE_NAME, SITE_URL } from './seo';
import styles from './layout.module.css';

export const metadata: Metadata = {
  // 하위 페이지가 canonical·openGraph에 상대 경로만 적어도 절대 URL로 조립되게 한다 (WP-10 §1-2)
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: '경매 물건을 쉽게 찾고 권리분석까지 확인해요',
  // openGraph는 여기 두지 않는다 — Next가 깊은 병합을 하지 않아 하위 페이지가 통째로 덮어쓴다.
  // 페이지마다 buildOpenGraph()로 전체를 만든다 (WP-10 §1-6)
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
      // 매 페이지 SSR에서 실행되므로, API가 응답 없이 매달리면(hang) 공개 페이지 전체가 지연된다 (T-04)
      signal: AbortSignal.timeout(2000),
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
