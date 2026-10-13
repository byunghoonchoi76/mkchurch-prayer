/**
 * app.json 을 그대로 쓰되, 하위 경로로 배포할 때만 baseUrl 을 붙입니다.
 * 예) GitHub Pages: EXPO_BASE_URL=/first-repository npm run build:web
 * 값을 주지 않으면 지금까지처럼 루트 기준으로 빌드됩니다.
 */
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    baseUrl: process.env.EXPO_BASE_URL || undefined,
  },
});
