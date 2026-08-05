// 매각물건명세서 코드 → 화면 라벨. 수집기(court_parser.py)가 만드는 코드와 1:1로 맞춘다.
//
// 라벨은 법원이 공고한 사실을 그대로 옮긴 것이지 우리 판단이 아니다 — "안전/위험/추천" 같은
// 평가어를 쓰지 않는다(D-011). 예: HUG 대항력포기는 실무상 인수 위험이 사라지는 신호지만,
// 라벨은 "HUG 대항력포기 확약"이라는 사실만 적고 해석은 사용자에게 맡긴다.
//
// 동적 문자열 조합 대신 정적 룩업맵을 쓴다 — 코드가 늘어도 화면이 조용히 깨지지 않게.

/** 인수할 권리 유형. null은 "명세서를 못 받았다"이지 "인수할 권리가 없다"가 아니다. */
export const ASSUMED_RIGHTS_LABEL: Record<string, string> = {
  NONE: '인수할 권리 없음',
  LEASEHOLD_REGISTRATION: '주택임차권등기',
  SUPERFICIES: '지상권',
  PROVISIONAL_REGISTRATION: '가등기',
  OTHER: '그 밖의 인수권리',
};

/** 법원이 명세서에 적은 특이사항. */
export const RISK_FLAG_LABEL: Record<string, string> = {
  HUG_PRIORITY_WAIVER: 'HUG 대항력포기 확약',
  LIEN_CLAIM: '유치권 신고',
  PREEMPTIVE_PURCHASE: '우선매수 신고',
  SENIOR_TAX: '선순위 조세',
  TITLE_LOSS_RISK: '소유권 상실 가능',
  RESALE: '재매각',
  LAND_SEPARATE_REGISTRATION: '토지 별도등기',
  UNAUTHORIZED_EXTENSION: '무단증축·미준공',
  SITE_RIGHT_UNREGISTERED: '대지권 미등기',
  WATER_LEAK: '누수',
};

/** 모르는 코드는 숨기지 않고 코드 그대로 보여준다 — 조용히 사라지면 위험 신호를 놓친다. */
export function assumedRightsLabel(kind: string | null): string | null {
  if (kind === null) return null;
  return ASSUMED_RIGHTS_LABEL[kind] ?? kind;
}

export function riskFlagLabels(flags: readonly string[]): string[] {
  return flags.map((flag) => RISK_FLAG_LABEL[flag] ?? flag);
}

/**
 * 법원이 콤마로 묶어 보내는 용도 원문을 짧게 만든다.
 * 실측: "연립주택,다세대,빌라"(126건), "상가,오피스텔,근린시설"(127건) 같은 묶음이 온다.
 * 마커·카드 폭이 좁아 첫 항목만 쓴다 — 묶음의 첫 값이 대표 용도다.
 */
export function shortUsageName(usageName: string | null): string | null {
  if (usageName === null) return null;
  const first = usageName.split(',')[0]?.trim();
  return first ? first : null;
}

/**
 * 점유자 수 라벨. 0명은 "법원이 조사했는데 없더라"라서 표기 가치가 있고,
 * null은 "명세서를 못 받았다"라서 임차인 유무를 말할 수 없다.
 */
export function tenantLabel(tenantCount: number | null): string | null {
  if (tenantCount === null) return null;
  return tenantCount === 0 ? '점유자 없음' : `점유자 ${tenantCount}명`;
}

/**
 * 명세서 기반 인수 판정 → 화면 라벨. 등기부 없이 나온 결과라 "금액 미상"이 정상 상태다.
 * 판단·권유가 아니라 상태를 그대로 옮긴 문구만 쓴다 (D-011).
 */
export const NOTICE_ASSUMPTION_LABEL: Record<string, string> = {
  NOT_ASSUMED: '인수 안 함',
  ASSUMED_FULL: '보증금 전액 인수',
  ASSUMED_AMOUNT_UNKNOWN: '인수 금액 확인 필요',
  UNKNOWN: '판정 불가',
};

/** 그 판정이 왜 그렇게 나왔는지 — 사실만 적는다. */
export const NOTICE_ASSUMPTION_REASON: Record<string, string> = {
  NOT_ASSUMED: '대항력이 말소기준보다 늦어요',
  ASSUMED_FULL: '대항력이 있는데 배당요구가 없거나 종기를 넘겼어요',
  ASSUMED_AMOUNT_UNKNOWN: '대항력과 배당요구가 모두 있어요. 배당으로 얼마를 회수할지는 등기부가 있어야 알 수 있어요',
  UNKNOWN: '전입일이나 최선순위 설정일이 명세서에 없어요',
};

export function noticeAssumptionLabel(assumption: string): string {
  return NOTICE_ASSUMPTION_LABEL[assumption] ?? assumption;
}

export function noticeAssumptionReason(assumption: string): string | null {
  return NOTICE_ASSUMPTION_REASON[assumption] ?? null;
}
