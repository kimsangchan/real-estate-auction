// 권리분석 표의 행을 만들고 인수/확인필요/말소로 가른다. 상세 페이지와 지도 패널이 같은 화면을
// 보여야 하므로 렌더링과 분리된 순수 모듈로 둔다 — 두 곳에서 갈래가 달라지면 같은 물건이 다르게 읽힌다.
import { formatWon } from './format';
import type { RightStatus, SampleRight, SampleTenant } from './sample-data';

export interface RightsRow {
  id: string;
  kind: string;
  label: string;
  detail: string;
  status: RightStatus;
  isBaseline?: boolean;
}

export interface RightsSummary {
  assumed: RightsRow[];
  needsReview: RightsRow[];
  extinguished: RightsRow[];
}

export interface UnregisteredRisk {
  id: string;
  label: string;
}

export function buildRightsSummary(
  rights: SampleRight[],
  tenants: SampleTenant[],
  unregisteredRisks: UnregisteredRisk[],
): RightsSummary {
  const rightRows: RightsRow[] = rights.map((right) => ({
    id: right.id,
    kind: '등기 권리',
    label: right.label,
    detail: `접수 ${right.receivedDate}`,
    status: right.status,
    isBaseline: right.isBaseline,
  }));

  const tenantRows: RightsRow[] = tenants.map((tenant) => ({
    id: tenant.id,
    kind: '임차인',
    label: `${tenant.label} · 보증금 ${formatWon(tenant.depositAmount)}`,
    detail: `대항력 ${tenant.possessionRightDate} · 인수 보증금 ${formatWon(tenant.assumedAmount)}`,
    status: tenant.status,
  }));

  // 등기부에 없는 신고 사항(유치권 등)은 규칙으로 인수 여부를 가릴 수 없다 — 항상 확인 필요다.
  const reviewRows: RightsRow[] = unregisteredRisks.map((risk) => ({
    id: risk.id,
    kind: '확인 필요',
    label: risk.label,
    detail: '등기부에 없는 내용 — 임장 체크리스트에서 확인해요',
    status: 'NEEDS_REVIEW' as const,
  }));

  const all = [...rightRows, ...tenantRows, ...reviewRows];
  return {
    assumed: all.filter((row) => row.status === 'ASSUMED'),
    needsReview: all.filter((row) => row.status === 'NEEDS_REVIEW'),
    extinguished: all.filter((row) => row.status === 'EXTINGUISHED'),
  };
}
