/**
 * 화면 확인용 예시 데이터입니다. 실제 주보·공지·설교 내용으로 교체해 주세요.
 * (Supabase 를 연결하면 이 파일 대신 DB 의 내용이 표시됩니다.)
 */
import { ChurchInfo } from '@/constants/church';
import type {
  Announcement,
  Bulletin,
  ChurchProfile,
  CommunalPrayer,
  GroupMessage,
  PrayerRequest,
  Sermon,
  SmallGroup,
  StaffMember,
} from '@/lib/data/types';

/** 오늘 기준 상대 날짜를 만들어 샘플 데이터가 항상 '최근' 으로 보이게 합니다. */
function daysAgo(days: number): Date {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

const dateOnly = (days: number) => daysAgo(days).toISOString().slice(0, 10);
const dateTime = (days: number) => daysAgo(days).toISOString();

/** 가장 최근 지난 주일(일요일)까지의 일수 */
function daysSinceLastSunday(): number {
  const today = new Date().getDay();
  return today === 0 ? 0 : today;
}

const lastSunday = daysSinceLastSunday();

export const sampleChurchProfile: ChurchProfile = {
  ...ChurchInfo,
  serviceTimes: [
    { id: 'st-dawn', name: '새벽예배', schedule: '월~금 오전 5:30', place: '본당(3층)', category: '예배' },
    { id: 'st-sun-1', name: '주일예배 1부', schedule: '주일 오전 7:30', place: '본당(3층)', category: '예배' },
    { id: 'st-sun-2', name: '주일예배 2부', schedule: '주일 오전 9:30', place: '본당(3층)', category: '예배' },
    { id: 'st-sun-3', name: '주일예배 3부', schedule: '주일 오전 11:30', place: '본당(3층)', category: '예배' },
    { id: 'st-sun-4', name: '주일예배 4부', schedule: '주일 오후 2:00', place: '본당(3층)', category: '예배' },
    {
      id: 'st-evening',
      name: '저녁 찬양예배',
      schedule: '주일 오후 5:00',
      place: '본당(3층)',
      note: '첫째 주는 가정예배',
      category: '예배',
    },
    {
      id: 'st-mba',
      name: '목양바이블아카데미(MBA)',
      schedule: '수요일 오전 10:30',
      place: '본당(3층)',
      category: '예배',
    },
    { id: 'st-wed', name: '수요부흥예배', schedule: '수요일 오후 7:30', place: '본당(3층)', category: '예배' },
    { id: 'st-fri', name: '금요성령집회', schedule: '금요일 오후 8:00', place: '본당(3층)', category: '예배' },

    {
      id: 'st-baby',
      name: '영유아부 (0~4세)',
      schedule: '주일 오전 11:30',
      place: '다윗홀(4층)',
      category: '교육부서',
    },
    {
      id: 'st-kinder',
      name: '유치부 (5~7세)',
      schedule: '주일 오전 9:30',
      place: '샬롬홀(2층)',
      category: '교육부서',
    },
    {
      id: 'st-elem-low',
      name: '초등부 (초등 1~3학년)',
      schedule: '주일 오전 9:30',
      place: '드림홀(지하1층)',
      category: '교육부서',
    },
    {
      id: 'st-elem-high',
      name: '소년부 (초등 4~6학년)',
      schedule: '주일 오전 11:30',
      place: '비전홀(2층)',
      category: '교육부서',
    },
    {
      id: 'st-awana',
      name: '어와나 (초등 1~6학년)',
      schedule: '주일 오후 2:00',
      place: '비전홀(2층)',
      category: '교육부서',
    },
    {
      id: 'st-middle',
      name: '중등부',
      schedule: '주일 오전 11:30',
      place: '여호수아홀(지하1층)',
      category: '교육부서',
    },
    {
      id: 'st-high',
      name: '고등부',
      schedule: '주일 오전 9:30',
      place: '여호수아홀(지하1층)',
      category: '교육부서',
    },
    { id: 'st-youth', name: '청년부', schedule: '주일 오후 2:00', place: '본당(3층)', category: '교육부서' },
  ],
};

export const sampleBulletins: Bulletin[] = [
  {
    id: 'bulletin-2026-08-30',
    serviceDate: '2026-08-30',
    title: '주일 예배 주보 (제43권 35호)',
    sermonTitle: '예수님을 사랑한다는 증거',
    preacher: '공진수 목사',
    scripture: '요한복음 14:20-21 (신약 172쪽)',
    weeklyVerse: '두려워하지 말라, 강하고 담대하라 (신 31:6, 수 1:9)',
    // 홈페이지에 올리는 주보 이미지(앞면·뒷면) 주소를 넣으면 앱에서 원본을 볼 수 있습니다.
    imageUrls: [],
    order: [
      { title: '예배의 부름', detail: '인도자' },
      { title: '신앙고백', detail: '사도신경 / 다같이' },
      { title: '경배와 찬양', detail: '«임재» 찬 370장(통 455장) / 다같이' },
      { title: '기도', detail: '1부 이경재 장로 · 2부 최희병 안수집사 · 3부 최환준 장로' },
      { title: '성도의 교제', detail: '«평화 하나님의 평강이»' },
      { title: '성경봉독', detail: '요한복음 14:20-21 (신약 172쪽)' },
      {
        title: '찬양대 찬양',
        detail: '2부 «임하소서(주님의 성령)» 그레이스 2부 찬양대 · 3부 «거룩한 성» 그레이스 3부 찬양대',
      },
      { title: '말씀', detail: '«예수님을 사랑한다는 증거» / 공진수 목사' },
      { title: '봉헌 찬양', detail: '«약할 때 강함 되시네» / 다같이' },
      { title: '봉헌 및 봉헌기도', detail: '공진수 목사' },
      { title: '축도', detail: '공진수 목사' },
    ],
    notices: [
      '오늘은 8월 다섯 번째 주일입니다. 무더운 8월 한 달 동안 믿음의 경주를 달려오신 모든 성도님들을 예수님의 이름으로 축복하며 환영합니다.',
      '오늘 오후 찬양예배는 청년부 및 교회학교 여름행사 보고 예배로 드립니다. 2026년 여름 수련회와 캠프, 성경학교에 참여하고 봉사해 주신 모든 분들께 감사드립니다.',
      '금요성령집회는 이번 주까지 자율기도회로 드리며, 다음 주부터 현장 예배가 시작됩니다. 말씀은 여호수아 강해로 진행됩니다.',
      '이번 주 8월 31일부터 9월 5일까지 베트남 호치민에서 현지 목회자 60쌍(120명)을 대상으로 목회자 부부 세미나(강사 공진수 목사)가 진행됩니다. 아웃리치 팀과 참석하는 목회자 부부들을 위해 기도해 주세요.',
      '정기당회가 오늘 오후 1시 당회실에서 있습니다.',
      '새가족 등록 4주 과정이 매주 주일 오전 10:45~11:15 이레홀(2층)에서 진행됩니다.',
    ],
  },
];

export const sampleAnnouncements: Announcement[] = [
  {
    id: 'ann-funeral',
    title: '[부고] 김믿음 성도 모친 소천',
    body: `김믿음 성도(3남전도회)의 모친께서 소천하셨기에 알려 드립니다.

· 빈소: ○○병원 장례식장 3호실
· 발인: 9월 15일(월) 오전 7시
· 장지: ○○추모공원

유가족을 위해 함께 기도해 주시고, 위로해 주시기 바랍니다.`,
    category: '소식',
    subCategory: '장례',
    author: '교회 사무실',
    pinned: false,
    publishedAt: dateTime(0),
  },
  {
    id: 'ann-1',
    title: '여름 수련회 신청 안내 (7/18~7/20)',
    body: `올해 여름 수련회를 강원도 평창 수양관에서 진행합니다.

· 일정: 7월 18일(금) ~ 20일(주일) 2박 3일
· 장소: 강원도 평창 수양관
· 회비: 성인 9만원 / 청소년 6만원 / 초등 이하 4만원
· 신청: 교회 사무실 또는 각 소그룹 리더에게

신청 마감은 7월 6일 주일까지입니다. 은혜의 자리에 함께해 주세요.`,
    category: '행사',
    subCategory: '수련회',
    author: '교육부',
    pinned: true,
    publishedAt: dateTime(1),
  },
  {
    id: 'ann-2',
    title: '새가족 환영회 안내',
    body: '이번 주일 2부 예배 후 2층 사랑방에서 새가족 환영회가 있습니다. 등록하신 지 3개월 이내의 새가족은 모두 참석해 주시기 바랍니다. 간단한 다과가 준비되어 있습니다.',
    category: '공지',
    author: '새가족부',
    pinned: true,
    publishedAt: dateTime(2),
  },
  {
    id: 'ann-3',
    title: '주차장 보수 공사로 인한 안내',
    body: '지하주차장 바닥 보수 공사로 이번 주 토요일부터 2주간 지하 주차가 어렵습니다. 인근 공영주차장(도보 3분)을 이용해 주시고, 가급적 대중교통을 이용해 주시면 감사하겠습니다.',
    category: '공지',
    author: '관리부',
    pinned: false,
    publishedAt: dateTime(4),
  },
  {
    id: 'ann-4',
    title: '이웃과 함께 나눈 사랑의 김치 300박스',
    body: '지난 한 달 동안 성도님들과 함께 담근 김치 300박스를 구리 지역 독거 어르신 가정에 전달했습니다. 수고해 주신 봉사자 여러분께 감사드립니다. 다음 나눔은 가을에 진행될 예정입니다.',
    category: '소식',
    author: '선교부',
    pinned: false,
    publishedAt: dateTime(9),
  },
  {
    id: 'ann-5',
    title: '성가대원 모집',
    body: '목양찬양대에서 함께 찬양할 새 대원을 모집합니다. 매주 주일 오전 8시 연습, 2부 예배 찬양으로 섬깁니다. 관심 있는 분은 찬양대 지휘자에게 문의해 주세요.',
    category: '공지',
    author: '찬양부',
    pinned: false,
    publishedAt: dateTime(13),
  },
];

export const sampleSermons: Sermon[] = [
  {
    id: 'sermon-2026-08-30-main',
    title: '예수님을 사랑한다는 증거',
    preacher: '공진수 목사',
    scripture: '요한복음 14:20-21',
    date: '2026-08-30',
    series: '주일예배',
    mediaType: 'video',
    mediaUrl: 'https://www.youtube.com/watch?v=kvwuN6-2PAk',
    summary:
      '성령이 임하실 때 우리가 예수님 안에, 예수님이 우리 안에 거하십니다. 예수님을 사랑하는 증거는 그 말씀과 계명을 지키는 것이며, 말씀을 가까이 곁에 두는 것입니다.',
  },
  {
    // 제목을 비워 두면 앱이 유튜브에서 실제 제목을 가져와 보여 줍니다.
    id: 'sermon-shorts-1',
    title: '',
    preacher: '공진수 목사',
    scripture: '',
    date: '2026-08-30',
    mediaType: 'video',
    mediaUrl: 'https://www.youtube.com/shorts/AC6BLtHogV0',
    summary: '',
  },
  {
    id: 'sermon-2026-08-30-fourth',
    title: '여호와께서 영원무궁 하도록 다스리도다',
    preacher: '엄동식 목사',
    scripture: '출애굽기 15:13-21',
    date: '2026-08-30',
    series: '주일 4부예배',
    mediaType: 'video',
    mediaUrl: ChurchInfo.youtubeUrl,
    summary: '',
  },
  {
    id: 'sermon-2026-08-30-evening',
    title: '어린아이들이 내게 오는 것을 용납하고 금하지 말라',
    preacher: '노준성 목사',
    scripture: '마가복음 10:13-16',
    date: '2026-08-30',
    series: '주일 찬양예배',
    mediaType: 'video',
    mediaUrl: ChurchInfo.youtubeUrl,
    summary: '',
  },
  {
    id: 'sermon-2026-08-26-wed',
    title: '사랑하는 아들을 보내셨다',
    preacher: '김호진 목사',
    scripture: '누가복음 20:9-18',
    date: '2026-08-26',
    series: '수요부흥예배',
    mediaType: 'video',
    mediaUrl: ChurchInfo.youtubeUrl,
    summary: '',
  },
  {
    // 제목은 비워 두면 앱이 유튜브에서 실제 제목을 가져옵니다.
    id: 'sermon-2026-08-28-fri',
    title: '',
    preacher: '공진수 목사',
    scripture: '',
    date: '2026-08-28',
    series: '금요성령집회',
    mediaType: 'video',
    mediaUrl: 'https://www.youtube.com/watch?v=-cNkZs0UXK8',
    summary: '',
  },
];

export const samplePrayerRequests: PrayerRequest[] = [
  {
    id: 'prayer-1',
    title: '어머니 수술을 앞두고 기도 부탁드립니다',
    body: '다음 주 화요일에 어머니께서 무릎 수술을 받으십니다. 수술이 잘 되고 회복이 빠르도록 함께 기도해 주세요.',
    author: '박소영',
    anonymous: false,
    answered: false,
    shared: true,
    prayCount: 24,
    createdAt: dateTime(1),
  },
  {
    id: 'prayer-2',
    title: '진로를 놓고 지혜를 구합니다',
    body: '이직을 두고 고민 중입니다. 하나님의 뜻을 분별할 수 있도록, 조급해지지 않도록 기도 부탁드려요.',
    author: '익명',
    anonymous: true,
    answered: false,
    shared: true,
    prayCount: 12,
    createdAt: dateTime(3),
  },
  {
    id: 'prayer-3',
    title: '아이가 건강하게 태어났습니다. 감사기도 부탁드려요',
    body: '지난달 기도 부탁드렸던 출산 건입니다. 산모와 아기 모두 건강합니다. 함께 기도해 주셔서 감사합니다.',
    author: '정한결',
    anonymous: false,
    answered: true,
    shared: true,
    prayCount: 41,
    createdAt: dateTime(6),
  },
  {
    id: 'prayer-4',
    title: '수험생 자녀를 위해',
    body: '고3 딸이 지치지 않고 끝까지 잘 감당할 수 있도록, 무엇보다 마음의 평안을 잃지 않도록 기도 부탁드립니다.',
    author: '익명',
    anonymous: true,
    answered: false,
    shared: true,
    prayCount: 18,
    createdAt: dateTime(8),
  },
];

export const sampleCommunalPrayers: CommunalPrayer[] = [
  {
    id: 'communal-1',
    title: '민족 복음화와 나라를 위하여',
    body: '이 땅의 회복과 위정자들의 지혜, 다음 세대의 신앙 계승을 위해 함께 기도합니다.',
    totalMinutes: 110400, // 1,840분 → 초
    sortOrder: 1,
    createdAt: dateTime(30),
  },
  {
    id: 'communal-2',
    title: '교회 부흥과 성도의 하나됨',
    body: '예배의 회복과 전도의 열정, 성도 간의 사랑과 섬김을 위해 함께 기도합니다.',
    totalMinutes: 75600, // 1,260분 → 초
    sortOrder: 2,
    createdAt: dateTime(30),
  },
  {
    id: 'communal-3',
    title: '선교사와 열방을 위하여',
    body: '파송 선교사님들의 건강과 사역, 복음이 열방 가운데 전해지도록 함께 기도합니다.',
    totalMinutes: 43200, // 720분 → 초
    sortOrder: 3,
    createdAt: dateTime(30),
  },
];

export const sampleStaff: StaffMember[] = [
  { id: 'staff-1', name: '공진수', category: '목사', role: '담임목사', detail: '', sortOrder: 1 },
  // 실제 교역자·장로·관리 직원은 관리자 화면에서 추가·수정할 수 있습니다.
];

export const sampleGroups: SmallGroup[] = [
  {
    id: 'group-1',
    name: '청년부 · 반석',
    leader: '한지훈 리더',
    meetingInfo: '매주 금요일 오후 8시 · 교육관 2층',
    description: '20~30대 청년들이 말씀을 나누고 삶을 나누는 모임입니다.',
    memberCount: 14,
    },
  {
    id: 'group-2',
    name: '주부 목장 · 뜰안',
    leader: '오정민 권사',
    meetingInfo: '매주 화요일 오전 10시 · 2층 사랑방',
    description: '자녀 양육과 일상의 고민을 말씀 안에서 함께 나눕니다.',
    memberCount: 9,
  },
  {
    id: 'group-3',
    name: '장년 성경공부 · 새벽별',
    leader: '서동원 장로',
    meetingInfo: '매주 수요일 예배 후 · 소예배실',
    description: '한 권씩 성경을 통독하며 깊이 묵상하는 모임입니다.',
    memberCount: 21,
  },
];

export const sampleGroupMessages: GroupMessage[] = [
  {
    id: 'msg-1',
    groupId: 'group-1',
    author: '한지훈 리더',
    body: '이번 주 금요일 모임은 교육관 2층에서 8시에 모입니다. 마태복음 7장 읽고 오세요!',
    createdAt: dateTime(2),
  },
  {
    id: 'msg-2',
    groupId: 'group-1',
    author: '김다인',
    body: '저는 야근이 있어서 8시 30분쯤 도착할 것 같아요 🙏',
    createdAt: dateTime(2),
  },
  {
    id: 'msg-3',
    groupId: 'group-1',
    author: '이준서',
    body: '간식은 제가 준비해 갈게요. 다들 금요일에 봬요!',
    createdAt: dateTime(1),
  },
  {
    id: 'msg-4',
    groupId: 'group-2',
    author: '오정민 권사',
    body: '화요일 모임 장소가 2층 사랑방으로 변경되었습니다. 참고해 주세요.',
    createdAt: dateTime(3),
  },
  {
    id: 'msg-5',
    groupId: 'group-3',
    author: '서동원 장로',
    body: '이번 주는 전도서 4장을 함께 나눕니다. 미리 읽어 오시면 좋겠습니다.',
    createdAt: dateTime(4),
  },
];
