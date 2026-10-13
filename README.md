# 교회 앱 (Church App)

주보·공지·설교·기도·소그룹을 한 곳에서 볼 수 있는 교회 공동체 앱입니다.
**Expo(React Native)** 한 코드베이스로 **iOS · Android · 웹**을 모두 지원합니다.

> 📘 **교인·관리자용 사용설명서**: [`docs/사용설명서.md`](docs/사용설명서.md)
> 📊 **개발 보고서(변경 내역)**: [`docs/보고서.md`](docs/보고서.md)
> 🌐 **배포 주소**: https://byunghoonchoi76.github.io/first-repository/

## 무엇이 들어 있나요

| 화면 | 내용 |
| --- | --- |
| 홈 | 오늘의 말씀(매일 순환), 빠른 메뉴, 이번 주 예배, **실시간 예배 LIVE 배지**, 나의 기도 요약, 최근 소식·설교 |
| 주보 | 지난 주보 목록과 상세(예배 순서·광고·원본 이미지). 관리자는 사진 업로드·수정·삭제 |
| 소식 | 공지 / 행사 / 소식 분류, 상단 고정, 상세 보기 |
| 설교 | 시리즈·쇼츠별 목록(유튜브 썸네일·제목 자동), 상세에서 앱 안 바로 재생 (쇼츠는 세로 화면) |
| 기도 | 기도 타이머(정확한 분 단위), 개인/공동 분리, 달성률 게이지·월 달력·10일 평균 그래프, 기도제목 나눔(익명 가능)과 '함께 기도', 응답 표시 |
| 기도 알림 | 정한 요일·시간에 "기도할 시간이에요" 웹 푸시 알림 (기기별 설정, 테스트 버튼) |
| 소그룹 | 소그룹 목록과 소통방(채팅) |
| 교회 안내 | 예배 안내·섬기는 사람들·교회 장소·새가족 등록·헌금 안내로 묶은 메뉴 |
| 더보기 | 로그인/로그아웃, 교회 정보(전화·지도·이메일·유튜브 채널 바로 연결), 데이터 모드 |
| 관리자 | 주보·공지·설교·소그룹·공동 기도제목 등록/수정/삭제, 실시간 배지 수동 제어 (관리자 계정만) |

## 바로 실행하기

```bash
npm install
npm start          # QR 코드로 Expo Go 에서 열기
npm run web        # 브라우저에서 열기
npm run ios        # iOS 시뮬레이터 (macOS)
npm run android    # Android 에뮬레이터
```

설치 직후에는 **샘플 데이터 모드**로 동작하므로 서버 없이 모든 화면을 바로 볼 수 있습니다.
관리자 화면을 보려면 더보기 → 로그인 → 이름 입력 후 **관리자로 시작**을 누르세요.
주보는 관리자 화면에서 매주 등록할 수 있습니다. 예배 순서와 광고는 줄 단위로 추가·삭제되며,
가장 최근 예배 날짜의 주보가 홈 화면에 표시됩니다.
교회가 주보를 이미지(JPG)나 PDF로 만들어 홈페이지에 올린다면, 그 주소를 '주보 원본' 에 넣으면
앱에서 원본을 그대로 볼 수 있습니다 (이미지는 앱 안에서 바로, PDF 는 열기 버튼으로).
샘플 모드에서 추가·수정한 내용은 그 기기에만 저장됩니다(더보기 → 샘플 데이터 초기화로 되돌릴 수 있습니다).

## 실제 데이터 연결하기 (Supabase)

샘플 모드는 각자의 기기에만 저장되어, 한 성도가 올린 기도제목이 다른 성도에게 보이지 않습니다.
공동체가 함께 쓰려면 Supabase(무료 플랜으로 충분)를 연결합니다.

1. **프로젝트 만들기** — [supabase.com](https://supabase.com) 가입 → New project.
   Region 은 `Northeast Asia (Seoul)` 을 고르면 국내에서 가장 빠릅니다.
   데이터베이스 비밀번호는 따로 보관해 두세요.

2. **표 만들기** — 왼쪽 메뉴 **SQL Editor** → New query →
   `supabase/schema.sql` 전체를 붙여넣고 **Run**.
   이어서 `supabase/seed.sql` 도 같은 방법으로 실행하면 교회 정보·예배 시간·주보·설교가 들어갑니다.
   (두 파일 모두 여러 번 실행해도 안전하도록 되어 있습니다.)

3. **키 확인** — 왼쪽 메뉴 **Project Settings → API** 에서 두 값을 복사합니다.
   - `Project URL`
   - `anon` `public` 키 (공개용 키입니다. 실제 보호는 아래 RLS 정책이 합니다)

4. **앱에 연결** — 프로젝트 폴더에서

   ```bash
   cp .env.example .env
   # EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   # EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

   개발 서버를 다시 시작하면 자동으로 Supabase 모드로 바뀝니다.
   더보기 → 앱 정보에서 현재 모드를 확인할 수 있습니다.

   > `.env` 를 만들거나 고친 뒤 빌드할 때는 캐시를 지워야 값이 반영됩니다.
   > `npx expo export --platform web --clear`

6. **주보 사진 저장소** — 관리자가 앱에서 주보 사진을 바로 올리려면
   `supabase/storage.sql` 을 SQL Editor 에서 실행합니다.
   `bulletins` 버킷(공개 읽기)을 만들고, 올리고 지우는 것은 관리자만 가능하도록 정책을 겁니다.

7. **로그인 주소 설정** — Supabase 대시보드 **Authentication → URL Configuration** 에서
   Site URL 을 앱 주소(예: `https://<계정>.github.io/first-repository/`)로 지정합니다.
   그러지 않으면 가입 확인 메일의 링크가 엉뚱한 주소로 연결됩니다.
   확인 메일 절차를 건너뛰려면 **Authentication → Providers → Email** 에서 Confirm email 을 끄면 됩니다.

5. **관리자 지정** — `supabase/create-admin.sql` 을 참고하세요.
   가장 간단한 방법은 대시보드 **Authentication → Users → Add user** 로 계정을 만들고
   ("Auto Confirm User" 를 켜면 확인 메일이 필요 없습니다), SQL Editor 에서 아래를 실행하는 것입니다.

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = '관리자이메일@example.com');
   ```

### 권한 정리 (schema.sql 의 RLS 정책)

| 대상 | 읽기 | 쓰기 |
| --- | --- | --- |
| 교회 정보 · 예배 시간 · 주보 · 공지 · 설교 · 소그룹 | 누구나 | 관리자만 |
| 기도제목 | 누구나 | 로그인한 성도(수정·삭제는 본인 또는 관리자) |
| 소그룹 대화 | 로그인한 성도 | 로그인한 성도(삭제는 본인 또는 관리자) |
| 프로필 | 본인·관리자 | 본인 |

anon 키는 앱에 그대로 들어가는 공개 키이므로, 실제 보호는 위 정책이 담당합니다.
정책을 고치면 즉시 모든 사용자에게 적용됩니다.

## 기도 알림 (웹 푸시) 설정

정한 요일·시간에 기도 알림을 보내는 기능입니다. Supabase에서 세 단계로 설정합니다.

1. **테이블** — `supabase/schema.sql`(또는 `migrate-latest.sql`)의 `push_subscriptions` 블록 실행.
2. **함수 배포** — `supabase/functions/send-reminders/index.ts` 를 Edge Functions로 배포합니다.
   - **Verify JWT 는 OFF** 로 둡니다(cron이 부를 내부 함수).
   - 시크릿 등록: `VAPID_PUBLIC`, `VAPID_PRIVATE` (공개키는 `src/lib/reminders.ts` 의 값과 동일).
3. **스케줄** — `supabase/cron-reminders.sql` 을 SQL Editor에서 실행해 매분 호출을 등록합니다.
   - 함수 호출 시 **`apikey` 헤더에 publishable 키**(`sb_publishable_…`)를 넣습니다(신규 API 키 체계).

> 클라이언트는 `src/lib/reminders.ts`(구독·저장)와 `src/app/reminders.tsx`(설정 화면),
> `public/sw.js`(서비스워커: 알림 표시)로 구성됩니다.
> 아이폰은 **사파리 → 홈 화면에 추가**로 설치한 PWA에서만 알림을 받습니다(iOS 16.4+).

## 실시간 예배 배지 (선택)

교회 유튜브 라이브 상태를 감지해 홈에 LIVE 배지를 표시합니다.
`supabase/functions/live-status` 를 배포하고(선택적으로 `YOUTUBE_API_KEY` 시크릿 등록),
`app_settings.live_override` 로 관리자가 강제 ON/OFF 할 수 있습니다.

## 배포

**웹** — 정적 파일로 내보낸 뒤 아무 정적 호스팅(Vercel, Netlify, Cloudflare Pages 등)에 올리면 됩니다.

```bash
npm run build:web   # dist/ 생성 (PWA 태그·404.html·.nojekyll 포함)
```

휴대폰 브라우저에서 열고 '홈 화면에 추가' 하면 아이콘이 생기고 주소창 없이 앱처럼 실행됩니다.

`app.json` 의 `web.output` 은 `single`(SPA)입니다. 모든 경로를 `index.html` 로 보내는
SPA 리라이트 설정이 필요하며, 대부분의 호스팅은 기본으로 지원합니다.
공지 페이지의 검색 노출(SEO)이 필요하면 `static` 으로 바꿔 사전 렌더링할 수 있습니다.

**GitHub Pages 로 올리기** — 하위 경로(`/first-repository`)로 서비스되므로 baseUrl 을 붙여 빌드합니다.

`npm run build:pages` 는 빌드 후 `scripts/finish-web-build.js` 를 실행해
PWA 태그(홈 화면 추가 시 앱처럼 실행), `404.html`(새로고침·딥링크 폴백),
`.nojekyll` 까지 자동으로 만들어 줍니다.

```bash
npm run build:pages                 # dist-pages/ 생성

# gh-pages 브랜치에 결과물만 올립니다 (소스는 개발 브랜치에 그대로 둡니다)
git worktree add --detach /tmp/ghpages
cd /tmp/ghpages && git checkout gh-pages && git rm -rf . -q
cp -a /경로/first-repository/dist-pages/. .
git add -A && git commit -m "웹 빌드 갱신" && git push origin gh-pages
```

저장소 Settings → Pages 에서 Source 를 `gh-pages` 브랜치 `/ (root)` 로 지정하면
`https://<계정>.github.io/first-repository/` 에서 열립니다.

**앱스토어 / 플레이스토어** — [EAS Build](https://docs.expo.dev/build/introduction/) 를 사용합니다.
빌드 설정(`eas.json`)은 저장소에 들어 있고, 프로필은 세 가지입니다.

| 프로필 | 결과물 | 쓰임 |
| --- | --- | --- |
| `preview` | Android APK / iOS 내부 배포 | 링크로 받아 바로 설치해 보는 시험판 |
| `production` | Android AAB / iOS IPA | 스토어 제출용 |
| `development` | 개발 클라이언트 | 네이티브 모듈까지 붙여 개발할 때 |

```bash
npm install -g eas-cli
eas login                       # 무료 Expo 계정 필요
eas init                        # 최초 1회, app.json 에 프로젝트 ID 가 기록됩니다

eas build --platform android --profile preview      # 설치용 APK (등록비 불필요)
eas build --platform android --profile production   # 플레이스토어 제출용
eas build --platform ios --profile production       # 앱스토어 제출용 (Apple 개발자 계정 필요)

eas submit --platform android   # 스토어 업로드
eas submit --platform ios
```

빌드는 Expo 서버에서 돌기 때문에 macOS 없이 iOS 빌드도 가능합니다.
앱 식별자는 `app.json` 의 `ios.bundleIdentifier` / `android.package`(`church.mokyang.guri`) 를 씁니다.

스토어에 올리기 전 준비물: 1024×1024 앱 아이콘, 개인정보처리방침 주소,
스크린샷, 앱 설명. Google Play 개발자 등록 $25(1회), Apple Developer Program $99/년입니다.

## 교회에 맞게 바꾸기

- `src/constants/church.ts` — 교회 이름, 표어, 담임목사, 주소, 연락처, 헌금 계좌
- `src/constants/theme.ts` — 따뜻한 베이지 팔레트 + 교회 CI 포인트색(`Brand`)과 히어로 그라데이션(`Gradients`)
- `src/constants/photos.ts` — 홈 배경 스톡 사진 주소(교회 사진으로 교체 가능)
- `src/constants/logo.ts` — 공식 CI 연결 지점. `assets/images/목양교회 CI.png` 에서 잘라낸
  `logo-mark.png`(심볼)와 `logo-white.png`(심볼+흰색 교회명)를 씁니다.
  더 큰 원본을 받으면 같은 이름으로 교체하면 앱 전체에 반영됩니다.
- `src/components/church-logo.tsx` — 로고 심볼과 로고+교회명 조합
- `src/lib/data/sample-data.ts` — 샘플 모드에서 보이는 주보·공지·설교·기도제목·소그룹
- `app.json` — 앱 이름, 아이콘, 스플래시 색상(CI 남색 `#14496B`)
- `assets/images/` — 아이콘·스플래시 이미지

## 폴더 구조

```
src/
├─ app/                     화면 (expo-router 파일 기반 라우팅)
│  ├─ (tabs)/               홈 · 소식 · 설교 · 기도 · 소그룹 탭
│  ├─ services.tsx          예배 안내 (예배 · 교육부서)
│  ├─ staff.tsx             섬기는 사람들 (교역자 · 직분자)
│  ├─ location.tsx          교회 주소 (지도 · 카카오맵/네이버지도/구글지도 길찾기)
│  ├─ new-family.tsx        새가족 등록 (방문자 신청, 관리자만 조회)
│  ├─ bulletins.tsx         주보 목록 (지난 주보 포함)
│  ├─ giving.tsx            헌금 안내 (계좌 복사 · 온라인 헌금 링크)
│  ├─ admin/                관리자 화면 (주보·공지·설교·소그룹 편집)
│  ├─ bulletin/[id].tsx     주보 상세
│  ├─ news/[id].tsx         공지 상세
│  ├─ sermons/[id].tsx      설교 상세
│  ├─ groups/[id].tsx       소그룹 소통방
│  ├─ prayer/               기도제목 나누기 · 개인 기도제목 · 기도 요청
│  ├─ reminders.tsx         기도 알림 설정 (요일·시간·테스트)
│  ├─ welcome.tsx           시작(표어) 화면
│  ├─ settings.tsx          더보기
│  └─ sign-in.tsx           로그인
├─ components/              화면 틀(Screen)과 공용 UI 조각
├─ constants/               교회 정보 · 디자인 토큰
├─ hooks/                   색상 모드 · 테마
└─ lib/
   ├─ auth.tsx              로그인 상태 (샘플 / Supabase 공용)
   ├─ prayer-log.ts         개인/공동 기도시간 기록 (기기·계정 저장)
   ├─ prayer-goal.ts        주간 기도 목표 (기기 저장)
   ├─ reminders.ts          기도 알림 구독·저장 (웹 푸시)
   ├─ live-status.ts        실시간 예배 감지 · 관리자 강제 스위치
   ├─ supabase.ts           Supabase 클라이언트
   └─ data/                 도메인 타입 + 샘플/Supabase 저장소
public/
└─ sw.js                    서비스워커 (기도 알림 표시)
supabase/
├─ schema.sql               테이블 · RLS 정책 · 트리거 (push_subscriptions 포함)
├─ seed.sql                 예시 데이터
├─ storage.sql              주보 사진 저장소(버킷 · 권한)
├─ cron-reminders.sql       기도 알림 매분 스케줄(pg_cron)
├─ create-admin.sql         관리자 계정 만들기 · 지정 · 삭제
└─ functions/
   ├─ send-reminders/       기도 알림 발송 함수 (매분 호출)
   └─ live-status/          실시간 예배 감지 함수
```

화면 코드는 `ChurchRepository` 인터페이스만 사용합니다. 샘플 저장소와 Supabase 저장소가
같은 인터페이스를 구현하므로, 환경변수만으로 백엔드를 갈아 끼울 수 있습니다.

## 다음에 붙이면 좋은 것들

- 새 공지·주보 등록 시 푸시 알림 확장(현재 웹 푸시는 기도 알림 전용)
- 소그룹 대화 실시간 반영(Supabase Realtime, 지금은 폴링)
- 온라인 헌금 연동, 출석 체크, 성경 읽기표
- 기도 시간 초 단위 기록(현재 분 단위)
