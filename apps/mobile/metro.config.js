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
 * 또한 워크스페이스 패키지(@auction/design-tokens)를 번들할 때 Metro가 babel 헬퍼
 * (@babel/runtime/*)를 그 패키지 폴더 기준으로만 찾아 실패하므로, 앱과 루트의 node_modules를
 * nodeModulesPaths에 추가해 어느 모듈에서든 해석되게 한다.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [path.resolve(__dirname, '../..')],
  resolver: {
    unstable_enableSymlinks: true,
    unstable_enablePackageExports: true,
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(__dirname, '../../node_modules'),
    ],
  },
};

module.exports = mergeConfig(defaultConfig, config);
