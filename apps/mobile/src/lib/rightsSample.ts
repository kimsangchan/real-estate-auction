// 권리분석 화면 와이어프레임용 예시 데이터 — CODEF 실호출(유료) 연동 전까지 사용(웹 sample-data의 권리분석 subset).
export type RightStatus = 'ASSUMED' | 'EXTINGUISHED' | 'NEEDS_REVIEW';

export const sampleSummary = {
  usageName: '오피스텔',
  failedBidCount: 17,
  minimumBidRate: 2,
};

export const sampleBaselineDate = '2022-10-18';
export const sampleBidPrice = 6_000_000;
export const sampleTotalAssumedAmount = 0;

export interface SampleRight {
  id: string;
  label: string;
  receivedDate: string;
  status: RightStatus;
  isBaseline: boolean;
}

export const sampleRights: SampleRight[] = [
  {
    id: '3',
    label: '가압류',
    receivedDate: '2022-10-18',
    status: 'EXTINGUISHED',
    isBaseline: true,
  },
  {
    id: '4',
    label: '가압류',
    receivedDate: '2023-05-23',
    status: 'EXTINGUISHED',
    isBaseline: false,
  },
  {
    id: '5',
    label: '가압류',
    receivedDate: '2023-07-28',
    status: 'EXTINGUISHED',
    isBaseline: false,
  },
  {
    id: '6',
    label: '강제경매개시결정',
    receivedDate: '2023-09-21',
    status: 'EXTINGUISHED',
    isBaseline: false,
  },
];

export interface SampleTenant {
  id: string;
  label: string;
  possessionRightDate: string;
  depositAmount: number;
  assumedAmount: number;
  status: RightStatus;
}

// 이 물건 자체엔 등록 임차인이 없어 컴포넌트 시연용 예시 임차인을 둔다(실제 사건과 무관).
export const sampleTenants: SampleTenant[] = [
  {
    id: 'example-1',
    label: '예시 임차인 A',
    possessionRightDate: '2021-03-15',
    depositAmount: 50_000_000,
    assumedAmount: 0,
    status: 'EXTINGUISHED',
  },
];

export const sampleUnregisteredRisks = [
  { id: 'risk-1', label: '유치권 신고 기재' },
];

export interface SampleDetectedRisk {
  id: string;
  keyword: string;
  sourceDocument: string;
  originalText: string;
  nextAction: string;
}

export interface SampleChecklistItem {
  id: string;
  category: string;
  label: string;
  help: string;
  fromRisk: boolean;
}

// 물건별 자동 생성 임장 체크리스트 — 위험 플래그 파생 항목 + 항상 포함되는 기본 항목 (F-04, 웹 sample-data와 동일).
export const sampleChecklistItems: SampleChecklistItem[] = [
  {
    id: 'check-lien',
    category: '현장 확인',
    label: '점유자에게 유치권 주장 여부 확인',
    help: '공사대금 영수증·계약서 등 근거 서류가 있는지 물어보세요.',
    fromRisk: true,
  },
  {
    id: 'check-tenant-registry',
    category: '서류 확인',
    label: '전입세대확인서 열람',
    help: '주민센터에서 발급받아 임차인 전입 여부를 확인해요.',
    fromRisk: false,
  },
  {
    id: 'check-occupant',
    category: '현장 확인',
    label: '점유자 확인',
    help: '실제 거주자가 소유자인지 임차인인지 확인해요.',
    fromRisk: false,
  },
  {
    id: 'check-maintenance-fee',
    category: '현장 확인',
    label: '관리비 체납 확인',
    help: '관리사무소에 체납액을 문의해요. 공용부분 체납분은 낙찰자가 인수할 수 있어요.',
    fromRisk: false,
  },
];

// 매각물건명세서·현황조사서에서 감지한 위험 키워드 + 원문 발췌 (판단 문구 없이 사실만 서술, D-011).
export const sampleDetectedRisks: SampleDetectedRisk[] = [
  {
    id: 'risk-1',
    keyword: '유치권 신고 기재',
    sourceDocument: '매각물건명세서',
    originalText:
      '본건에 대하여 소외 ○○○이 공사대금 00원의 유치권을 신고하였으나 그 성립여부는 불분명함',
    nextAction:
      '현장에서 점유자에게 유치권 주장 여부와 근거 서류를 확인해보세요.',
  },
];
