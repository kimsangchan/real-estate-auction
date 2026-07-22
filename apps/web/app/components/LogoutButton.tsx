// 로그아웃 버튼 — POST /api/auth/logout 후 새로고침해 헤더(서버 컴포넌트)가 로그아웃 상태를 다시 읽게 한다
'use client';

import { useState } from 'react';
import styles from './LogoutButton.module.css';

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.reload();
    }
  }

  return (
    <button type="button" className={styles.button} onClick={handleClick} disabled={pending}>
      로그아웃
    </button>
  );
}
