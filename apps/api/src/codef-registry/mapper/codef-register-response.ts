// 부동산등기부등본 응답(output) 스키마 — 2026-07-08 실호출로 확인·검증 완료.
// 갑구/을구는 [헤더행(resType2="1"), 데이터행(resType2="2")...] 표 구조로 내려온다 — 데이터행의
// resDetailList는 resNumber(열 위치)로 헤더행과 같은 위치의 컬럼명에 대응한다.
// 자세한 파싱 규칙은 registry-row-table.ts, 실 캡처 예시는 test/fixtures/codef-registry-real-response.json 참고.
export interface CodefRegisterDetail {
  resNumber: string;
  resContents: string;
}

export interface CodefRegisterContentItem {
  resNumber: string;
  /** 행 종류 — "1"=헤더행, "2"=데이터행 (등기목적 자체가 아니다) */
  resType2: string;
  resDetailList: CodefRegisterDetail[];
}

/** 갑구/을구 등 한 구획의 표 — "등기목적" 컬럼이 있는 구획만 권리 표다(소유지분현황·개별공시지가 등 제외) */
export interface CodefRegisterSection {
  resType: string;
  resType1: string;
  resContentsList: CodefRegisterContentItem[];
}

export interface CodefRegisterAddressCandidate {
  resUserNm: string;
  commUniqueNo: string;
  commAddrLotNumber: string;
  resState: string;
  resType: string;
}

export interface CodefRegisterSearchItem {
  resType: string;
  resNumber: string;
  commUniqueNo: string;
  commListNumber: string;
  resListType: string;
}

export interface CodefRegisterEntry {
  resIssueNo: string;
  commUniqueNo: string;
  resDocTitle: string;
  resRealty: string;
  commCompetentRegistryOffice: string;
  resPublishNo: string;
  resPublishDate: string;
  resPublishRegistryOffice: string;
  resPrecautionsList: CodefRegisterDetail[];
  /** 등기 요약 — 현재 유효한 권리 */
  resRegistrationSumList: CodefRegisterSection[];
  /** 등기 이력 — 말소·변경된 과거 권리 */
  resRegistrationHisList: CodefRegisterSection[];
}

export interface CodefRegisterOutput {
  commIssueCode: string;
  resIssueYN: string;
  resTotalPageCount: string;
  commStartPageNo: string;
  resEndPageNo: string;
  resWarningMessage: string;
  resOriGinalData: string;
  resAddrList: CodefRegisterAddressCandidate[];
  resSearchList: CodefRegisterSearchItem[];
  resRegisterEntriesList: CodefRegisterEntry[];
  /** 이미지 열람 결과 목록 — 이 커넥터는 텍스트 조회만 다루므로 항목 구조는 사용하지 않는다 */
  resImageList?: unknown[];
}
