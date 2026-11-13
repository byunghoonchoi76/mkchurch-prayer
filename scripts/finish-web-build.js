/**
 * 웹 빌드 마무리 스크립트.
 *
 * Expo 의 SPA(single) 출력은 index.html 을 기본 틀로 만들기 때문에
 * 홈 화면에 추가했을 때 앱처럼 뜨게 하는 태그가 들어가지 않습니다.
 * 여기서 그 태그들을 넣고, 정적 호스팅에 필요한 파일도 함께 만듭니다.
 *
 *   node scripts/finish-web-build.js <출력폴더> [하위경로]
 */
const fs = require('fs');
const path = require('path');

const outDir = process.argv[2] ?? 'dist';
// 하위 경로 배포(예: GitHub Pages 의 /first-repository)를 두 번째 인자나 환경변수로 받습니다.
const base = (process.argv[3] ?? process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
const indexPath = path.join(outDir, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error(`[web] ${indexPath} 가 없습니다. 먼저 expo export 를 실행하세요.`);
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf8');

// 한국어 문서로 표시
html = html.replace('<html lang="en">', '<html lang="ko">');

// 노치 영역까지 화면을 쓰도록
html = html.replace(
  'content="width=device-width, initial-scale=1, shrink-to-fit=no"',
  'content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"',
);

const tags = [
  `<link rel="manifest" href="${base}/manifest.json" />`,
  // 한글 UI 폰트(Noto Sans KR) — 한국어·영문·숫자를 통일감 있게 렌더합니다.
  `<link rel="preconnect" href="https://fonts.googleapis.com" />`,
  `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />`,
  `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&display=swap" />`,
  `<meta name="theme-color" content="#104C6E" />`,
  `<meta name="apple-mobile-web-app-capable" content="yes" />`,
  `<meta name="mobile-web-app-capable" content="yes" />`,
  `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`,
  `<meta name="apple-mobile-web-app-title" content="기도" />`,
  `<link rel="apple-touch-icon" href="${base}/app-icon.png" />`,
  `<meta name="description" content="목양교회 기도 앱 — 기도 타이머·기록·기도제목·알림" />`,
].join('\n    ');

if (!html.includes('rel="manifest"')) {
  html = html.replace('</head>', `  ${tags}\n  </head>`);
}

fs.writeFileSync(indexPath, html);

// 정적 호스팅에서 새로고침·딥링크가 되도록 하는 SPA 폴백
fs.copyFileSync(indexPath, path.join(outDir, '404.html'));

// 공개 페이지(약관·방침·계정삭제 등)는 직접 주소로 열어도 HTTP 200을 반환해야 합니다.
// 단일 출력(SPA)은 해당 경로에 실제 파일이 없어 GitHub Pages가 404.html을 "404 상태"로
// 내려주는데, 구글 플레이의 데이터 보안 URL 검사처럼 상태코드를 확인하는 곳에서 걸립니다.
// 그래서 각 공개 경로에 index.html 복사본(<route>.html)을 두어 200으로 응답하게 합니다.
// (브라우저에서 열리면 같은 앱이 로드되어 URL에 맞는 화면으로 라우팅됩니다.)
const PUBLIC_HTML_ROUTES = ['privacy', 'terms', 'email-refusal', 'account-deletion', 'display'];
for (const route of PUBLIC_HTML_ROUTES) {
  fs.copyFileSync(indexPath, path.join(outDir, `${route}.html`));
}

// _expo 처럼 밑줄로 시작하는 폴더가 무시되지 않도록 (GitHub Pages)
fs.writeFileSync(path.join(outDir, '.nojekyll'), '');

// 서비스워커에 이번 빌드의 고유 버전을 심습니다.
// 이렇게 해야 sw.js 내용이 배포마다 달라져 브라우저가 새 서비스워커를 설치하고,
// 열려 있던 앱이 자동으로 한 번 새로고침되어 최신 코드를 받습니다.
const swPath = path.join(outDir, 'sw.js');
if (fs.existsSync(swPath)) {
  const buildId = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14); // 예: 20260930071530
  let sw = fs.readFileSync(swPath, 'utf8');
  sw = sw.replace(/__BUILD_ID__/g, buildId);
  fs.writeFileSync(swPath, sw);
  console.log(`[web] ${outDir}: PWA 태그 삽입 · 404.html · .nojekyll · sw.js(build ${buildId}) 생성 완료`);
} else {
  console.log(`[web] ${outDir}: PWA 태그 삽입 · 404.html · .nojekyll 생성 완료 (sw.js 없음)`);
}
