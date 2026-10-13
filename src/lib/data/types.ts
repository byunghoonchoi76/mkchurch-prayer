/** 앱 전체에서 공유하는 도메인 타입. 샘플/Supabase 저장소가 모두 이 형태를 반환합니다. */

export type Role = 'member' | 'admin';

export interface AppUser {
  id: string;
  name: string;
  email?: string;
  role: Role;
  /** 생년월일 (선택) — 'YYYY-MM-DD' 또는 자유 입력 */
  birthDate?: string;
  /** 양력 / 음력 (선택) */
  birthCalendar?: '양력' | '음력';
  /** 직분 (선택) — 예: 집사, 권사, 장로, 성도 */
  position?: string;
  /** 소속 (선택) — 예: 1교구, OO목장 */
  affiliation?: string;
}

/** 예배 안내 화면에서 묶어 보여 주는 분류 */
export type ServiceCategory = '예배' | '교육부서';

/** 섬기는 사람들을 묶어 보여 주는 큰 분류 */
export type StaffCategory = '목사' | '전도사' | '장로' | '관리';

/** 화면에 표시하는 순서 */
export const STAFF_CATEGORIES: StaffCategory[] = ['목사', '전도사', '장로', '관리'];

/** 섬기는 사람들 (교역자·직분자) */
export interface StaffMember {
  id: string;
  /** 이름 */
  name: string;
  /** 큰 분류 (목사 · 장로 · 관리) */
  category: StaffCategory;
  /** 직분·직책 (예: 담임목사, 부목사, 전도사, 장로, 사무장) */
  role: string;
  /** 담당·부서 등 부가 설명 (선택) */
  detail: string;
  sortOrder: number;
}

export type StaffInput = Omit<StaffMember, 'id'>;

/** 새가족 등록 신청 (방문하신 분이 직접 남기는 정보) */
export interface NewFamily {
  id: string;
  name: string;
  phone: string;
  /** 선택 항목들 */
  gender: string;
  address: string;
  /** 소개자·방문 경로 */
  referrer: string;
  note: string;
  createdAt: string;
}

export type NewFamilyInput = Omit<NewFamily, 'id' | 'createdAt'>;

export interface ServiceTime {
  id: string;
  /** 예) 주일예배 1부 */
  name: string;
  /** 예) 주일 오전 07:30 */
  schedule: string;
  place: string;
  note?: string;
  category: ServiceCategory;
}

export interface ChurchProfile {
  name: string;
  /** 교회 표어 */
  slogan: string;
  /** 표어의 성구 출처 (예: 신 31:6, 수 1:9) */
  sloganVerse: string;
  pastor: string;
  address: string;
  phone: string;
  email: string;
  offeringAccount: string;
  /** 설교 영상 채널 (비어 있으면 화면에 표시하지 않습니다) */
  youtubeUrl: string;
  /** 온라인 헌금 주소 (체리 페이지·카카오페이 송금 링크 등). 있으면 헌금 화면에 버튼이 생깁니다. */
  givingUrl: string;
  /** 지도 정확 위치 링크 (네이버 플레이스 등). 있으면 교회 주소 화면에서 바로 연결합니다. */
  mapUrl: string;
  serviceTimes: ServiceTime[];
}

/** 주보 순서지 한 줄 */
export interface BulletinOrderItem {
  title: string;
  detail: string;
}

export interface Bulletin {
  id: string;
  /** ISO 날짜 (YYYY-MM-DD) */
  serviceDate: string;
  title: string;
  sermonTitle: string;
  preacher: string;
  scripture: string;
  order: BulletinOrderItem[];
  notices: string[];
  weeklyVerse: string;
  /**
   * 주보 원본 이미지 주소 (앞면·뒷면 등 여러 장).
   * 홈페이지에 올린 JPG/PNG 주소를 넣으면 앱에서 그대로 볼 수 있고,
   * PDF 주소를 넣으면 파일을 여는 버튼으로 표시됩니다.
   */
  imageUrls: string[];
}

export type BulletinInput = Omit<Bulletin, 'id'>;

export type AnnouncementCategory = '공지' | '행사' | '소식';

/** 소식(성도 일상 소식) 세부 분류 */
export const NEWS_SUBCATEGORIES = ['장례', '결혼', '출산', '입원·회복', '이사', '개업', '기타'] as const;
/** 행사(교회 행사) 세부 분류 */
export const EVENT_SUBCATEGORIES = ['수련회', '세미나·특강', '전도·선교', '봉사·구제', '친교·모임', '절기예배', '기타'] as const;

/** 카테고리별 세부 분류 목록 (공지는 세부 분류 없음) */
export const SUBCATEGORIES: Record<AnnouncementCategory, readonly string[]> = {
  공지: [],
  행사: EVENT_SUBCATEGORIES,
  소식: NEWS_SUBCATEGORIES,
};

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  /** 세부 분류 (소식: 장례·결혼 등 / 행사: 수련회·세미나 등). 공지는 비어 있음. */
  subCategory?: string;
  author: string;
  pinned: boolean;
  /** 첨부 포스터 사진 주소 (최대 2장) */
  images?: string[];
  /** ISO 날짜시각 */
  publishedAt: string;
}

export type AnnouncementInput = Omit<Announcement, 'id' | 'publishedAt'> &
  Partial<Pick<Announcement, 'publishedAt'>>;

export type SermonMedia = 'video' | 'audio';

export interface Sermon {
  id: string;
  title: string;
  preacher: string;
  scripture: string;
  /** ISO 날짜 (YYYY-MM-DD) */
  date: string;
  series?: string;
  mediaType: SermonMedia;
  /** 유튜브/오디오 파일 등 재생 주소 */
  mediaUrl: string;
  thumbnailUrl?: string;
  summary: string;
}

export type SermonInput = Omit<Sermon, 'id'>;

/** 교회 유튜브 채널의 최신 업로드 영상 (설교 자동 노출·가져오기용) */
export interface ChannelVideo {
  videoId: string;
  title: string;
  /** ISO 날짜시각 */
  publishedAt: string;
  thumbnail: string;
  description: string;
  /** 유튜브 쇼츠(세로 단편) 여부 — '쇼츠' 카테고리로만 분류합니다. */
  isShort?: boolean;
}

export interface PrayerRequest {
  id: string;
  title: string;
  body: string;
  /** 익명이면 '익명' 으로 저장됩니다. */
  author: string;
  /** 올린 사람의 계정 id. 본인만 '응답됨' 으로 바꿀 수 있게 하는 데 씁니다. */
  authorId?: string;
  anonymous: boolean;
  answered: boolean;
  /** true 면 '기도 요청'으로 성도들에게 공개되어 함께 기도할 수 있습니다. false 면 나만 보는 개인 기도제목입니다. */
  shared: boolean;
  prayCount: number;
  createdAt: string;
}

export type PrayerRequestInput = Pick<PrayerRequest, 'title' | 'body' | 'author' | 'anonymous' | 'shared'> & {
  authorId?: string;
};

/** 개인 기도제목 수정 — 본인이 올린 제목·내용·익명 여부를 바꿉니다. (author 는 익명 해제 시 표시할 실제 이름) */
export type PrayerRequestUpdate = Pick<PrayerRequest, 'title' | 'body' | 'anonymous'> & { author: string };

/** 공동 기도제목 — 온 성도가 함께 기도하며 시간을 쌓아 가는 교회 공통 제목 */
export interface CommunalPrayer {
  id: string;
  title: string;
  body: string;
  /** 온 성도가 이 제목으로 기도한 시간의 합계(초). 이름은 과거 호환으로 totalMinutes 지만 단위는 '초'입니다. */
  totalMinutes: number;
  sortOrder: number;
  createdAt: string;
}

export type CommunalPrayerInput = Pick<CommunalPrayer, 'title' | 'body' | 'sortOrder'>;

export interface SmallGroup {
  id: string;
  name: string;
  /** 리더 이름(표시용) */
  leader: string;
  /** 리더 계정 id */
  leaderId?: string;
  meetingInfo: string;
  description: string;
  /** 소통방 멤버 수 (서버에서 자동 집계) */
  memberCount: number;
}

/** 소통방 등록·수정 입력 (멤버 수는 자동 집계라 제외) */
export type SmallGroupInput = Omit<SmallGroup, 'id' | 'memberCount'>;

export type GroupMemberRole = 'leader' | 'member';

/** 소통방 멤버 (이름·역할·개인 알림 여부) */
export interface GroupMember {
  userId: string;
  name: string;
  role: GroupMemberRole;
  notify: boolean;
}

/** 초대용 사용자 검색 결과 (앱에 등록된 성도) */
export interface DirectoryUser {
  id: string;
  name: string;
}

/** 관리자 가입자 명단 항목 */
export interface AppMember {
  id: string;
  name: string;
  role: Role;
  /** 가입일 (ISO) */
  createdAt: string;
}

/** 현재 로그인 성도의 특정 소통방 소속 정보 */
export interface MyGroupMembership {
  isMember: boolean;
  role: GroupMemberRole | null;
  /** 이 소통방 새 글 푸시 알림 여부(개인 설정) */
  notify: boolean;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  author: string;
  /** 글쓴이 계정 id (본인 메시지 구분용) */
  authorId?: string;
  body: string;
  /** 첨부 사진 주소 (있으면 말풍선에 사진이 함께 표시됩니다) */
  imageUrl?: string;
  createdAt: string;
}

/** 소통방 멤버의 읽음 위치 — 안 읽은 사람 수(카톡식) 계산에 사용 */
export interface GroupRead {
  userId: string;
  /** 이 멤버가 마지막으로 읽은 시각(ISO) */
  lastReadAt: string;
}

/** 기도시간 기록 (기기 로컬에 저장) */
export interface PrayerLogEntry {
  /** YYYY-MM-DD */
  date: string;
  /** 누적 시간(초). 필드 이름은 과거 호환으로 minutes 지만 단위는 '초'입니다. */
  minutes: number;
  note?: string;
}

/** 기도시간 종류 — 공동 기도 / 개인 기도 */
export type PrayerKind = 'communal' | 'personal';

/** 로그인 계정별로 서버에 저장하는 기도시간 기록 */
export interface PrayerTimeEntry {
  /** YYYY-MM-DD */
  date: string;
  kind: PrayerKind;
  /** 누적 시간(초). 필드 이름은 과거 호환으로 minutes 지만 단위는 '초'입니다. */
  minutes: number;
}

export type DataMode = 'sample' | 'supabase';

/** 화면은 이 인터페이스만 알고 있으면 됩니다. 구현체는 샘플/Supabase 두 가지입니다. */
export interface ChurchRepository {
  mode: DataMode;

  getChurchProfile(): Promise<ChurchProfile>;

  listBulletins(): Promise<Bulletin[]>;
  getBulletin(id: string): Promise<Bulletin | null>;
  getLatestBulletin(): Promise<Bulletin | null>;
  createBulletin(input: BulletinInput): Promise<Bulletin>;
  updateBulletin(id: string, input: BulletinInput): Promise<Bulletin>;
  deleteBulletin(id: string): Promise<void>;

  listAnnouncements(): Promise<Announcement[]>;
  getAnnouncement(id: string): Promise<Announcement | null>;
  createAnnouncement(input: AnnouncementInput): Promise<Announcement>;
  updateAnnouncement(id: string, input: AnnouncementInput): Promise<Announcement>;
  deleteAnnouncement(id: string): Promise<void>;

  listSermons(): Promise<Sermon[]>;
  getSermon(id: string): Promise<Sermon | null>;
  /** 교회 유튜브 채널의 최신 영상 목록 (설교 자동 노출·가져오기). 키가 없거나 실패하면 빈 배열. */
  listChannelVideos(): Promise<ChannelVideo[]>;
  createSermon(input: SermonInput): Promise<Sermon>;
  updateSermon(id: string, input: SermonInput): Promise<Sermon>;
  deleteSermon(id: string): Promise<void>;

  /** 성도들에게 공개된 '기도 요청' 목록 (shared = true) */
  listSharedPrayerRequests(): Promise<PrayerRequest[]>;
  /** 로그인한 본인이 올린 개인 기도제목 목록 (공개 여부 무관) */
  listMyPrayerRequests(): Promise<PrayerRequest[]>;
  /** 기도제목 하나를 id 로 불러옵니다 (수정 화면용). */
  getPrayerRequest(id: string): Promise<PrayerRequest | null>;
  createPrayerRequest(input: PrayerRequestInput): Promise<PrayerRequest>;
  /** 본인이 올린 개인 기도제목의 제목·내용·익명 여부를 수정합니다. */
  updatePrayerRequest(id: string, input: PrayerRequestUpdate): Promise<PrayerRequest>;
  /** 본인이 올린 기도제목을 삭제합니다. */
  deletePrayerRequest(id: string): Promise<void>;
  prayForRequest(id: string): Promise<PrayerRequest>;
  markPrayerAnswered(id: string, answered: boolean): Promise<PrayerRequest>;
  /** 개인 기도제목을 '기도 요청'으로 공개하거나 다시 비공개로 되돌립니다. */
  setPrayerShared(id: string, shared: boolean): Promise<PrayerRequest>;

  listCommunalPrayers(): Promise<CommunalPrayer[]>;
  getCommunalPrayer(id: string): Promise<CommunalPrayer | null>;
  createCommunalPrayer(input: CommunalPrayerInput): Promise<CommunalPrayer>;
  updateCommunalPrayer(id: string, input: CommunalPrayerInput): Promise<CommunalPrayer>;
  deleteCommunalPrayer(id: string): Promise<void>;
  /** 이 제목으로 minutes 만큼 기도한 시간을 전체 누적에 더합니다. */
  prayCommunal(id: string, minutes: number): Promise<CommunalPrayer>;

  /** 로그인한 성도 본인의 기도시간 기록 (계정별, 기기 간 공유) */
  listMyPrayerTime(): Promise<PrayerTimeEntry[]>;
  addMyPrayerTime(kind: PrayerKind, date: string, minutes: number): Promise<void>;
  clearMyPrayerTime(kind: PrayerKind, date: string): Promise<void>;

  /** 맥체인 성경읽기표 진도(완료한 날 인덱스 0~364) — 계정별 */
  getMyReadingProgress(): Promise<number[]>;
  setMyReadingProgress(days: number[]): Promise<void>;

  createNewFamily(input: NewFamilyInput): Promise<NewFamily>;
  listNewFamilies(): Promise<NewFamily[]>;
  deleteNewFamily(id: string): Promise<void>;

  listStaff(): Promise<StaffMember[]>;
  getStaff(id: string): Promise<StaffMember | null>;
  createStaff(input: StaffInput): Promise<StaffMember>;
  updateStaff(id: string, input: StaffInput): Promise<StaffMember>;
  deleteStaff(id: string): Promise<void>;

  listGroups(): Promise<SmallGroup[]>;
  getGroup(id: string): Promise<SmallGroup | null>;
  createGroup(input: SmallGroupInput): Promise<SmallGroup>;
  updateGroup(id: string, input: SmallGroupInput): Promise<SmallGroup>;
  deleteGroup(id: string): Promise<void>;
  listGroupMessages(groupId: string): Promise<GroupMessage[]>;
  sendGroupMessage(groupId: string, author: string, body: string, imageUrl?: string): Promise<GroupMessage>;
  /** 메시지를 삭제합니다(작성자 본인·관리자·리더만, 서버에서 권한 확인). 첨부 사진도 함께 정리합니다. */
  deleteGroupMessage(messageId: string): Promise<void>;
  /** 이 소통방 멤버들의 읽음 위치(안 읽은 사람 수 계산용) */
  listGroupReads(groupId: string): Promise<GroupRead[]>;
  /** 현재 로그인 성도가 이 소통방을 지금까지 읽었다고 표시합니다. */
  markGroupRead(groupId: string): Promise<void>;

  /** 앱에 가입한 성도(계정) 수. 관리자 대시보드용. */
  countMembers(): Promise<number>;
  /** 가입자 명단 (관리자 전용). 최근 가입 순. */
  listMembers(): Promise<AppMember[]>;
  /** 가입자(계정)를 삭제합니다 (관리자 전용, 서버에서 권한 확인). */
  deleteMember(userId: string): Promise<void>;
  /** 앱에 등록된 성도를 이름으로 검색합니다(초대용, 관리자·리더만). */
  searchUsers(query: string): Promise<DirectoryUser[]>;
  /** 소통방 멤버 목록(이름·역할·알림) */
  listGroupMembers(groupId: string): Promise<GroupMember[]>;
  /** 소통방에 멤버를 추가(초대)합니다. */
  addGroupMember(groupId: string, userId: string, role: GroupMemberRole): Promise<void>;
  /** 소통방에서 멤버를 내보냅니다(본인 탈퇴 포함). */
  removeGroupMember(groupId: string, userId: string): Promise<void>;
  /** 이 소통방의 새 글 푸시 알림을 개인별로 켜고 끕니다. */
  setGroupNotify(groupId: string, notify: boolean): Promise<void>;
  /** 현재 로그인 성도가 이 소통방에 속했는지·역할·알림 여부 */
  getMyGroupMembership(groupId: string): Promise<MyGroupMembership>;
}
