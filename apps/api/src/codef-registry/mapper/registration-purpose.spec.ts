import { resolveRegistrationPurposeType } from './registration-purpose';

describe('resolveRegistrationPurposeType', () => {
  it.each([
    ['근저당권설정', 'MORTGAGE'],
    ['저당권설정', 'MORTGAGE'],
    ['가압류', 'PROVISIONAL_SEIZURE'],
    ['압류', 'SEIZURE'],
    ['담보가등기', 'COLLATERAL_PROVISIONAL_REGISTRATION'],
    ['경매개시결정', 'AUCTION_COMMENCEMENT'],
    ['전세권설정', 'LEASEHOLD'],
    ['지상권설정', 'SUPERFICIES'],
    ['지역권설정', 'EASEMENT'],
    ['가등기', 'PROVISIONAL_REGISTRATION'],
    ['가처분', 'PROVISIONAL_DISPOSITION'],
  ] as const)('%s는 %s로 매핑된다', (purpose, expected) => {
    expect(resolveRegistrationPurposeType(purpose)).toBe(expected);
  });

  it('담보가등기는 일반 가등기와 구분해서 매핑한다', () => {
    expect(resolveRegistrationPurposeType('담보가등기')).toBe('COLLATERAL_PROVISIONAL_REGISTRATION');
    expect(resolveRegistrationPurposeType('소유권이전청구권가등기')).toBe('PROVISIONAL_REGISTRATION');
  });

  it('말소 표시가 붙은 문구도 핵심 키워드로 매핑한다', () => {
    expect(resolveRegistrationPurposeType('1번근저당권설정등기말소')).toBe('MORTGAGE');
  });

  it('WP-03 범위 밖 등기목적(소유권이전 등)은 null을 반환한다', () => {
    expect(resolveRegistrationPurposeType('소유권이전')).toBeNull();
    expect(resolveRegistrationPurposeType('소유권보존')).toBeNull();
  });
});
