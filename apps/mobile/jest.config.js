// pnpm은 모든 패키지를 node_modules/.pnpm/<pkg>@<hash>/node_modules/<pkg> 심링크로 배치한다.
// @react-native/jest-preset의 기본 transformIgnorePatterns는 이 중첩 구조를 고려하지 않아
// react-native 자신도 변환 대상에서 잘못 제외되는 문제가 있어 .pnpm 경로에 맞게 다시 정의한다.
module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    // 긴 패키지명은 pnpm이 `<pkg>_<hash>`로 축약하므로 구분자에 `_`도 포함한다.
    // @noble/hashes(PKCE 해시)는 ESM으로 배포돼 변환 대상에 포함해야 한다.
    '/node_modules/\\.pnpm/(?!((jest-)?react-native|@react-native(-community|-async-storage|-firebase)?|@noble)[@+_])',
  ],
  // 병렬 워커 부하 시 화면 첫 렌더(트랜스폼 콜드스타트)가 기본 5초를 넘겨 플레이키해짐 — 실측 기반 상향.
  testTimeout: 15000,
};
