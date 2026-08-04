// 명세서 라벨 단위 테스트.
// 웹 사본과 어긋나지 않는지 검사하는 쪽은 apps/web(노드 기반 테스트 러너)에 있다 —
// RN tsconfig에는 Node 타입이 없어 여기서 파일을 읽을 수 없다.
import {
  assumedRightsLabel,
  riskFlagLabels,
  shortUsageName,
  tenantLabel,
} from './notice-labels';

describe('assumedRightsLabel', () => {
  it('명세서 코드를 한국어 라벨로 바꾼다', () => {
    expect(assumedRightsLabel('LEASEHOLD_REGISTRATION')).toBe('주택임차권등기');
    expect(assumedRightsLabel('NONE')).toBe('인수할 권리 없음');
  });

  it('명세서가 없으면 null — "인수할 권리 없음"과 다르다', () => {
    // 이 둘을 같게 표기하면 "확인 못 함"이 "위험 없음"으로 읽힌다
    expect(assumedRightsLabel(null)).toBeNull();
    expect(assumedRightsLabel('NONE')).not.toBeNull();
  });

  it('모르는 코드는 숨기지 않고 그대로 노출한다', () => {
    expect(assumedRightsLabel('NEW_KIND')).toBe('NEW_KIND');
  });
});

describe('riskFlagLabels', () => {
  it('코드 배열을 라벨 배열로 바꾼다', () => {
    expect(riskFlagLabels(['HUG_PRIORITY_WAIVER', 'LIEN_CLAIM'])).toEqual([
      'HUG 대항력포기 확약',
      '유치권 신고',
    ]);
    expect(riskFlagLabels([])).toEqual([]);
    expect(riskFlagLabels(['UNKNOWN_FLAG'])).toEqual(['UNKNOWN_FLAG']);
  });
});

describe('shortUsageName', () => {
  it('법원이 콤마로 묶어 보낸 용도에서 대표값만 남긴다', () => {
    expect(shortUsageName('연립주택,다세대,빌라')).toBe('연립주택');
    expect(shortUsageName('상가,오피스텔,근린시설')).toBe('상가');
    expect(shortUsageName('다세대')).toBe('다세대');
  });

  it('값이 없거나 비면 null', () => {
    expect(shortUsageName(null)).toBeNull();
    expect(shortUsageName('  ')).toBeNull();
  });
});

describe('tenantLabel', () => {
  it('0명과 미확인을 구분한다', () => {
    expect(tenantLabel(0)).toBe('점유자 없음');
    expect(tenantLabel(2)).toBe('점유자 2명');
    expect(tenantLabel(null)).toBeNull();
  });
});
