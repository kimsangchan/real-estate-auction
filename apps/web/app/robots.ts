// 검색엔진 크롤링 허용 + sitemap 위치 안내 (로드맵 2-7 SEO)
import type { MetadataRoute } from 'next';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    // 색인에서 뺄 화면은 disallow가 아니라 페이지 단위 noindex로 막는다 — disallow로 막으면
    // 크롤러가 noindex를 읽지 못해 URL만 색인될 수 있다. 여기는 본문이 없는 API 프록시만 막는다 (WP-10 §1-3)
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
