// 권리분석 오케스트레이션 — 말소기준 판별 → 인수/말소 분류 → 임차인 분석 → (선택) 배당·총부담액 계산
// 출력은 enum 상태값과 금액만 포함한다 — 판단·권유 문구를 넣지 않는다 (decision-log D-011)
import { Injectable } from '@nestjs/common';
import { findBaselineRight, type BaselineRight } from '../domain/baseline-right';
import { computeDistribution, type DistributionResult } from '../domain/distribution';
import { classifyRegisteredRight, classifyUnregisteredRisk } from '../domain/right-classification';
import { calculateTotalBurden, type TotalBurdenResult } from '../domain/total-burden';
import { analyzeTenantPriority } from '../domain/tenant-priority';
import type {
  RegisteredRight,
  RegisteredRightClassification,
  RuleTag,
  Tenant,
  TenantClassification,
  UnregisteredRisk,
  UnregisteredRiskClassification,
} from '../domain/types';
import { validateRightsAnalysisRequest } from '../dto/validate-request';

export interface RightsAnalysisResult {
  baselineRight: BaselineRight;
  registeredRightClassifications: RegisteredRightClassification[];
  tenantClassifications: TenantClassification[];
  unregisteredRiskClassifications: UnregisteredRiskClassification[];
  /** saleAmount(낙찰대금)를 입력하지 않으면 배당표는 계산하지 않는다 */
  distribution: DistributionResult | null;
  totalBurden: TotalBurdenResult | null;
}

const TENANT_STATUS_RULE: RuleTag = { ruleId: 'TENANT_STATUS', ruleVersion: 1 };

@Injectable()
export class RightsAnalysisService {
  analyze(input: unknown): RightsAnalysisResult {
    const request = validateRightsAnalysisRequest(input);

    const registeredRights: RegisteredRight[] = request.registeredRights;
    const tenants: Tenant[] = request.tenants.map((dto) => ({
      id: dto.id,
      moveInDate: dto.moveInDate,
      fixedDate: dto.fixedDate ?? null,
      depositAmount: dto.depositAmount,
      depositTranches: dto.depositTranches?.map((tranche) => ({
        amount: tranche.amount,
        fixedDate: tranche.fixedDate ?? null,
      })),
      demandedDistribution: dto.demandedDistribution,
      demandedDistributionDate: dto.demandedDistributionDate ?? null,
    }));
    const unregisteredRisks: UnregisteredRisk[] = request.unregisteredRisks ?? [];

    const baselineRight = findBaselineRight(registeredRights);

    const registeredRightClassifications = registeredRights.map((right) =>
      classifyRegisteredRight(right, baselineRight.receivedDate),
    );
    const unregisteredRiskClassifications = unregisteredRisks.map(classifyUnregisteredRisk);

    const distribution =
      request.saleAmount === undefined
        ? null
        : computeDistribution({
            saleAmount: request.saleAmount,
            auctionCost: request.auctionCost ?? 0,
            registeredRights,
            tenants,
            taxClaims: request.taxClaims,
            region: request.region,
            baselineDate: baselineRight.receivedDate,
            distributionDemandDeadline: request.distributionDemandDeadline,
            saleDecisionDate: request.saleDecisionDate,
          });

    const tenantClassifications = tenants.map((tenant) =>
      this.classifyTenant(tenant, baselineRight.receivedDate, request.distributionDemandDeadline, distribution),
    );

    const totalBurden =
      request.saleAmount === undefined
        ? null
        : calculateTotalBurden(
            request.saleAmount,
            tenantClassifications.map((t) => t.assumedAmount),
          );

    return {
      baselineRight,
      registeredRightClassifications,
      tenantClassifications,
      unregisteredRiskClassifications,
      distribution,
      totalBurden,
    };
  }

  private classifyTenant(
    tenant: Tenant,
    baselineDate: string,
    distributionDemandDeadline: string,
    distribution: DistributionResult | null,
  ): TenantClassification {
    const priority = analyzeTenantPriority(tenant, baselineDate, distributionDemandDeadline);
    const base = {
      tenantId: tenant.id,
      possessionRightDate: priority.possessionRightDate,
      hasPriority: priority.hasPriority,
      distributionDemandEffective: priority.distributionDemandEffective,
      ...TENANT_STATUS_RULE,
    };

    if (!priority.hasPriority) {
      // 후순위(대항력 없음) — 매각으로 임차권이 소멸하고 매수인은 인수하지 않는다
      return { ...base, status: 'EXTINGUISHED', assumedAmount: 0 };
    }

    if (!priority.distributionDemandEffective) {
      // 선순위인데 유효한 배당요구가 없어 보증금 반환 의무가 매수인에게 그대로 이전된다
      return { ...base, status: 'ASSUMED', assumedAmount: tenant.depositAmount };
    }

    if (!distribution) {
      // 배당 계산에 필요한 낙찰대금(saleAmount)이 없어 인수 잔액을 확정할 수 없다
      return { ...base, status: 'NEEDS_REVIEW', assumedAmount: 0 };
    }

    const outcome = distribution.tenantOutcomes.find((o) => o.tenantId === tenant.id);
    const assumedAmount = outcome?.assumedAmount ?? tenant.depositAmount;

    return { ...base, status: assumedAmount > 0 ? 'ASSUMED' : 'EXTINGUISHED', assumedAmount };
  }
}
