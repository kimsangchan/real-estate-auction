const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * pnpm은 의존성을 node_modules/.pnpm/<pkg>@<hash>/node_modules/<pkg> 심링크로 배치해서
 * Metro의 기본 리졸버가 @babel/runtime 같은 패키지를 못 찾는다 — 심링크 추적과 워크스페이스
 * 루트 감시를 명시적으로 켜서 해결한다.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [path.resolve(__dirname, '../..')],
  resolver: {
    unstable_enableSymlinks: true,
    unstable_enablePackageExports: true,
  },
};

module.exports = mergeConfig(defaultConfig, config);
