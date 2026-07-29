// SEO 메타데이터·구조화 데이터 조립 (로드맵 2-7, WP-10). CSS·next 런타임에 의존하지 않아
// node --test로 직접 검증한다 (WP-10 §1-8)
import { formatWon } from './items/format';

export const SITE_NAME = '부동산 경매 플랫폼';

// robots.ts·sitemap.ts가 이미 쓰는 환경변수를 그대로 재사용한다 (WP-10 §1-2)
export const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3000';

/**
 * 색인은 막되 링크는 따라가게 둔다 — 이미 색인된 URL이 있으면 크롤러가 다시 읽고 색인을 내려야 하므로
 * robots.txt의 disallow가 아니라 페이지 단위 noindex로 막는다 (WP-10 §1-3)
 */
export const NOINDEX = { index: false, follow: true };

export interface ItemSeoFields {
  caseNo: string;
  courtName: string | null;
  usageName: string | null;
  address: string | null;
  appraisalAmount: number | null;
  minimumSalePrice: number | null;
}

export function buildItemTitle(item: ItemSeoFields): string {
  const priceLabel = item.minimumSalePrice !== null ? `${formatWon(item.minimumSalePrice)} 경매` : '경매 물건';
  return `${item.address ?? item.caseNo} - ${priceLabel} | ${SITE_NAME}`;
}

export function buildItemDescription(item: ItemSeoFields): string {
  const appraisal = item.appraisalAmount !== null ? formatWon(item.appraisalAmount) : '정보 없음';
  const minimum = item.minimumSalePrice !== null ? formatWon(item.minimumSalePrice) : '정보 없음';
  // 사실 서술만 — 판단·권유 표현 금지 (D-011)
  const parts = [item.courtName, item.caseNo, item.usageName ?? '물건'].filter(Boolean);
  return `${parts.join(' · ')} · 감정가 ${appraisal}, 최저가 ${minimum}`;
}

/**
 * Next는 openGraph를 깊은 병합하지 않는다 — 페이지가 openGraph를 하나라도 지정하면 루트 레이아웃의
 * type·siteName·locale이 통째로 사라진다. 그래서 페이지마다 이 헬퍼로 전체를 다시 만든다 (WP-10 §1-6)
 */
export function buildOpenGraph(url: string, title?: string, description?: string) {
  return { type: 'website' as const, siteName: SITE_NAME, locale: 'ko_KR', url, title, description };
}

export interface Crumb {
  name: string;
  /**
   * 사이트 루트 기준 경로. 현재 페이지를 가리키는 마지막 항목은 생략할 수 있다
   * (schema.org BreadcrumbList는 마지막 항목의 `item`을 요구하지 않는다)
   */
  path?: string;
}

/**
 * BreadcrumbList JSON-LD. Product/Offer는 쓰지 않는다 — 우리는 판매자가 아니고 최저매각가격도
 * 우리가 제시하는 가격이 아니다 (WP-10 §1-5)
 */
export function buildBreadcrumbJsonLd(siteUrl: string, trail: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      // canonical과 같은 형태가 되도록 URL 인코딩을 거친다 (사건번호에 한글이 들어간다)
      ...(crumb.path ? { item: new URL(crumb.path, siteUrl).toString() } : {}),
    })),
  };
}

/**
 * JSON-LD를 <script> 안에 넣을 때 쓴다. 물건 주소는 법원 사이트에서 수집한 값이라 신뢰할 수 없으므로
 * `<`를 이스케이프해 `</script>`로 태그를 닫고 빠져나가는 걸 막는다
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
