import { parseAuthCallbackCode } from './deepLink';

describe('parseAuthCallbackCode', () => {
  it('콜백 딥링크에서 교환 코드를 뽑아낸다', () => {
    expect(parseAuthCallbackCode('auction://auth/callback?code=abc.def')).toBe(
      'abc.def',
    );
  });

  it('URL 인코딩된 코드를 디코딩한다', () => {
    expect(
      parseAuthCallbackCode('auction://auth/callback?code=a%2Bb%3Dc'),
    ).toBe('a+b=c');
  });

  it('다른 쿼리가 섞여 있어도 code만 읽는다', () => {
    expect(
      parseAuthCallbackCode('auction://auth/callback?state=x&code=abc&y=1'),
    ).toBe('abc');
  });

  it('우리 콜백이 아닌 딥링크는 무시한다', () => {
    expect(parseAuthCallbackCode('auction://other?code=abc')).toBeNull();
    expect(parseAuthCallbackCode('https://example.com?code=abc')).toBeNull();
  });

  it('경계값: code가 없거나 비어 있으면 null이다', () => {
    expect(parseAuthCallbackCode('auction://auth/callback')).toBeNull();
    expect(parseAuthCallbackCode('auction://auth/callback?state=x')).toBeNull();
    expect(parseAuthCallbackCode('auction://auth/callback?code=')).toBeNull();
    expect(parseAuthCallbackCode(null)).toBeNull();
  });
});
