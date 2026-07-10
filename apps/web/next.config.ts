// Next.js 설정 — 네이버 지도 클라이언트가 같은 출처로 bbox API를 호출하도록 프록시한다
// (apps/api는 CORS 미설정이라 브라우저에서 직접 호출 불가, WP-07 §1-3)
import type { NextConfig } from 'next';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_BASE_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
