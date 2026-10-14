/**
 * Expo 기본 바벨 설정.
 * 이 파일이 있어야 babel-preset-expo 가 적용되어
 * EXPO_PUBLIC_* 환경변수(.env 의 Supabase 주소·키 등)가 웹 번들에 포함됩니다.
 * (이 파일이 없으면 값이 들어가지 않아 앱이 샘플 모드로만 동작합니다.)
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
