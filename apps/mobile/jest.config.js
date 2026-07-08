// pnpm은 모든 패키지를 node_modules/.pnpm/<pkg>@<hash>/node_modules/<pkg> 심링크로 배치한다.
// @react-native/jest-preset의 기본 transformIgnorePatterns는 이 중첩 구조를 고려하지 않아
// react-native 자신도 변환 대상에서 잘못 제외되는 문제가 있어 .pnpm 경로에 맞게 다시 정의한다.
module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    '/node_modules/\\.pnpm/(?!((jest-)?react-native|@react-native(-community)?)[@+])',
  ],
};
