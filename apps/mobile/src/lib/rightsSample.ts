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
