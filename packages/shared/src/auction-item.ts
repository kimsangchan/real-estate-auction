// 경매 물건 요약 공용 타입 — API 응답과 클라이언트가 공유하는 계약의 샘플 (WP-01)
export interface AuctionItemSummary {
  /** 법원 사무소 코드 (courtauction cortOfcCd) */
  courtCode: string;
  /** 사건번호 (예: 2026타경12345) */
  caseNo: string;
  /** 물건 번호 (한 사건에 물건 여러 개 가능) */
  itemNo: number;
  /** 감정평가액 (원) */
  appraisedValue: number;
  /** 최저매각가격 (원) */
  minimumBidPrice: number;
  /** 유찰 횟수 */
  failedBidCount: number;
  /** 매각기일 (ISO 8601, 미정이면 null) */
  saleDate: string | null;
}
