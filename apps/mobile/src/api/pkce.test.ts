import { createCodeChallenge, createCodeVerifier } from './pkce';

describe('PKCE', () => {
  it('RFC 7636 Appendix B의 시험 벡터와 같은 챌린지를 만든다', () => {
    expect(
      createCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    ).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('검증자는 서버가 받는 code_challenge 문자 집합·길이를 만족한다', () => {
    const verifier = createCodeVerifier();

    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);
    expect(createCodeChallenge(verifier)).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);
  });

  it('검증자는 호출마다 달라진다', () => {
    expect(createCodeVerifier()).not.toBe(createCodeVerifier());
  });
});
