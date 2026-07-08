// 물건 조회 API 응답 DTO — WP-02 수집기가 채운 auction_item/auction_case/auction_item_raw를 조합한 값
export interface AuctionItemDto {
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
