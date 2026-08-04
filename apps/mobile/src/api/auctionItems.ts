// apps/api 물건 조회 엔드포인트를 호출하는 RN 클라이언트.
// 안드로이드 에뮬레이터는 호스트 localhost를 10.0.2.2로 접근한다(개발 서버 포트 4000).
import { Platform } from 'react-native';

export const API_BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';

export interface AuctionItem {
  courtOfficeCode: string;
  caseNo: string;
  itemNo: string;
  courtName: string | null;
  deptName: string | null;
  usageName: string | null;
  areaKind: string | null;
  /** 면적(㎡) — 건물이면 전용면적, 토지면 토지면적. 여럿이거나 없으면 null. */
  areaM2: number | null;
  /** true면 단가를 계산하지 않는다 — 면적과 가격의 단위가 어긋난다. */
  bulkSale: boolean;
  address: string | null;
  appraisalAmount: number | null;
  minimumSalePrice: number | null;
  failedBidCount: number | null;
  bidDatetime: string | null;
  // 매각물건명세서(법원 공고 사실) 기반 신호. null/빈 배열은 "확인하지 못했다"는 뜻이지
  // "해당 없음"이 아니다 — 화면에서 구분해 표기해야 한다.
  assumedRightsKind: string | null;
  riskFlags: string[];
  tenantCount: number | null;
  lng: number | null;
  lat: number | null;
}

export interface Bbox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export type ItemKey = Pick<
  AuctionItem,
  'courtOfficeCode' | 'caseNo' | 'itemNo'
>;

export async function fetchItemsInBbox(bbox: Bbox): Promise<AuctionItem[]> {
  const query = `minLng=${bbox.minLng}&minLat=${bbox.minLat}&maxLng=${bbox.maxLng}&maxLat=${bbox.maxLat}`;
  const response = await fetch(`${API_BASE_URL}/auction-items/bbox?${query}`);
  if (!response.ok) {
    throw new Error(`지도 물건 조회 실패: ${response.status}`);
  }
  return (await response.json()) as AuctionItem[];
}

export async function fetchAuctionItem(
  key: ItemKey,
): Promise<AuctionItem | null> {
  const path = `${encodeURIComponent(key.courtOfficeCode)}/${encodeURIComponent(
    key.caseNo,
  )}/${encodeURIComponent(key.itemNo)}`;
  const response = await fetch(`${API_BASE_URL}/auction-items/${path}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`물건 조회 실패: ${response.status}`);
  }
  return (await response.json()) as AuctionItem;
}

export interface AuctionItemPhoto {
  id: number;
  source: string;
  seq: number;
  categoryName: string | null;
  caption: string | null;
  contentType: string | null;
  byteSize: number;
}

/** 사진 바이너리 URL — RN Image가 직접 로드한다 (모바일은 CORS 무관) */
export function photoImageUrl(id: number): string {
  return `${API_BASE_URL}/auction-items/photos/${id}`;
}

/** 물건 상세의 사진 메타 목록 — 사진은 사건 단위라 서버가 물건 → 사건 조인으로 돌려준다 */
export async function fetchAuctionItemPhotos(
  key: ItemKey,
): Promise<AuctionItemPhoto[]> {
  const path = `${encodeURIComponent(key.courtOfficeCode)}/${encodeURIComponent(
    key.caseNo,
  )}/${encodeURIComponent(key.itemNo)}`;
  const response = await fetch(`${API_BASE_URL}/auction-items/${path}/photos`);
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(`물건 사진 조회 실패: ${response.status}`);
  }
  return (await response.json()) as AuctionItemPhoto[];
}

export async function fetchAuctionItems(
  limit: number,
  offset: number,
): Promise<AuctionItem[]> {
  const response = await fetch(
    `${API_BASE_URL}/auction-items?limit=${limit}&offset=${offset}`,
  );
  if (!response.ok) {
    throw new Error(`물건 목록 조회 실패: ${response.status}`);
  }
  return (await response.json()) as AuctionItem[];
}
