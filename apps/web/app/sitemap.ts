// 물건 상세 페이지 색인 등록용 sitemap (로드맵 2-7 SEO). 빌드 시 API가 죽어있어도 정적 경로는 살린다
import type { MetadataRoute } from 'next';
import { fetchAuctionItems } from './items/api-client';
import { encodeItemId } from './items/item-id';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3000';
const SITEMAP_ITEM_LIMIT = 100;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily' },
    { url: `${SITE_URL}/items`, changeFrequency: 'daily' },
    { url: `${SITE_URL}/items/browse`, changeFrequency: 'daily' },
  ];

  try {
    const items = await fetchAuctionItems(SITEMAP_ITEM_LIMIT, 0);
    const itemRoutes: MetadataRoute.Sitemap = items.map((item) => ({
      url: `${SITE_URL}/items/${encodeItemId({
        courtOfficeCode: item.courtOfficeCode,
        caseNo: item.caseNo,
        itemNo: item.itemNo,
      })}`,
      changeFrequency: 'daily',
    }));
    return [...staticRoutes, ...itemRoutes];
  } catch {
    return staticRoutes;
  }
}
