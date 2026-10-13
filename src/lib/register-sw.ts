import { Platform } from 'react-native';

/**
 * 웹(PWA) 자동 갱신.
 * - 앱 시작 시 서비스워커를 등록합니다(알림을 켜지 않은 사용자도 포함).
 * - 서비스워커가 HTML을 '네트워크 우선'으로 받으므로, 다음에 앱을 열면 늘 최신 화면이 뜹니다.
 * - 사용 중에 새 버전이 배포되면, 새 서비스워커가 제어권을 넘겨받는 순간 화면을 한 번만 새로고침합니다.
 * - 앱을 다시 열거나 포커스할 때 새 버전이 있는지 확인합니다.
 */
let reloaded = false;

function basePath(): string {
  if (typeof location === 'undefined') return '';
  return location.pathname.startsWith('/mkchurch-prayer') ? '/mkchurch-prayer' : '';
}

export function registerServiceWorker(): void {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const url = `${basePath()}/sw.js`;
  const scope = `${basePath()}/`;

  // 등록 시점에 이미 제어 중인 서비스워커가 있었는지 기록해 둡니다.
  // (처음 설치되는 경우엔 새로고침이 필요 없고, '업데이트'일 때만 새로고침합니다.)
  const hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });

  const run = async () => {
    try {
      const reg = await navigator.serviceWorker.register(url, { scope });
      const check = () => {
        reg.update().catch(() => {});
      };
      // 앱을 다시 열거나 화면으로 돌아올 때 새 버전 확인
      window.addEventListener('focus', check);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) check();
      });
    } catch (_e) {
      // 등록 실패는 앱 동작에 영향이 없으므로 조용히 무시합니다.
    }
  };

  // 첫 화면 로딩 속도에 영향을 주지 않도록 로드 이후에 등록합니다.
  if (document.readyState === 'complete') void run();
  else window.addEventListener('load', () => void run());
}
