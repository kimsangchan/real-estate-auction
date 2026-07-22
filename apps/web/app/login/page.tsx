// 로그인 화면 — 카카오·네이버 소셜 로그인 버튼 2개. 관심 등록 등 로그인이 필요한 동작에서
// returnTo 쿼리를 유지한 채 이 화면으로 오고, 로그인 성공 후 서버가 그 경로로 돌려보낸다 (WP-08 §1-8)
import type { Metadata } from 'next';
import { buildProviderHref } from './provider-href';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: '로그인 - 부동산 경매 플랫폼',
  description: '카카오 또는 네이버 계정으로 로그인해요',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const { returnTo, error } = await searchParams;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>로그인</h1>
      <p className={styles.subtitle}>카카오 또는 네이버 계정으로 로그인해요.</p>

      {error === 'oauth_failed' ? <p className={styles.error}>로그인에 실패했어요. 다시 시도해주세요.</p> : null}

      <div className={styles.providerList}>
        <a href={buildProviderHref('kakao', returnTo)} className={`${styles.providerButton} ${styles.kakao}`}>
          카카오로 로그인
        </a>
        <a href={buildProviderHref('naver', returnTo)} className={`${styles.providerButton} ${styles.naver}`}>
          네이버로 로그인
        </a>
      </div>
    </main>
  );
}
