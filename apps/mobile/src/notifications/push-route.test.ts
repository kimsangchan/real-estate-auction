import { parseItemRoute } from './push-route';

const ROUTE = { courtOfficeCode: 'B000210', caseNo: '2025타경939', itemNo: '3' };

describe('parseItemRoute', () => {
  it('세 키가 모두 있으면 라우트로 읽는다', () => {
    expect(parseItemRoute(ROUTE)).toEqual(ROUTE);
  });

  it('다른 키가 섞여 있어도 사건키만 뽑는다', () => {
    expect(parseItemRoute({ ...ROUTE, kind: 'schedule-change' })).toEqual(ROUTE);
  });

  it('키가 하나라도 없으면 무시한다', () => {
    expect(parseItemRoute({ courtOfficeCode: 'B000210', caseNo: '2025타경939' })).toBeNull();
  });

  it('빈 문자열은 값이 없는 것으로 본다', () => {
    expect(parseItemRoute({ ...ROUTE, itemNo: '' })).toBeNull();
  });

  it('문자열이 아닌 값은 거부한다 (FCM data는 문자열만 담는다)', () => {
    expect(parseItemRoute({ ...ROUTE, itemNo: 3 })).toBeNull();
  });

  it('경계값: 페이로드가 없거나 객체가 아니면 null이다', () => {
    expect(parseItemRoute(undefined)).toBeNull();
    expect(parseItemRoute(null)).toBeNull();
    expect(parseItemRoute('B000210')).toBeNull();
  });
});
