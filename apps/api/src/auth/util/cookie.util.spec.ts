import { expireCookie, parseCookies, serializeCookie } from './cookie.util';

describe('parseCookies', () => {
  it('여러 쿠키를 이름=값 맵으로 파싱한다', () => {
    expect(parseCookies('a=1; b=2; c=3')).toEqual({ a: '1', b: '2', c: '3' });
  });

  it('헤더가 없으면 빈 객체를 반환한다', () => {
    expect(parseCookies(undefined)).toEqual({});
  });

  it('URL 인코딩된 값을 디코딩한다', () => {
    expect(parseCookies('token=a%2Fb%3Dc')).toEqual({ token: 'a/b=c' });
  });

  it('=가 없는 조각은 무시한다', () => {
    expect(parseCookies('valid=1; malformed; another=2')).toEqual({ valid: '1', another: '2' });
  });
});

describe('serializeCookie', () => {
  it('기본 옵션으로 Path=/ 를 포함한다', () => {
    expect(serializeCookie('name', 'value')).toBe('name=value; Path=/');
  });

  it('httpOnly·secure·sameSite·maxAge를 모두 반영한다', () => {
    const result = serializeCookie('access_token', 'tok en', {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAgeSeconds: 900,
    });
    expect(result).toBe('access_token=tok%20en; Path=/; Max-Age=900; HttpOnly; Secure; SameSite=Lax');
  });

  it('경계값: 음수 maxAge는 0으로 클램프한다', () => {
    expect(serializeCookie('x', 'y', { maxAgeSeconds: -5 })).toContain('Max-Age=0');
  });
});

describe('expireCookie', () => {
  it('Max-Age=0으로 즉시 만료시키는 문자열을 만든다', () => {
    expect(expireCookie('oauth_state')).toBe('oauth_state=; Path=/; Max-Age=0');
  });
});
