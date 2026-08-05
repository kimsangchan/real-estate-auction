// 한 마커에 묶인 물건들이 "일괄매각 한 건"인지 판정한다.
//
// 일괄매각은 사건 하나가 목적물 여럿을 통째로 파는 것이라, 각 목적물의 최저가 칸에는
// **묶음 전체 가격**이 들어 있다. 실측(서울동부 2025타경859): 목적물 362개가 모두
// 최저가 421억 6,300만으로 적혀 있다. 이걸 줄마다 그대로 보여주면 "이 1.1평 상가가 421억"으로
// 읽히므로, 가격은 묶음에 한 번만 적고 줄에서는 뺀다.

export interface BulkLotItem {
  caseNo: string;
  bulkSale: boolean;
}

/**
 * 사건이 하나이고 모든 목적물이 일괄매각 표시일 때만 true.
 *
 * 사건을 함께 보는 이유는 같은 좌표에 서로 다른 일괄매각 사건이 겹칠 수 있어서다 —
 * 그때는 가격이 사건마다 달라 한 번만 적을 수 없다.
 */
export function isBulkLot(items: readonly BulkLotItem[]): boolean {
  const first = items[0];
  if (first === undefined || items.length < 2) return false;
  return items.every((item) => item.bulkSale && item.caseNo === first.caseNo);
}
