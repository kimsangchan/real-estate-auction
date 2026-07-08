import {
  CODEF_SUCCESS_CODE,
  CodefBusinessError,
  CodefTransientError,
  classifyCodefHttpStatus,
  classifyCodefResult,
  classifyCodefTransportError,
} from './codef-errors';

describe('classifyCodefTransportError', () => {
  it('네트워크 오류를 재시도 가능한 CodefTransientError로 감싼다', () => {
    const error = classifyCodefTransportError(new Error('ECONNRESET'));

    expect(error).toBeInstanceOf(CodefTransientError);
    expect(error.message).toContain('ECONNRESET');
  });
});

describe('classifyCodefHttpStatus', () => {
  it('5xx는 재시도 가능한 오류로 분류한다', () => {
    expect(classifyCodefHttpStatus(500)).toBeInstanceOf(CodefTransientError);
    expect(classifyCodefHttpStatus(503)).toBeInstanceOf(CodefTransientError);
  });

  it('2xx/4xx는 전송 계층 오류가 아니다', () => {
    expect(classifyCodefHttpStatus(200)).toBeNull();
    expect(classifyCodefHttpStatus(404)).toBeNull();
  });
});

describe('classifyCodefResult', () => {
  it('성공 코드는 오류가 아니다', () => {
    expect(classifyCodefResult({ code: CODEF_SUCCESS_CODE, message: 'ok' })).toBeNull();
  });

  it('실패 코드는 CodefBusinessError로 분류하고 코드·transactionId를 보존한다', () => {
    const error = classifyCodefResult({
      code: 'CF-09002',
      message: 'organization을 올바르게 입력했는지 확인하세요.',
      transactionId: 'tx-1',
    });

    expect(error).toBeInstanceOf(CodefBusinessError);
    expect((error as CodefBusinessError).code).toBe('CF-09002');
    expect((error as CodefBusinessError).transactionId).toBe('tx-1');
  });
});
