// 매각물건명세서 기반 권리분석 응답 — 등기부 없이 계산한 결과 (WP-04 CODEF 연동 전).
//
// **점유자 성명은 절대 담지 않는다.** 법원이 공개한 제3자 개인정보이고, 우리는 존재 여부와
// 권리 관계만 쓴다 (개인정보처리방침 §1-3: 성명은 데이터베이스에만 존재한다).
// 줄을 구분하는 값은 점유부분(호수)과 순번이다.
import type { NoticeAssumption } from '../../rights-analysis/domain/notice-assumption';

export interface AnalyzedTenantDto {
  /** 같은 사람이 정보출처별로 여러 행에 나온다 — 순번이 같으면 동일인이다 */
  tenantSeq: number;
  /** 현황조사 / 권리신고 / 등기사항전부증명서 */
  sourceKind: string | null;
  occupiedPart: string | null;
  moveInDate: string | null;
  fixedDate: string | null;
  depositAmount: number | null;
  demandedDistribution: boolean | null;
  demandedDistributionDate: string | null;
  possessionRightDate: string | null;
  hasPriority: boolean | null;
  distributionDemandEffective: boolean | null;
  assumption: NoticeAssumption;
  assumedAmount: number | null;
}

export interface NoticeAnalysisDto {
  documentDate: string | null;
  /** 명세서에 적힌 최선순위 설정 원문 (예: "2024.02.19. 압류") */
  baselineRaw: string | null;
  baselineDate: string | null;
  distributionDemandDeadline: string | null;
  assumedRightsKind: string | null;
  riskFlags: string[];
  tenants: AnalyzedTenantDto[];
  /**
   * 이 분석이 등기부 없이 명세서만으로 이뤄졌다는 사실. 화면이 한계를 반드시 밝혀야 한다 —
   * 등기 권리 목록과 채권액이 없어 배당표를 만들 수 없고, 그래서 인수액이 확정되지 않는
   * 임차인이 생긴다.
   */
  source: 'NOTICE_ONLY';
}
