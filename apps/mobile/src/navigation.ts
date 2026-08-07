// 네비게이션 파라미터 타입 — 하단 탭(지도/목록)과 루트 스택(탭 → 물건 상세) 계약.
import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  MapHome: undefined;
  ItemList: undefined;
  Favorites: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  ItemDetail: {
    courtOfficeCode: string;
    caseNo: string;
    itemNo: string;
    address: string | null;
  };
  // 권리분석은 물건별 실데이터를 조회한다 — 사건키가 없으면 화면을 열 수 없다.
  RightsAnalysis: {
    courtOfficeCode: string;
    caseNo: string;
    itemNo: string;
  };
  Risks: undefined;
  Checklist: undefined;
  Login: undefined;
};
