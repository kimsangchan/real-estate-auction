// 물건 상세 라우트의 [id] 세그먼트에 courtOfficeCode/caseNo/itemNo 3개 키를 밀어넣고 꺼내는 헬퍼
export interface ItemKey {
  courtOfficeCode: string;
  caseNo: string;
  itemNo: string;
}

const SEPARATOR = '_';

export function encodeItemId(key: ItemKey): string {
  return [key.courtOfficeCode, key.caseNo, key.itemNo].join(SEPARATOR);
}

export function decodeItemId(id: string): ItemKey | null {
  // Next.js는 동적 라우트 세그먼트를 percent-encoding이 남은 상태로 넘겨줄 수 있어 직접 디코딩한다.
  const parts = decodeURIComponent(id).split(SEPARATOR);
  if (parts.length !== 3) return null;
  const [courtOfficeCode, caseNo, itemNo] = parts;
  if (!courtOfficeCode || !caseNo || !itemNo) return null;
  return { courtOfficeCode, caseNo, itemNo };
}
