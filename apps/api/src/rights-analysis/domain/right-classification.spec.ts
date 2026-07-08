import { classifyRegisteredRight, classifyUnregisteredRisk } from './right-classification';
import type { RegisteredRight, UnregisteredRisk } from './types';

const BASELINE_DATE = '2024-03-01';

describe('classifyRegisteredRight', () => {
  it.each(['MORTGAGE', 'SEIZURE', 'PROVISIONAL_SEIZURE', 'COLLATERAL_PROVISIONAL_REGISTRATION', 'AUCTION_COMMENCEMENT'] as const)(
    '%s는 말소기준보다 선순위여도 매각으로 항상 말소된다',
    (type) => {
      const right: RegisteredRight = { id: 'r1', type, receivedDate: '2024-01-01' };

      expect(classifyRegisteredRight(right, BASELINE_DATE).status).toBe('EXTINGUISHED');
    },
  );

  it.each(['SUPERFICIES', 'EASEMENT', 'PROVISIONAL_REGISTRATION', 'PROVISIONAL_DISPOSITION', 'LEASEHOLD'] as const)(
    '%s는 말소기준보다 선순위면 인수된다',
    (type) => {
      const right: RegisteredRight = { id: 'r1', type, receivedDate: '2024-01-01' };

      expect(classifyRegisteredRight(right, BASELINE_DATE).status).toBe('ASSUMED');
    },
  );

  it.each(['SUPERFICIES', 'EASEMENT', 'PROVISIONAL_REGISTRATION', 'PROVISIONAL_DISPOSITION', 'LEASEHOLD'] as const)(
    '%s는 말소기준보다 후순위면 말소된다',
    (type) => {
      const right: RegisteredRight = { id: 'r1', type, receivedDate: '2024-06-01' };

      expect(classifyRegisteredRight(right, BASELINE_DATE).status).toBe('EXTINGUISHED');
    },
  );

  it('말소기준 권리 자신은 말소로 분류된다 (접수일이 말소기준일과 같음)', () => {
    const right: RegisteredRight = { id: 'r1', type: 'LEASEHOLD', receivedDate: BASELINE_DATE };

    expect(classifyRegisteredRight(right, BASELINE_DATE).status).toBe('EXTINGUISHED');
  });

  it('ruleId·ruleVersion을 판정 결과에 포함한다', () => {
    const right: RegisteredRight = { id: 'r1', type: 'MORTGAGE', receivedDate: '2024-01-01' };

    const result = classifyRegisteredRight(right, BASELINE_DATE);

    expect(result.ruleId).toBe('RIGHT_CLASSIFICATION');
    expect(result.ruleVersion).toBe(1);
  });
});

describe('classifyUnregisteredRisk', () => {
  it.each(['LIEN', 'STATUTORY_SUPERFICIES', 'GRAVE_BASE_RIGHT'] as const)(
    '%s는 등기부 외 권리라 항상 NEEDS_REVIEW로 분류된다',
    (type) => {
      const risk: UnregisteredRisk = { id: 'u1', type };

      const result = classifyUnregisteredRisk(risk);

      expect(result.status).toBe('NEEDS_REVIEW');
      expect(result.ruleId).toBe('UNREGISTERED_RISK_FLAG');
    },
  );
});
