import {
  AmbiguousAddressCandidateError,
  UnsupportedTwoWayMethodError,
  buildTwoWayContinuationRequest,
  isTwoWayContinuation,
  resolveSingleAddressCandidate,
  type CodefTwoWayContinuation,
} from './codef-two-way';

const CONTINUATION: CodefTwoWayContinuation = {
  continue2Way: true,
  method: '추가인증방식',
  jobIndex: 0,
  threadIndex: 0,
  jti: 'jti-1',
  twoWayTimestamp: '1699999999999',
  extraInfo: {
    resAddrList: [
      { resUserNm: '', commUniqueNo: '1234-5678', commAddrLotNumber: '', resState: '', resType: '' },
    ],
  },
};

describe('isTwoWayContinuation', () => {
  it('continue2Way가 true인 데이터를 감지한다', () => {
    expect(isTwoWayContinuation(CONTINUATION)).toBe(true);
  });

  it('일반 최종 응답은 2-Way로 감지하지 않는다', () => {
    expect(isTwoWayContinuation({ commIssueCode: '', resRegisterEntriesList: [] })).toBe(false);
    expect(isTwoWayContinuation(null)).toBe(false);
  });
});

describe('resolveSingleAddressCandidate', () => {
  it('후보가 정확히 1건이면 그 고유번호를 반환한다', () => {
    expect(resolveSingleAddressCandidate(CONTINUATION)).toBe('1234-5678');
  });

  it('후보가 여러 건이면 AmbiguousAddressCandidateError를 던진다', () => {
    const multi: CodefTwoWayContinuation = {
      ...CONTINUATION,
      extraInfo: {
        resAddrList: [
          { resUserNm: '', commUniqueNo: 'a', commAddrLotNumber: '', resState: '', resType: '' },
          { resUserNm: '', commUniqueNo: 'b', commAddrLotNumber: '', resState: '', resType: '' },
        ],
      },
    };

    expect(() => resolveSingleAddressCandidate(multi)).toThrow(AmbiguousAddressCandidateError);
  });

  it('후보가 없으면 UnsupportedTwoWayMethodError를 던진다', () => {
    const none: CodefTwoWayContinuation = { ...CONTINUATION, extraInfo: { resAddrList: [] } };

    expect(() => resolveSingleAddressCandidate(none)).toThrow(UnsupportedTwoWayMethodError);
  });
});

describe('buildTwoWayContinuationRequest', () => {
  it('원본 요청에 uniqueNo·is2Way·twoWayInfo를 덧붙인다', () => {
    const original = { organization: '0002', addr_sido: '서울특별시' };

    const next = buildTwoWayContinuationRequest(original, CONTINUATION, '1234-5678');

    expect(next).toEqual({
      organization: '0002',
      addr_sido: '서울특별시',
      uniqueNo: '1234-5678',
      is2Way: true,
      twoWayInfo: {
        jobIndex: 0,
        threadIndex: 0,
        jti: 'jti-1',
        twoWayTimestamp: '1699999999999',
      },
    });
  });
});
