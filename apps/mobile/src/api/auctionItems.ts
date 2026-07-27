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
  address: string | null;
  appraisalAmount: number | null;
  minimumSalePrice: number | null;
  failedBidCount: number | null;
  bidDatetime: string | null;
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
