import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RightsAnalysisValidationError } from '../dto/validate-request';
import { RightsAnalysisService } from './rights-analysis.service';

interface Scenario {
  name: string;
  input: unknown;
  expected: {
    baselineRightId: string;
    registeredRightStatuses: Record<string, string>;
    tenantStatuses: Record<string, { status: string; assumedAmount: number }>;
    unregisteredRiskStatuses?: Record<string, string>;
  };
}

const SCENARIOS_PATH = join(__dirname, '..', '..', '..', 'test', 'fixtures', 'rights-analysis-scenarios.json');
const scenarios: Scenario[] = JSON.parse(readFileSync(SCENARIOS_PATH, 'utf-8'));

// 판단·권유 문구 금지 (decision-log D-011) — 출력 JSON 전수에서 이런 표현이 나오면 안 된다
const BANNED_PHRASES = ['추천', '안전', '위험', '판단', '권유', '입찰하세요', '하지 마세요', '피하세요'];

describe('RightsAnalysisService — 검증 시나리오 10건 (01-domain-discovery §1-3)', () => {
  const service = new RightsAnalysisService();

  it('시나리오가 10건 이상 준비돼 있다', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(10);
  });

  it.each(scenarios.map((s) => [s.name, s] as const))('%s', (_name, scenario) => {
    const result = service.analyze(scenario.input);

    expect(result.baselineRight.rightId).toBe(scenario.expected.baselineRightId);

    for (const [rightId, status] of Object.entries(scenario.expected.registeredRightStatuses)) {
      const classification = result.registeredRightClassifications.find((r) => r.rightId === rightId);
      expect(classification?.status).toBe(status);
    }

    for (const [tenantId, expectedTenant] of Object.entries(scenario.expected.tenantStatuses)) {
      const classification = result.tenantClassifications.find((t) => t.tenantId === tenantId);
      expect(classification?.status).toBe(expectedTenant.status);
      expect(classification?.assumedAmount).toBe(expectedTenant.assumedAmount);
    }

    for (const [riskId, status] of Object.entries(scenario.expected.unregisteredRiskStatuses ?? {})) {
      const classification = result.unregisteredRiskClassifications.find((r) => r.riskId === riskId);
      expect(classification?.status).toBe(status);
    }
  });

  it('실패: 필수 필드가 없는 요청은 서비스 진입점에서 차단된다', () => {
    expect(() => service.analyze({ tenants: [], region: 'SEOUL', distributionDemandDeadline: '2024-06-01' })).toThrow(
      RightsAnalysisValidationError,
    );
  });

  it('출력 JSON 전수에서 판단·권유 문자열이 0건이다', () => {
    for (const scenario of scenarios) {
      const result = service.analyze(scenario.input);
      const serialized = JSON.stringify(result);

      for (const phrase of BANNED_PHRASES) {
        expect(serialized).not.toContain(phrase);
      }
    }
  });

  it('saleAmount 없이 배당요구 효력이 있는 선순위 임차인은 NEEDS_REVIEW로 보류된다', () => {
    const result = service.analyze({
      registeredRights: [{ id: 'r1', type: 'MORTGAGE', receivedDate: '2024-03-10' }],
      tenants: [
        {
          id: 't1',
          moveInDate: '2024-01-01',
          fixedDate: '2024-01-05',
          depositAmount: 50_000_000,
          demandedDistribution: true,
          demandedDistributionDate: '2024-04-01',
        },
      ],
      region: 'SEOUL',
      distributionDemandDeadline: '2024-06-01',
    });

    expect(result.distribution).toBeNull();
    expect(result.tenantClassifications[0]?.status).toBe('NEEDS_REVIEW');
  });

  it('saleAmount를 입력하면 총 부담액(입찰가+인수보증금)을 계산한다', () => {
    const result = service.analyze({
      registeredRights: [{ id: 'r1', type: 'MORTGAGE', receivedDate: '2024-03-10' }],
      tenants: [
        {
          id: 't1',
          moveInDate: '2024-01-01',
          fixedDate: null,
          depositAmount: 50_000_000,
          demandedDistribution: false,
          demandedDistributionDate: null,
        },
      ],
      region: 'SEOUL',
      distributionDemandDeadline: '2024-06-01',
      saleAmount: 300_000_000,
    });

    expect(result.totalBurden).toEqual({
      bidPrice: 300_000_000,
      totalAssumedAmount: 50_000_000,
      totalBurden: 350_000_000,
      ruleId: 'TOTAL_BURDEN',
      ruleVersion: 1,
    });
  });
});
