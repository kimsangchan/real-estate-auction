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
