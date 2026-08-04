// 물건 조회 API 응답 DTO — WP-02 수집기가 채운 auction_item/auction_case/auction_item_raw를 조합한 값
export interface AuctionItemDto {
  courtOfficeCode: string;
  caseNo: string;
  itemNo: string;
  courtName: string | null;
  deptName: string | null;
  usageName: string | null;
  /**
   * 면적(㎡) — 건물이면 전용면적, 토지면 토지면적. 법원이 자유 텍스트로 주는 값을 뽑는다.
   * 일괄매각·다층건물처럼 면적이 여럿이거나 표기가 없으면 null — 추정하지 않는다.
   */
  areaM2: number | null;
  address: string | null;
  appraisalAmount: number | null;
  minimumSalePrice: number | null;
  failedBidCount: number | null;
  bidDatetime: string | null;
  // 매각물건명세서(법원 공고 사실) 기반 신호. 명세서를 아직 못 받은 물건은 null/빈 배열이다 —
  // "인수할 권리가 없다"가 아니라 "확인하지 못했다"는 뜻이라 화면에서 구분해 표기해야 한다.
  assumedRightsKind: string | null;
  riskFlags: string[];
  tenantCount: number | null;
  lng: number | null;
  lat: number | null;
}
