/* 목양교회 앱 서비스워커 — 자동 갱신 + 웹 푸시(기도 알림) 처리 */

// 빌드마다 아래 값이 바뀝니다(finish-web-build.js 가 배포 시 치환).
// 이 파일의 내용이 배포마다 달라져야 브라우저가 새 서비스워커를 설치하고,
// 열려 있던 앱이 자동으로 한 번 새로고침되어 최신 코드를 받습니다.
const BUILD_ID = '__BUILD_ID__';

// 캐시 이름에 빌드 버전을 포함해, 배포마다 이전 캐시(옛 코드)를 정리합니다.
const CACHE = `mokyang-runtime-${BUILD_ID}`;

self.addEventListener('install', () => {
  // 새 서비스워커를 곧바로 대기 없이 활성화합니다.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 예전 버전 캐시 정리
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      // 이미 열려 있는 화면들도 이 서비스워커가 바로 제어하도록
      await self.clients.claim();
    })(),
  );
});

// 화면(HTML) 요청인지 판별
function isHtmlRequest(req) {
  if (req.mode === 'navigate') return true;
  const accept = req.headers.get('accept') || '';
  return accept.includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (_e) {
    return;
  }
  // 다른 도메인(예: 유튜브·Supabase) 요청은 건드리지 않습니다.
  if (url.origin !== self.location.origin) return;

  // 1) HTML(화면 틀)은 항상 '네트워크 우선' — 새 버전을 바로 받습니다.
  //    오프라인일 때만 캐시에 저장해 둔 마지막 화면을 보여줍니다.
  if (isHtmlRequest(req)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (_e) {
          const cached = await caches.match(req);
          return cached || (await caches.match('./index.html')) || Response.error();
        }
      })(),
    );
    return;
  }

  // 2) 그 밖의 같은 도메인 파일(자바스크립트·이미지 등)은
  //    'stale-while-revalidate' — 캐시로 빠르게 보여주고 뒤에서 최신본으로 갱신합니다.
  //    파일 이름에 해시가 붙어 배포마다 주소가 바뀌므로 항상 최신 코드가 로드됩니다.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});

// 서버(send-reminders 함수)가 보낸 푸시를 받아 알림을 띄웁니다.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = {};
  }
  const title = data.title || '기도할 시간이에요 🙏';
  const options = {
    body: data.body || '오늘도 기도로 하나님과 만나요.',
    icon: data.icon || './app-icon.png',
    badge: './app-icon.png',
    tag: data.tag || 'prayer-reminder',
    renotify: true,
    requireInteraction: true, // 사용자가 확인할 때까지 알림 유지
    vibrate: [300, 150, 300, 150, 300], // 진동 패턴
    data: { url: data.url || './' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// 알림을 누르면 앱을 엽니다(이미 열려 있으면 그 창으로).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    }),
  );
});
