// 검색엔진 크롤링 허용 + sitemap 위치 안내 (로드맵 2-7 SEO)
import type { MetadataRoute } from 'next';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
