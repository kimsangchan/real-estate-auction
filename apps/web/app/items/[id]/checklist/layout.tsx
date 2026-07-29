// 체크리스트 화면의 metadata 전용 레이아웃 — page.tsx가 'use client'라 metadata를 직접 export할 수 없다
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NOINDEX } from '../../../seo';

// sample-data 기반이라 물건 ID와 무관하게 본문이 같다 — 실데이터 연동 시 해제 (WP-10 §1-3)
export const metadata: Metadata = { robots: NOINDEX };

export default function ChecklistLayout({ children }: { children: ReactNode }) {
  return children;
}
