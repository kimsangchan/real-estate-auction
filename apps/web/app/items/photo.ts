// 물건 사진 갤러리용 순수 헬퍼 — 프록시 이미지 경로와 대체 텍스트를 만든다 (CSS·fetch 없음, 단위 테스트 대상)
export interface AuctionItemPhoto {
  id: number;
  source: string;
  seq: number;
  categoryName: string | null;
  caption: string | null;
  contentType: string | null;
  byteSize: number;
}

// 브라우저는 CORS 때문에 API 오리진을 직접 못 부른다 — next.config.ts의 /api 프록시 경로를 쓴다
export function photoProxySrc(id: number): string {
  return `/api/auction-items/photos/${id}`;
}

/** 대체 텍스트 — 법원이 붙인 설명이 있으면 그대로, 없으면 구분명(전경도 등), 둘 다 없으면 일반 문구 */
export function photoAlt(photo: Pick<AuctionItemPhoto, 'caption' | 'categoryName'>): string {
  return photo.caption?.trim() || photo.categoryName?.trim() || '경매물건 사진';
}
