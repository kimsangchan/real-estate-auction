// 네비게이션 스택 파라미터 타입 — 화면 간 이동 계약(지도 홈 → 물건 상세)
export type RootStackParamList = {
  MapHome: undefined;
  ItemDetail: {
    courtOfficeCode: string;
    caseNo: string;
    itemNo: string;
    address: string | null;
  };
};
