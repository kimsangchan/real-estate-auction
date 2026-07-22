// 관심 등록/해제 토글 버튼 — 물건 상세에서 쓴다. 로그인 여부·현재 관심 상태는 GET /api/favorites
// 한 번으로 같이 판정한다(별도 /auth/me 호출 없이 401이면 비로그인으로 간주, WP-08 §1-8.2)
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isFavorited, type FavoriteKey } from '../favorite-match';
import styles from './FavoriteButton.module.css';

type Status = 'loading' | 'anonymous' | 'favorited' | 'not-favorited';

export function FavoriteButton({
  courtOfficeCode,
  caseNo,
  itemNo,
  currentPath,
}: FavoriteKey & { currentPath: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/favorites', { cache: 'no-store' })
      .then((response) => {
        if (response.status === 401) return null;
        if (!response.ok) throw new Error(`관심 목록 조회 실패: ${response.status}`);
        return response.json() as Promise<FavoriteKey[]>;
      })
      .then((favorites) => {
        if (cancelled) return;
        if (favorites === null) {
          setStatus('anonymous');
          return;
        }
        setStatus(isFavorited(favorites, { courtOfficeCode, caseNo, itemNo }) ? 'favorited' : 'not-favorited');
      })
      .catch(() => {
        // 네트워크 오류 등으로 상태를 판정할 수 없으면 미등록으로 취급한다 — 클릭 시 재시도하면 된다.
        if (!cancelled) setStatus('not-favorited');
      });

    return () => {
      cancelled = true;
    };
  }, [courtOfficeCode, caseNo, itemNo]);

  async function handleClick() {
    if (status === 'loading' || pending) return;

    if (status === 'anonymous') {
      router.push(`/login?returnTo=${encodeURIComponent(currentPath)}`);
      return;
    }

    const path = `/api/favorites/${encodeURIComponent(courtOfficeCode)}/${encodeURIComponent(caseNo)}/${encodeURIComponent(itemNo)}`;
    const nextStatus = status === 'favorited' ? 'not-favorited' : 'favorited';

    setPending(true);
    try {
      const response = await fetch(path, { method: status === 'favorited' ? 'DELETE' : 'PUT' });
      if (response.status === 401) {
        setStatus('anonymous');
        return;
      }
      if (!response.ok) throw new Error(`관심 등록 처리 실패: ${response.status}`);
      setStatus(nextStatus);
    } finally {
      setPending(false);
    }
  }

  const favorited = status === 'favorited';

  return (
    <button
      type="button"
      className={`${styles.button} ${favorited ? styles.active : ''}`}
      onClick={handleClick}
      disabled={status === 'loading' || pending}
      aria-pressed={favorited}
      aria-label={favorited ? '관심 해제' : '관심 등록'}
    >
      {favorited ? '♥' : '♡'}
    </button>
  );
}
