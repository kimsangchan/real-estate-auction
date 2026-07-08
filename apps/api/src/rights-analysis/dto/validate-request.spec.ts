import { RightsAnalysisValidationError, validateRightsAnalysisRequest } from './validate-request';

const VALID_INPUT = {
  registeredRights: [{ id: 'r1', type: 'MORTGAGE', receivedDate: '2024-01-01' }],
  tenants: [],
  region: 'SEOUL',
  distributionDemandDeadline: '2024-06-01',
};

describe('validateRightsAnalysisRequest', () => {
  it('유효한 입력은 통과한다', () => {
    const result = validateRightsAnalysisRequest(VALID_INPUT);

    expect(result.region).toBe('SEOUL');
    expect(result.registeredRights).toHaveLength(1);
  });

  it('실패: 필수 필드(등기 권리 목록)가 없으면 초기 차단한다', () => {
    const inputWithoutRights = {
      tenants: VALID_INPUT.tenants,
      region: VALID_INPUT.region,
      distributionDemandDeadline: VALID_INPUT.distributionDemandDeadline,
    };

    expect(() => validateRightsAnalysisRequest(inputWithoutRights)).toThrow(RightsAnalysisValidationError);
  });

  it('실패: 등기 권리 목록이 비어 있으면 차단한다', () => {
    expect(() => validateRightsAnalysisRequest({ ...VALID_INPUT, registeredRights: [] })).toThrow(
      RightsAnalysisValidationError,
    );
  });

  it('실패: 잘못된 권리 타입은 차단한다', () => {
    expect(() =>
      validateRightsAnalysisRequest({
        ...VALID_INPUT,
        registeredRights: [{ id: 'r1', type: 'INVALID_TYPE', receivedDate: '2024-01-01' }],
      }),
    ).toThrow(RightsAnalysisValidationError);
  });

  it('실패: 날짜 형식이 잘못되면 차단한다', () => {
    expect(() =>
      validateRightsAnalysisRequest({ ...VALID_INPUT, distributionDemandDeadline: 'not-a-date' }),
    ).toThrow(RightsAnalysisValidationError);
  });

  it('실패: 화이트리스트에 없는 필드가 포함되면 차단한다', () => {
    expect(() => validateRightsAnalysisRequest({ ...VALID_INPUT, extraField: 'x' })).toThrow(
      RightsAnalysisValidationError,
    );
  });
});
