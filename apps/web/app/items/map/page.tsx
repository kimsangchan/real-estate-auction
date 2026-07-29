// 지도 기반 물건 탐색 화면 — 서버 컴포넌트는 metadata만 담당하고 실제 지도는 클라이언트 컴포넌트에 맡긴다
// (naver 지도 SDK가 window 전역에 의존해 SSR 불가, WP-07 범위 제외 §)
import type { Metadata } from 'next';
import { MapView } from './MapView';
import { NOINDEX } from '../../seo';

export const metadata: Metadata = {
  title: '경매 지도',
  description: '지도에서 경매 물건을 탐색해요',
  robots: NOINDEX, // 지도는 클라이언트 JS 렌더라 색인할 본문이 없다 (WP-10 §1-3)
};

export default function ItemMapPage() {
  return <MapView />;
}
