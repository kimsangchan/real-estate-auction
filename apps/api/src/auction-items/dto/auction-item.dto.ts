// 물건 조회 API 응답 DTO — WP-02 수집기가 채운 auction_item/auction_case/auction_item_raw를 조합한 값

/**
 * 명세서 기반 인수 보증금 요약. 목록·지도 카드가 대항력 있는 임차인의 존재를 한눈에 보이게 하려고
 * 쓴다. 값의 정의는 상세 화면과 같다(`assumedTotalOf`) — 목록과 상세가 다른 숫자를 말하면 안 된다.
 */
export interface AssumedDepositDto {
  /** 전액 인수가 확정된 보증금 합. 0은 "인수 0원 확정"이다 */
  amount: number;
  /** 금액이 확정되지 않은 임차인이 섞여 있으면 true — 표시할 때 "이상"을 붙인다 */
  isLowerBound: boolean;
}

export interface AuctionItemDto {
  courtOfficeCode: string;
  caseNo: string;
  itemNo: string;
  courtName: string | null;
  deptName: string | null;
  usageName: string | null;
  /**
   * 면적의 종류 — 'AGGREGATE'(집합건물) / 'LAND'(토지) / 'BUILDING'(일반건물).
   * 종류마다 평당가의 분모가 다르다(전유면적 / 대지면적 / 연면적). 값만 주면 화면이 잘못 쓰므로
   * 반드시 함께 내려보낸다. 판별 불가면 null.
   */
  areaKind: 'AGGREGATE' | 'LAND' | 'BUILDING' | null;
  /** 면적(㎡). 표기된 값을 모두 더한 것 — 다층이면 연면적, 여러 필지면 토지 합계. */
  areaM2: number | null;
  /**
   * 일괄매각 여부. true면 **단가(평당·㎡당)를 계산하면 안 된다** — 면적은 목적물 하나 것인데
   * 최저가는 묶음 전체라 단위가 어긋난다(실측: 34.32㎡ 상가에 최저가 340억 → 평당 32.8억).
   */
  bulkSale: boolean;
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
  /**
   * null이면 명세서를 아직 못 받았다는 뜻이다 — "인수할 보증금이 없다"와 구분해서 표기해야 한다.
   * 인수 0원 확정은 `{ amount: 0, isLowerBound: false }`로 온다.
   */
  assumedDeposit: AssumedDepositDto | null;
  lng: number | null;
  lat: number | null;
}
