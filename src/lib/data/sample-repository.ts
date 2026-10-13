import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  sampleAnnouncements,
  sampleBulletins,
  sampleChurchProfile,
  sampleCommunalPrayers,
  sampleGroupMessages,
  sampleGroups,
  samplePrayerRequests,
  sampleSermons,
  sampleStaff,
} from '@/lib/data/sample-data';
import type {
  Announcement,
  AnnouncementInput,
  AppMember,
  Bulletin,
  BulletinInput,
  ChurchRepository,
  CommunalPrayer,
  CommunalPrayerInput,
  DirectoryUser,
  GroupMember,
  GroupMemberRole,
  GroupMessage,
  MyGroupMembership,
  PrayerRequest,
  PrayerRequestInput,
  PrayerRequestUpdate,
  PrayerTimeEntry,
  Sermon,
  SermonInput,
  SmallGroup,
  SmallGroupInput,
  StaffMember,
  StaffInput,
  NewFamily,
  NewFamilyInput,
} from '@/lib/data/types';

/**
 * 백엔드 없이 동작하는 저장소. 처음에는 샘플 데이터로 시작하고,
 * 이후 추가·수정한 내용은 기기에 저장되어 앱을 다시 열어도 남아 있습니다.
 * (Supabase 를 연결하면 이 저장소 대신 실제 DB 를 사용합니다.)
 */
const STORAGE_KEY = 'church-app/sample-db';

/**
 * 샘플 데이터를 고칠 때마다 이 값을 바꿔 주세요.
 * 기기에 저장된 값이 이 버전과 다르면 새 샘플 데이터로 다시 시작합니다.
 * (그렇지 않으면 앱을 한 번 실행한 기기에는 예전 내용이 계속 남습니다.)
 */
const SAMPLE_VERSION = '2026-09-08-groups';

interface SampleMember extends GroupMember {
  groupId: string;
}

interface SampleDb {
  announcements: Announcement[];
  bulletins: Bulletin[];
  sermons: Sermon[];
  prayers: PrayerRequest[];
  communalPrayers: CommunalPrayer[];
  myPrayerTime: PrayerTimeEntry[];
  staff: StaffMember[];
  newFamilies: NewFamily[];
  groups: SmallGroup[];
  messages: GroupMessage[];
  groupMembers: SampleMember[];
}

/** 샘플 모드의 '나'(로그인 대신) · 초대 검색에 쓰는 가상의 성도 명단 */
const SAMPLE_ME: DirectoryUser = { id: 'sample-me', name: '나 (샘플)' };
const SAMPLE_DIRECTORY: DirectoryUser[] = [
  SAMPLE_ME,
  { id: 'u-1', name: '김다인' },
  { id: 'u-2', name: '이서준' },
  { id: 'u-3', name: '박은혜' },
  { id: 'u-4', name: '최민수' },
  { id: 'u-5', name: '정하윤' },
  { id: 'u-6', name: '한지훈' },
];

// 샘플 모드 가입자 명단 (삭제 데모용으로 수정 가능)
let sampleMembers: AppMember[] = SAMPLE_DIRECTORY.map((u, i) => ({
  id: u.id,
  name: u.name,
  role: i === 0 ? 'admin' : 'member',
  createdAt: new Date(Date.now() - i * 3 * 86400000).toISOString(),
}));

// 샘플 모드에서는 '나'를 모든 소통방의 리더로 두어 모든 기능을 미리 볼 수 있게 합니다.
const sampleGroupMembers = (): SampleMember[] =>
  sampleGroups.flatMap((g) => [
    { groupId: g.id, userId: SAMPLE_ME.id, name: SAMPLE_ME.name, role: 'leader' as GroupMemberRole, notify: true },
    { groupId: g.id, userId: 'u-1', name: '김다인', role: 'member' as GroupMemberRole, notify: true },
    { groupId: g.id, userId: 'u-2', name: '이서준', role: 'member' as GroupMemberRole, notify: true },
  ]);

const initialDb = (): SampleDb => ({
  announcements: [...sampleAnnouncements],
  bulletins: [...sampleBulletins],
  sermons: [...sampleSermons],
  prayers: [...samplePrayerRequests],
  communalPrayers: [...sampleCommunalPrayers],
  myPrayerTime: [],
  staff: [...sampleStaff],
  newFamilies: [],
  groups: [...sampleGroups],
  messages: [...sampleGroupMessages],
  groupMembers: sampleGroupMembers(),
});

let db: SampleDb = initialDb();
let hydration: Promise<void> | null = null;

/** 저장된 내용이 있으면 한 번만 읽어 옵니다. */
function ready(): Promise<void> {
  hydration ??= (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const stored = JSON.parse(raw) as Partial<SampleDb> & { version?: string };
      if (stored.version !== SAMPLE_VERSION) {
        // 샘플 데이터가 갱신되었으므로 기기에 남은 예전 내용을 버립니다.
        await AsyncStorage.removeItem(STORAGE_KEY);
        return;
      }
      db = { ...initialDb(), ...stored };
    } catch {
      // 저장된 값이 깨져 있으면 샘플 데이터로 시작합니다.
    }
  })();
  return hydration;
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...db, version: SAMPLE_VERSION }));
  } catch {
    // 저장에 실패해도 화면 동작은 계속됩니다.
  }
}

const delay = (ms = 180) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const byDateDesc = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);

export const sampleRepository: ChurchRepository = {
  mode: 'sample',

  async getChurchProfile() {
    await ready();
    await delay(60);
    return clone(sampleChurchProfile);
  },

  async listBulletins() {
    await ready();
    await delay();
    return clone(db.bulletins).sort((a, b) => byDateDesc(a.serviceDate, b.serviceDate));
  },

  async getBulletin(id) {
    await ready();
    await delay(80);
    return clone(db.bulletins.find((b) => b.id === id) ?? null);
  },

  async getLatestBulletin() {
    await ready();
    const list = await this.listBulletins();
    return list[0] ?? null;
  },

  async createBulletin(input: BulletinInput) {
    await ready();
    await delay();
    const created: Bulletin = { ...input, id: newId('bulletin') };
    db.bulletins = [created, ...db.bulletins];
    await persist();
    return clone(created);
  },

  async updateBulletin(id, input) {
    await ready();
    await delay();
    const index = db.bulletins.findIndex((b) => b.id === id);
    if (index < 0) throw new Error('주보를 찾을 수 없습니다.');
    const updated: Bulletin = { ...input, id };
    db.bulletins[index] = updated;
    await persist();
    return clone(updated);
  },

  async deleteBulletin(id) {
    await ready();
    await delay();
    db.bulletins = db.bulletins.filter((b) => b.id !== id);
    await persist();
  },

  async listAnnouncements() {
    await ready();
    await delay();
    // 최신 소식이 항상 맨 위에 오도록 발행일 기준 내림차순으로만 정렬합니다.
    return clone(db.announcements).sort((a, b) => byDateDesc(a.publishedAt, b.publishedAt));
  },

  async getAnnouncement(id) {
    await ready();
    await delay(80);
    return clone(db.announcements.find((a) => a.id === id) ?? null);
  },

  async createAnnouncement(input: AnnouncementInput) {
    await ready();
    await delay();
    const created: Announcement = {
      ...input,
      id: newId('ann'),
      publishedAt: input.publishedAt ?? new Date().toISOString(),
    };
    db.announcements = [created, ...db.announcements];
    await persist();
    return clone(created);
  },

  async updateAnnouncement(id, input) {
    await ready();
    await delay();
    const index = db.announcements.findIndex((a) => a.id === id);
    if (index < 0) throw new Error('공지사항을 찾을 수 없습니다.');
    const updated: Announcement = {
      ...db.announcements[index],
      ...input,
      id,
      publishedAt: input.publishedAt ?? db.announcements[index].publishedAt,
    };
    db.announcements[index] = updated;
    await persist();
    return clone(updated);
  },

  async deleteAnnouncement(id) {
    await ready();
    await delay();
    db.announcements = db.announcements.filter((a) => a.id !== id);
    await persist();
  },

  async listSermons() {
    await ready();
    await delay();
    return clone(db.sermons).sort((a, b) => byDateDesc(a.date, b.date));
  },

  async getSermon(id) {
    await ready();
    await delay(80);
    return clone(db.sermons.find((s) => s.id === id) ?? null);
  },

  async createSermon(input: SermonInput) {
    await ready();
    await delay();
    const created: Sermon = { ...input, id: newId('sermon') };
    db.sermons = [created, ...db.sermons];
    await persist();
    return clone(created);
  },

  async updateSermon(id, input) {
    await ready();
    await delay();
    const index = db.sermons.findIndex((s) => s.id === id);
    if (index < 0) throw new Error('설교를 찾을 수 없습니다.');
    const updated: Sermon = { ...input, id };
    db.sermons[index] = updated;
    await persist();
    return clone(updated);
  },

  async deleteSermon(id) {
    await ready();
    await delay();
    db.sermons = db.sermons.filter((s) => s.id !== id);
    await persist();
  },

  async listSharedPrayerRequests() {
    await ready();
    await delay();
    return clone(db.prayers.filter((p) => p.shared)).sort((a, b) => byDateDesc(a.createdAt, b.createdAt));
  },

  async listMyPrayerRequests() {
    await ready();
    await delay();
    // 샘플 모드에서는 계정 개념이 없어 이 기기에 올린 개인 기도제목을 모두 보여 줍니다.
    return clone(db.prayers).sort((a, b) => byDateDesc(a.createdAt, b.createdAt));
  },

  async getPrayerRequest(id) {
    await ready();
    await delay(60);
    return clone(db.prayers.find((p) => p.id === id) ?? null);
  },

  async updatePrayerRequest(id: string, input: PrayerRequestUpdate) {
    await ready();
    await delay();
    const target = db.prayers.find((p) => p.id === id);
    if (!target) throw new Error('기도제목을 찾을 수 없습니다.');
    target.title = input.title;
    target.body = input.body;
    target.anonymous = input.anonymous;
    target.author = input.anonymous ? '익명' : input.author;
    await persist();
    return clone(target);
  },

  async createPrayerRequest(input: PrayerRequestInput) {
    await ready();
    await delay();
    const created: PrayerRequest = {
      id: newId('prayer'),
      title: input.title,
      body: input.body,
      author: input.anonymous ? '익명' : input.author,
      authorId: input.authorId,
      anonymous: input.anonymous,
      answered: false,
      shared: input.shared,
      prayCount: 0,
      createdAt: new Date().toISOString(),
    };
    db.prayers = [created, ...db.prayers];
    await persist();
    return clone(created);
  },

  async deletePrayerRequest(id) {
    await ready();
    await delay();
    db.prayers = db.prayers.filter((p) => p.id !== id);
    await persist();
  },

  async prayForRequest(id) {
    await ready();
    await delay(60);
    const target = db.prayers.find((p) => p.id === id);
    if (!target) throw new Error('기도제목을 찾을 수 없습니다.');
    target.prayCount += 1;
    await persist();
    return clone(target);
  },

  async markPrayerAnswered(id, answered) {
    await ready();
    await delay(60);
    const target = db.prayers.find((p) => p.id === id);
    if (!target) throw new Error('기도제목을 찾을 수 없습니다.');
    target.answered = answered;
    await persist();
    return clone(target);
  },

  async setPrayerShared(id, shared) {
    await ready();
    await delay(60);
    const target = db.prayers.find((p) => p.id === id);
    if (!target) throw new Error('기도제목을 찾을 수 없습니다.');
    target.shared = shared;
    await persist();
    return clone(target);
  },

  async listCommunalPrayers() {
    await ready();
    await delay(120);
    return clone(db.communalPrayers).sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async getCommunalPrayer(id) {
    await ready();
    await delay(80);
    return clone(db.communalPrayers.find((p) => p.id === id) ?? null);
  },

  async createCommunalPrayer(input: CommunalPrayerInput) {
    await ready();
    await delay();
    const created: CommunalPrayer = {
      id: newId('communal'),
      title: input.title,
      body: input.body,
      totalMinutes: 0,
      sortOrder: input.sortOrder,
      createdAt: new Date().toISOString(),
    };
    db.communalPrayers = [...db.communalPrayers, created];
    await persist();
    return clone(created);
  },

  async updateCommunalPrayer(id, input) {
    await ready();
    await delay();
    const index = db.communalPrayers.findIndex((p) => p.id === id);
    if (index < 0) throw new Error('공동 기도제목을 찾을 수 없습니다.');
    const updated: CommunalPrayer = { ...db.communalPrayers[index], ...input };
    db.communalPrayers[index] = updated;
    await persist();
    return clone(updated);
  },

  async deleteCommunalPrayer(id) {
    await ready();
    await delay();
    db.communalPrayers = db.communalPrayers.filter((p) => p.id !== id);
    await persist();
  },

  async prayCommunal(id, minutes) {
    await ready();
    await delay(60);
    const target = db.communalPrayers.find((p) => p.id === id);
    if (!target) throw new Error('공동 기도제목을 찾을 수 없습니다.');
    target.totalMinutes += Math.max(0, Math.round(minutes));
    await persist();
    return clone(target);
  },

  async listMyPrayerTime() {
    await ready();
    await delay(80);
    return clone(db.myPrayerTime);
  },

  async addMyPrayerTime(kind, date, minutes) {
    await ready();
    const add = Math.max(0, Math.round(minutes));
    if (add <= 0) return;
    const existing = db.myPrayerTime.find((e) => e.date === date && e.kind === kind);
    if (existing) {
      existing.minutes += add;
    } else {
      db.myPrayerTime = [...db.myPrayerTime, { date, kind, minutes: add }];
    }
    await persist();
  },

  async clearMyPrayerTime(kind, date) {
    await ready();
    db.myPrayerTime = db.myPrayerTime.filter((e) => !(e.date === date && e.kind === kind));
    await persist();
  },

  // 샘플 모드는 계정이 없어 로컬(AsyncStorage)에만 저장하므로 여기선 사용되지 않습니다.
  async getMyReadingProgress() {
    return [];
  },
  async setMyReadingProgress() {
    /* no-op (샘플 모드) */
  },

  async createNewFamily(input: NewFamilyInput) {
    await ready();
    await delay();
    const created: NewFamily = { ...input, id: newId('nf'), createdAt: new Date().toISOString() };
    db.newFamilies = [created, ...db.newFamilies];
    await persist();
    return clone(created);
  },

  async listNewFamilies() {
    await ready();
    await delay();
    return clone(db.newFamilies).sort((a, b) => byDateDesc(a.createdAt, b.createdAt));
  },

  async deleteNewFamily(id) {
    await ready();
    await delay();
    db.newFamilies = db.newFamilies.filter((f) => f.id !== id);
    await persist();
  },

  async listStaff() {
    await ready();
    await delay(120);
    return clone(db.staff).sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async getStaff(id) {
    await ready();
    await delay(80);
    return clone(db.staff.find((m) => m.id === id) ?? null);
  },

  async createStaff(input: StaffInput) {
    await ready();
    await delay();
    const created: StaffMember = { ...input, id: newId('staff') };
    db.staff = [...db.staff, created];
    await persist();
    return clone(created);
  },

  async updateStaff(id, input) {
    await ready();
    await delay();
    const index = db.staff.findIndex((m) => m.id === id);
    if (index < 0) throw new Error('섬기는 분을 찾을 수 없습니다.');
    const updated: StaffMember = { ...input, id };
    db.staff[index] = updated;
    await persist();
    return clone(updated);
  },

  async deleteStaff(id) {
    await ready();
    await delay();
    db.staff = db.staff.filter((m) => m.id !== id);
    await persist();
  },

  async listGroups() {
    await ready();
    await delay();
    return clone(db.groups.map(withMemberCount));
  },

  async listChannelVideos() {
    await ready();
    await delay(150);
    // 샘플 모드에서는 예시 영상을 몇 개 보여 줍니다. (실제 앱은 교회 유튜브 채널에서 가져옵니다)
    const iso = (daysAgo: number) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString();
    };
    return [
      { videoId: 'dQw4w9WgXcQ', title: '주일예배 | 늘 함께하시는 하나님', publishedAt: iso(1), thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg', description: '', isShort: false },
      { videoId: 'M7lc1UVf-VE', title: '수요부흥예배 | 기도의 능력', publishedAt: iso(4), thumbnail: 'https://i.ytimg.com/vi/M7lc1UVf-VE/mqdefault.jpg', description: '', isShort: false },
      { videoId: 'ScMzIvxBSi4', title: '새벽예배 | 말씀 앞에 서다', publishedAt: iso(6), thumbnail: 'https://i.ytimg.com/vi/ScMzIvxBSi4/mqdefault.jpg', description: '', isShort: false },
      { videoId: 'aqz-KE-bpKQ', title: '오늘의 은혜 한 구절', publishedAt: iso(2), thumbnail: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/mqdefault.jpg', description: '', isShort: true },
    ];
  },

  async getGroup(id) {
    await ready();
    await delay(80);
    const found = db.groups.find((g) => g.id === id);
    return clone(found ? withMemberCount(found) : null);
  },

  async createGroup(input: SmallGroupInput) {
    await ready();
    await delay();
    const created: SmallGroup = { ...input, id: newId('group'), memberCount: 0 };
    db.groups = [...db.groups, created];
    if (input.leaderId) {
      const name = SAMPLE_DIRECTORY.find((u) => u.id === input.leaderId)?.name ?? input.leader;
      db.groupMembers.push({ groupId: created.id, userId: input.leaderId, name, role: 'leader', notify: true });
    }
    await persist();
    return clone(withMemberCount(created));
  },

  async updateGroup(id, input) {
    await ready();
    await delay();
    const index = db.groups.findIndex((g) => g.id === id);
    if (index < 0) throw new Error('소통방을 찾을 수 없습니다.');
    const prev = db.groups[index];
    const updated: SmallGroup = { ...input, id, memberCount: prev.memberCount };
    db.groups[index] = updated;
    if (input.leaderId && input.leaderId !== prev.leaderId) {
      db.groupMembers.forEach((m) => {
        if (m.groupId === id && m.role === 'leader') m.role = 'member';
      });
      const existing = db.groupMembers.find((m) => m.groupId === id && m.userId === input.leaderId);
      if (existing) existing.role = 'leader';
      else {
        const name = SAMPLE_DIRECTORY.find((u) => u.id === input.leaderId)?.name ?? input.leader;
        db.groupMembers.push({ groupId: id, userId: input.leaderId, name, role: 'leader', notify: true });
      }
    }
    await persist();
    return clone(withMemberCount(updated));
  },

  async deleteGroup(id) {
    await ready();
    await delay();
    db.groups = db.groups.filter((g) => g.id !== id);
    // 소통방을 지우면 그 방의 대화·멤버도 함께 지웁니다.
    db.messages = db.messages.filter((m) => m.groupId !== id);
    db.groupMembers = db.groupMembers.filter((m) => m.groupId !== id);
    await persist();
  },

  async listGroupMessages(groupId) {
    await ready();
    await delay(120);
    return clone(db.messages.filter((m) => m.groupId === groupId)).sort((a, b) =>
      a.createdAt < b.createdAt ? -1 : 1,
    );
  },

  async sendGroupMessage(groupId, author, body, imageUrl) {
    await ready();
    await delay(80);
    const created: GroupMessage = {
      id: newId('msg'),
      groupId,
      author,
      authorId: SAMPLE_ME.id,
      body,
      imageUrl,
      createdAt: new Date().toISOString(),
    };
    db.messages = [...db.messages, created];
    await persist();
    return clone(created);
  },

  async deleteGroupMessage(messageId) {
    await ready();
    await delay(60);
    db.messages = db.messages.filter((m) => m.id !== messageId);
    await persist();
  },

  async listGroupReads(groupId) {
    await ready();
    await delay(60);
    // 샘플에서는 '나'만 최신까지 읽은 상태로 보여, 읽음 표시(안 읽은 사람 수)가 어떻게 보이는지 확인할 수 있게 합니다.
    void groupId;
    return [{ userId: SAMPLE_ME.id, lastReadAt: new Date().toISOString() }];
  },

  async markGroupRead() {
    await ready();
    await delay(40);
  },

  async countMembers() {
    await ready();
    await delay(80);
    return sampleMembers.length;
  },

  async listMembers() {
    await ready();
    await delay(120);
    return [...sampleMembers].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async deleteMember(userId: string) {
    await ready();
    await delay();
    if (userId === SAMPLE_ME.id) throw new Error('본인 계정은 삭제할 수 없습니다.');
    sampleMembers = sampleMembers.filter((m) => m.id !== userId);
  },

  async searchUsers(query: string) {
    await ready();
    await delay(120);
    const q = query.trim();
    if (!q) return [];
    return SAMPLE_DIRECTORY.filter((u) => u.name.includes(q)).map((u) => ({ ...u }));
  },

  async listGroupMembers(groupId: string) {
    await ready();
    await delay(80);
    return db.groupMembers
      .filter((m) => m.groupId === groupId)
      .map(({ userId, name, role, notify }) => ({ userId, name, role, notify }))
      .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'leader' ? -1 : 1));
  },

  async addGroupMember(groupId: string, userId: string, role: GroupMemberRole) {
    await ready();
    await delay();
    if (db.groupMembers.some((m) => m.groupId === groupId && m.userId === userId)) return;
    const name = SAMPLE_DIRECTORY.find((u) => u.id === userId)?.name ?? '성도';
    db.groupMembers.push({ groupId, userId, name, role, notify: true });
    await persist();
  },

  async removeGroupMember(groupId: string, userId: string) {
    await ready();
    await delay();
    db.groupMembers = db.groupMembers.filter((m) => !(m.groupId === groupId && m.userId === userId));
    await persist();
  },

  async setGroupNotify(groupId: string, notify: boolean) {
    await ready();
    await delay(60);
    const mine = db.groupMembers.find((m) => m.groupId === groupId && m.userId === SAMPLE_ME.id);
    if (mine) mine.notify = notify;
    await persist();
  },

  async getMyGroupMembership(groupId: string): Promise<MyGroupMembership> {
    await ready();
    await delay(60);
    const mine = db.groupMembers.find((m) => m.groupId === groupId && m.userId === SAMPLE_ME.id);
    if (!mine) return { isMember: false, role: null, notify: true };
    return { isMember: true, role: mine.role, notify: mine.notify };
  },
};

/** 소통방의 멤버 수를 멤버 목록에서 계산해 채웁니다. */
function withMemberCount(group: SmallGroup): SmallGroup {
  return { ...group, memberCount: db.groupMembers.filter((m) => m.groupId === group.id).length };
}


/** 샘플 모드에서 기기에 저장된 내용을 지우고 처음 상태로 되돌립니다. */
export async function resetSampleData(): Promise<void> {
  db = initialDb();
  hydration = Promise.resolve();
  await AsyncStorage.removeItem(STORAGE_KEY);
}
