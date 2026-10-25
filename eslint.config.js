// Expo 기본 ESLint 설정 (flat config).
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    // 앱 소스가 아닌 것들은 린트에서 제외합니다.
    //  · supabase/functions: Deno 런타임(npm: 지정자)
    //  · docs, scripts: 빌드·문서용 Node 스크립트
    //  · dist*, .expo: 빌드 산출물
    ignores: [
      'dist/*',
      'dist-pages/*',
      '.expo/*',
      'node_modules/*',
      'supabase/functions/**',
      'docs/**',
      'scripts/**',
    ],
  },
  {
    // react-hooks v6 에서 새로 추가된 엄격 규칙들은 '버그'가 아닌 패턴까지
    // 잡습니다. 기존 코드와의 호환을 위해 경고로 낮춥니다(새 오류만 차단).
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
];
