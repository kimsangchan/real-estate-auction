// apps/api의 물건 조회 엔드포인트를 호출하는 서버 전용 클라이언트 (WP-02 수집 데이터)
import { cache } from 'react';
import type { ItemKey } from './item-id';
import type { AuctionItemPhoto } from './photo';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

export interface AuctionItem {
  courtOfficeCode: string;
  caseNo: string;
  itemNo: string;
  courtName: string | null;
  deptName: string | null;
  usageName: string | null;
  /** 전용면적(㎡). 면적이 여럿이거나 표기가 없으면 null — 추정하지 않는다. */
  exclusiveAreaM2: number | null;
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
}

// generateMetadata와 페이지 컴포넌트가 같은 요청 안에서 중복 호출하지 않도록 React cache()로 묶는다
export const fetchAuctionItem = cache(async (key: ItemKey): Promise<AuctionItem | null> => {
  const url = `${API_BASE_URL}/auction-items/${encodeURIComponent(key.courtOfficeCode)}/${encodeURIComponent(key.caseNo)}/${encodeURIComponent(key.itemNo)}`;
  const response = await fetch(url, { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`물건 조회 실패: ${response.status}`);
  }
  return (await response.json()) as AuctionItem;
});

/** 물건 상세의 사진 메타 목록 — 물건이 없으면(404) 빈 배열로 취급한다 (상세 본문이 이미 404를 처리한다) */
export async function fetchAuctionItemPhotos(key: ItemKey): Promise<AuctionItemPhoto[]> {
  const url = `${API_BASE_URL}/auction-items/${encodeURIComponent(key.courtOfficeCode)}/${encodeURIComponent(key.caseNo)}/${encodeURIComponent(key.itemNo)}/photos`;
  const response = await fetch(url, { cache: 'no-store' });
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(`물건 사진 조회 실패: ${response.status}`);
  }
  return (await response.json()) as AuctionItemPhoto[];
}

export interface AuctionItemFilter {
  sido?: string;
  sigungu?: string;
}

export async function fetchAuctionItems(
  limit: number,
  offset: number,
  filter: AuctionItemFilter = {},
): Promise<AuctionItem[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filter.sido) params.set('sido', filter.sido);
  if (filter.sigungu) params.set('sigungu', filter.sigungu);
  const response = await fetch(`${API_BASE_URL}/auction-items?${params.toString()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`물건 목록 조회 실패: ${response.status}`);
  }
  return (await response.json()) as AuctionItem[];
}

export interface RegionCount {
  name: string;
  count: number;
}

export async function fetchRegionCounts(sido?: string): Promise<RegionCount[]> {
  const params = sido ? `?sido=${encodeURIComponent(sido)}` : '';
  const response = await fetch(`${API_BASE_URL}/auction-items/regions${params}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`지역 집계 조회 실패: ${response.status}`);
  }
  return (await response.json()) as RegionCount[];
}
