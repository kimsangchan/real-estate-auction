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

    expect(result.totalBurden).toMatchObject({
      bidPrice: 300_000_000,
      totalAssumedAmount: 50_000_000,
      totalBurden: 350_000_000,
      unknownItems: ['UNPAID_MAINTENANCE_FEE'],
      ruleId: 'TOTAL_BURDEN',
      ruleVersion: 2,
    });
    // 인수액이 남는 임차인 → 명도 전망은 손실 측(2백만~7백만) 구간이다
    const eviction = result.totalBurden?.extras.find((e) => e.kind === 'EVICTION_COST');
    expect(eviction?.range).toEqual({ min: 2_000_000, max: 7_000_000 });
    // 확정 합계 + 취득세(주택여부 미상 1.1%~13.4%) + 등기(0.5%~1.5%) + 명도
    expect(result.totalBurden?.totalWithExtras).toEqual({ min: 356_800_000, max: 401_700_000 });
  });

  it('임차인이 없으면 명도 전망은 점유자 없음 구간이다', () => {
    const result = service.analyze({
      registeredRights: [{ id: 'r1', type: 'MORTGAGE', receivedDate: '2024-03-10' }],
      tenants: [],
      region: 'SEOUL',
      distributionDemandDeadline: '2024-06-01',
      saleAmount: 100_000_000,
      propertyKind: 'NON_HOUSING',
    });

    const eviction = result.totalBurden?.extras.find((e) => e.kind === 'EVICTION_COST');
    expect(eviction?.range).toEqual({ min: 0, max: 1_500_000 });
    // 비주택은 취득세 구간이 4.6% 한 점으로 좁혀진다
    const acquisition = result.totalBurden?.extras.find((e) => e.kind === 'ACQUISITION_TAX');
    expect(acquisition?.range).toEqual({ min: 4_600_000, max: 4_600_000 });
  });

  it('배당으로 보증금을 전액 회수하는 임차인이면 명도 전망이 중간 구간으로 내려온다', () => {
    // 후순위(전입이 말소기준보다 늦음) 소액 아님 임차인 — 확정일자·배당요구 유효, 재원 충분
    const result = service.analyze({
      registeredRights: [{ id: 'r1', type: 'MORTGAGE', receivedDate: '2024-03-10' }],
      tenants: [
        {
          id: 't1',
          moveInDate: '2024-04-01',
          fixedDate: '2024-04-01',
          depositAmount: 50_000_000,
          demandedDistribution: true,
          demandedDistributionDate: '2024-05-01',
        },
      ],
      region: 'SEOUL',
      distributionDemandDeadline: '2024-06-01',
      saleAmount: 300_000_000,
    });

    expect(result.tenantClassifications[0]?.assumedAmount).toBe(0);
    const eviction = result.totalBurden?.extras.find((e) => e.kind === 'EVICTION_COST');
    expect(eviction?.range).toEqual({ min: 500_000, max: 3_000_000 });
  });

  it('소멸했지만 배당으로 보증금을 다 못 받는 임차인은 손실 측 명도 구간이다', () => {
    // 후순위 임차인 — 인수액은 0(소멸)이지만 근저당이 재원을 다 가져가 배당을 못 받는다.
    // 보증금 2억은 서울 소액임차인 범위 밖이라 최우선변제도 없다
    const result = service.analyze({
      registeredRights: [
        { id: 'r1', type: 'MORTGAGE', receivedDate: '2024-03-10', amount: 300_000_000 },
      ],
      tenants: [
        {
          id: 't1',
          moveInDate: '2024-04-01',
          fixedDate: '2024-04-01',
          depositAmount: 200_000_000,
          demandedDistribution: true,
          demandedDistributionDate: '2024-05-01',
        },
      ],
      region: 'SEOUL',
      distributionDemandDeadline: '2024-06-01',
      saleAmount: 200_000_000,
    });

    expect(result.tenantClassifications[0]?.assumedAmount).toBe(0);
    const eviction = result.totalBurden?.extras.find((e) => e.kind === 'EVICTION_COST');
    expect(eviction?.range).toEqual({ min: 2_000_000, max: 7_000_000 });
  });
});
