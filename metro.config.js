const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // react-native-maps는 웹 미지원 — 웹 번들에서 빈 모듈로 대체
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return { type: 'empty' };
  }
  // react-native-svg의 "react-native" 필드가 TypeScript 소스를 직접 가리켜
  // Metro가 내부 타입 파일을 못 찾는 문제 — 컴파일된 출력으로 우회
  if (moduleName === 'react-native-svg') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'node_modules/react-native-svg/lib/commonjs/index.js'),
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
