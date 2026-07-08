// 권리분석 도메인 타입 — 등기 권리·임차인·판정 결과의 순수 데이터 계약 (WP-03)

/** 말소기준권리 후보 6종(전세권 예외 포함) — 접수일 최선순위 비교 대상 */
export type BaselineCandidateType =
  | 'MORTGAGE' // 저당권·근저당권
  | 'SEIZURE' // 압류
  | 'PROVISIONAL_SEIZURE' // 가압류
  | 'COLLATERAL_PROVISIONAL_REGISTRATION' // 담보가등기
  | 'AUCTION_COMMENCEMENT' // 경매개시결정등기
  | 'LEASEHOLD'; // 전세권 — 건물 전부 + 배당요구 시에만 예외적으로 후보

/** 인수/말소 판정 대상이 되는 용익물권·가처분·가등기 계열 */
export type EncumbranceType = 'LEASEHOLD' | 'SUPERFICIES' | 'EASEMENT' | 'PROVISIONAL_REGISTRATION' | 'PROVISIONAL_DISPOSITION';

export type RegisteredRightType = BaselineCandidateType | EncumbranceType;

/** 등기부에 없어 서류·현장조사로만 확인되는 위험 — 자동 판별 불가 (01-discovery §1-3) */
export type UnregisteredRiskType = 'LIEN' | 'STATUTORY_SUPERFICIES' | 'GRAVE_BASE_RIGHT';

/** 소액임차인 최우선변제 지역 구분 (4단계 티어로 단순화 — small-deposit-tenant-table.ts 참고) */
export type RegionTier = 'SEOUL' | 'OVERCONCENTRATION' | 'METRO' | 'OTHER';

export type RightStatus = 'EXTINGUISHED' | 'ASSUMED' | 'NEEDS_REVIEW';

/** 감사·면책 방어를 위한 판정 근거 태그 (AGENTS.md WP-03 요구사항 2) */
export interface RuleTag {
  ruleId: string;
  ruleVersion: number;
}

export interface RegisteredRight {
  id: string;
  type: RegisteredRightType;
  /** 등기 접수일자 (YYYY-MM-DD) */
  receivedDate: string;
  /** 채권액 등 배당 계산에 쓰이는 금액 (없으면 배당 계산에서 제외) */
  amount?: number;
  /** 전세권이 건물 전부에 설정됐는지 — 말소기준 예외 조건 판별용 */
  isWholeBuilding?: boolean;
  /** 전세권자가 배당요구를 했는지 — 말소기준 예외 조건 판별용 */
  demandedDistribution?: boolean;
}

export interface Tenant {
  id: string;
  /** 전입신고일 (YYYY-MM-DD) */
  moveInDate: string;
  /** 확정일자 (YYYY-MM-DD), 없으면 null */
  fixedDate: string | null;
  /** 임차보증금 */
  depositAmount: number;
  demandedDistribution: boolean;
  /** 배당요구 신청일 — 배당요구종기 경과 여부 판정용 (demandedDistribution=true일 때만 의미 있음) */
  demandedDistributionDate: string | null;
}

export interface UnregisteredRisk {
  id: string;
  type: UnregisteredRiskType;
}

export interface RegisteredRightClassification extends RuleTag {
  rightId: string;
  status: RightStatus;
}

export interface TenantClassification extends RuleTag {
  tenantId: string;
  /** 대항력 발생일 = 전입일 다음 날 0시 (YYYY-MM-DD) */
  possessionRightDate: string;
  /** 말소기준권리보다 선순위(대항력 있음) 여부 */
  hasPriority: boolean;
  /** 배당요구가 배당요구종기 이내에 적법하게 이뤄졌는지 */
  distributionDemandEffective: boolean;
  status: RightStatus;
  /** 최종적으로 매수인이 인수하는 금액 (배당으로 회수되지 않은 잔액) */
  assumedAmount: number;
}

export interface UnregisteredRiskClassification extends RuleTag {
  riskId: string;
  status: 'NEEDS_REVIEW';
}
