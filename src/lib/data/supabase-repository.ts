import { ChurchInfo } from '@/constants/church';
import { deleteImage } from '@/lib/storage';
import { requireSupabase } from '@/lib/supabase';
import type {
  Announcement,
  AnnouncementInput,
  Bulletin,
  BulletinInput,
  ChannelVideo,
  ChurchProfile,
  ChurchRepository,
  CommunalPrayer,
  CommunalPrayerInput,
  GroupMemberRole,
  GroupMessage,
  PrayerRequest,
  PrayerRequestInput,
  PrayerRequestUpdate,
  PrayerKind,
  PrayerTimeEntry,
  Sermon,
  SermonInput,
  SmallGroup,
  SmallGroupInput,
  StaffMember,
  StaffInput,
  StaffCategory,
  NewFamily,
  NewFamilyInput,
} from '@/lib/data/types';

/**
 * Supabase 저장소. 테이블 정의는 `supabase/schema.sql` 에 있습니다.
 * DB 는 snake_case, 앱은 camelCase 를 쓰므로 이 파일에서 변환합니다.
 */

/** 현재 로그인한 사용자의 id (비로그인이면 null) */
async function currentUserId(): Promise<string | null> {
  const sb = requireSupabase();
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('데이터를 불러오지 못했습니다.');
  return result.data;
}

type Row = Record<string, any>;

const toBulletin = (row: Row): Bulletin => ({
  id: row.id,
  serviceDate: row.service_date,
  title: row.title,
  sermonTitle: row.sermon_title,
  preacher: row.preacher,
  scripture: row.scripture,
  order: row.order_items ?? [],
  notices: row.notices ?? [],
  weeklyVerse: row.weekly_verse ?? '',
  imageUrls: row.image_urls ?? [],
});

const fromBulletin = (input: BulletinInput) => ({
  service_date: input.serviceDate,
  title: input.title,
  sermon_title: input.sermonTitle,
  preacher: input.preacher,
  scripture: input.scripture,
  weekly_verse: input.weeklyVerse,
  order_items: input.order,
  notices: input.notices,
  image_urls: input.imageUrls,
});

const toAnnouncement = (row: Row): Announcement => ({
  id: row.id,
  title: row.title,
  body: row.body,
  category: row.category,
  subCategory: row.sub_category ?? undefined,
  author: row.author,
  pinned: row.pinned,
  images: (row.images as string[] | null) ?? [],
  publishedAt: row.published_at,
});

// 공통 필드만 만듭니다. published_at 은 '작성 시각'이라 수정 때는 건드리지 않습니다.
// (수정할 때마다 now 로 덮으면 '새 소식' 배지가 다시 떠 버립니다.)
const fromAnnouncement = (input: AnnouncementInput) => ({
  title: input.title,
  body: input.body,
  category: input.category,
  sub_category: input.subCategory ?? null,
  author: input.author,
  pinned: input.pinned,
  images: input.images ?? [],
});

const toSermon = (row: Row): Sermon => ({
  id: row.id,
  title: row.title,
  preacher: row.preacher,
  scripture: row.scripture,
  date: row.preached_on,
  series: row.series ?? undefined,
  mediaType: row.media_type,
  mediaUrl: row.media_url,
  thumbnailUrl: row.thumbnail_url ?? undefined,
  summary: row.summary ?? '',
});

const fromSermon = (input: SermonInput) => ({
  title: input.title,
  preacher: input.preacher,
  scripture: input.scripture,
  preached_on: input.date,
  series: input.series ?? null,
  media_type: input.mediaType,
  media_url: input.mediaUrl,
  thumbnail_url: input.thumbnailUrl ?? null,
  summary: input.summary,
});

const toPrayer = (row: Row): PrayerRequest => ({
  id: row.id,
  title: row.title,
  body: row.body,
  author: row.author,
  authorId: row.author_id ?? undefined,
  anonymous: row.anonymous,
  answered: row.answered,
  shared: row.shared ?? true,
  prayCount: row.pray_count ?? 0,
  createdAt: row.created_at,
});

const toCommunal = (row: Row): CommunalPrayer => ({
  id: row.id,
  title: row.title,
  body: row.body ?? '',
  totalMinutes: row.total_minutes ?? 0,
  sortOrder: row.sort_order ?? 0,
  createdAt: row.created_at,
});

const fromCommunal = (input: CommunalPrayerInput) => ({
  title: input.title,
  body: input.body,
  sort_order: input.sortOrder,
});

const toGroup = (row: Row): SmallGroup => ({
  id: row.id,
  name: row.name,
  leader: row.leader,
  leaderId: row.leader_id ?? undefined,
  meetingInfo: row.meeting_info,
  description: row.description ?? '',
  memberCount: row.member_count ?? 0,
});

const toNewFamily = (row: Row): NewFamily => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  gender: row.gender ?? '',
  address: row.address ?? '',
  referrer: row.referrer ?? '',
  note: row.note ?? '',
  createdAt: row.created_at,
});

// category 컬럼이 아직 없거나 비어 있으면 직분(role)으로 큰 분류를 유추합니다.
const inferCategory = (role: string): StaffCategory => {
  if (role.includes('전도사') || role.includes('강도사')) return '전도사';
  if (role.includes('장로')) return '장로';
  if (role.includes('목사')) return '목사';
  return '관리';
};

const toStaff = (row: Row): StaffMember => ({
  id: row.id,
  name: row.name,
  category: (row.category as StaffCategory) || inferCategory(row.role ?? ''),
  role: row.role,
  detail: row.detail ?? '',
  sortOrder: row.sort_order ?? 0,
});

const fromStaff = (input: StaffInput) => ({
  name: input.name,
  category: input.category,
  role: input.role,
  detail: input.detail,
  sort_order: input.sortOrder,
});

const fromGroup = (input: SmallGroupInput) => ({
  name: input.name,
  leader: input.leader,
  leader_id: input.leaderId ?? null,
  meeting_info: input.meetingInfo,
  description: input.description,
});

const toMessage = (row: Row): GroupMessage => ({
  id: row.id,
  groupId: row.group_id,
  author: row.author,
  authorId: row.author_id ?? undefined,
  body: row.body,
  imageUrl: row.image_url ?? undefined,
  createdAt: row.created_at,
});

export const supabaseRepository: ChurchRepository = {
  mode: 'supabase',

  async getChurchProfile(): Promise<ChurchProfile> {
    const sb = requireSupabase();
    const [profile, times] = await Promise.all([
      sb.from('church_profile').select('*').limit(1).maybeSingle(),
      sb.from('service_times').select('*').order('sort_order', { ascending: true }),
    ]);
    if (profile.error) throw new Error(profile.error.message);
    if (times.error) throw new Error(times.error.message);

    const row = (profile.data ?? {}) as Row;
    return {
      name: row.name ?? ChurchInfo.name,
      slogan: row.slogan ?? ChurchInfo.slogan,
      sloganVerse: row.slogan_verse ?? ChurchInfo.sloganVerse,
      pastor: row.pastor ?? ChurchInfo.pastor,
      address: row.address ?? ChurchInfo.address,
      phone: row.phone ?? ChurchInfo.phone,
      email: row.email ?? ChurchInfo.email,
      offeringAccount: row.offering_account ?? ChurchInfo.offeringAccount,
      youtubeUrl: row.youtube_url ?? ChurchInfo.youtubeUrl,
      givingUrl: row.giving_url ?? ChurchInfo.givingUrl,
      mapUrl: row.map_url ?? ChurchInfo.mapUrl,
      serviceTimes: (times.data ?? []).map((t: Row) => ({
        id: t.id,
        name: t.name,
        schedule: t.schedule,
        place: t.place,
        note: t.note ?? undefined,
        category: t.category ?? '예배',
      })),
    };
  },

  async listBulletins() {
    const sb = requireSupabase();
    const res = await sb.from('bulletins').select('*').order('service_date', { ascending: false });
    return unwrap(res).map(toBulletin);
  },

  async getBulletin(id) {
    const sb = requireSupabase();
    const res = await sb.from('bulletins').select('*').eq('id', id).maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return res.data ? toBulletin(res.data) : null;
  },

  async getLatestBulletin() {
    const sb = requireSupabase();
    const res = await sb
      .from('bulletins')
      .select('*')
      .order('service_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return res.data ? toBulletin(res.data) : null;
  },

  async createBulletin(input) {
    const sb = requireSupabase();
    const res = await sb.from('bulletins').insert(fromBulletin(input)).select().single();
    return toBulletin(unwrap(res));
  },

  async updateBulletin(id, input) {
    const sb = requireSupabase();
    const res = await sb.from('bulletins').update(fromBulletin(input)).eq('id', id).select().single();
    return toBulletin(unwrap(res));
  },

  async deleteBulletin(id) {
    const sb = requireSupabase();
    const { error } = await sb.from('bulletins').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async listAnnouncements() {
    const sb = requireSupabase();
    // 최신 소식이 항상 맨 위에 오도록 발행일 기준 내림차순으로 정렬합니다.
    const res = await sb
      .from('announcements')
      .select('*')
      .order('published_at', { ascending: false });
    return unwrap(res).map(toAnnouncement);
  },

  async getAnnouncement(id) {
    const sb = requireSupabase();
    const res = await sb.from('announcements').select('*').eq('id', id).maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return res.data ? toAnnouncement(res.data) : null;
  },

  async createAnnouncement(input) {
    const sb = requireSupabase();
    const res = await sb
      .from('announcements')
      .insert({ ...fromAnnouncement(input), published_at: input.publishedAt ?? new Date().toISOString() })
      .select()
      .single();
    const created = toAnnouncement(unwrap(res));
    // 알림을 켜 둔 성도들에게 새 소식 푸시(실패해도 등록은 성공 처리).
    try {
      await sb.functions.invoke('notify-announcement', { body: { announcementId: created.id } });
    } catch {
      /* 알림 실패는 무시 */
    }
    return created;
  },

  async updateAnnouncement(id, input) {
    const sb = requireSupabase();
    const res = await sb
      .from('announcements')
      // published_at 은 그대로 두어 '작성 시각'을 유지합니다. (명시적으로 넘길 때만 변경)
      .update(input.publishedAt ? { ...fromAnnouncement(input), published_at: input.publishedAt } : fromAnnouncement(input))
      .eq('id', id)
      .select()
      .single();
    return toAnnouncement(unwrap(res));
  },

  async deleteAnnouncement(id) {
    const sb = requireSupabase();
    // 딸린 포스터 사진도 저장소에서 함께 정리합니다(어느 경로로 삭제하든 확실히).
    const { data } = await sb.from('announcements').select('images').eq('id', id).maybeSingle();
    const images = ((data?.images as string[] | null) ?? []).filter(Boolean);
    await Promise.all(images.map((url) => deleteImage(url)));
    const { error } = await sb.from('announcements').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async listSermons() {
    const sb = requireSupabase();
    const res = await sb.from('sermons').select('*').order('preached_on', { ascending: false });
    return unwrap(res).map(toSermon);
  },

  async getSermon(id) {
    const sb = requireSupabase();
    const res = await sb.from('sermons').select('*').eq('id', id).maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return res.data ? toSermon(res.data) : null;
  },

  async listChannelVideos() {
    const sb = requireSupabase();
    try {
      const { data, error } = await sb.functions.invoke('youtube-videos');
      if (error) return [];
      const videos = (data as { videos?: ChannelVideo[] })?.videos ?? [];
      return videos.filter((v) => v.videoId);
    } catch {
      return [];
    }
  },

  async createSermon(input) {
    const sb = requireSupabase();
    const res = await sb.from('sermons').insert(fromSermon(input)).select().single();
    return toSermon(unwrap(res));
  },

  async updateSermon(id, input) {
    const sb = requireSupabase();
    const res = await sb.from('sermons').update(fromSermon(input)).eq('id', id).select().single();
    return toSermon(unwrap(res));
  },

  async deleteSermon(id) {
    const sb = requireSupabase();
    const { error } = await sb.from('sermons').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async listSharedPrayerRequests() {
    const sb = requireSupabase();
    const res = await sb
      .from('prayer_requests')
      .select('*')
      .eq('shared', true)
      .order('created_at', { ascending: false });
    return unwrap(res).map(toPrayer);
  },

  async listMyPrayerRequests() {
    const sb = requireSupabase();
    const uid = await currentUserId();
    if (!uid) return [];
    const res = await sb
      .from('prayer_requests')
      .select('*')
      .eq('author_id', uid)
      .order('created_at', { ascending: false });
    return unwrap(res).map(toPrayer);
  },

  async getPrayerRequest(id) {
    const sb = requireSupabase();
    const res = await sb.from('prayer_requests').select('*').eq('id', id).maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return res.data ? toPrayer(res.data as Row) : null;
  },

  async updatePrayerRequest(id: string, input: PrayerRequestUpdate) {
    const sb = requireSupabase();
    const res = await sb
      .from('prayer_requests')
      .update({
        title: input.title,
        body: input.body,
        anonymous: input.anonymous,
        author: input.anonymous ? '익명' : input.author,
      })
      .eq('id', id)
      .select()
      .single();
    return toPrayer(unwrap(res));
  },

  async createPrayerRequest(input: PrayerRequestInput) {
    const sb = requireSupabase();
    const res = await sb
      .from('prayer_requests')
      .insert({
        title: input.title,
        body: input.body,
        author: input.anonymous ? '익명' : input.author,
        anonymous: input.anonymous,
        shared: input.shared,
        // 본인이 올린 기도제목만 수정·삭제할 수 있게 작성자를 남깁니다.
        author_id: await currentUserId(),
      })
      .select()
      .single();
    return toPrayer(unwrap(res));
  },

  async deletePrayerRequest(id) {
    const sb = requireSupabase();
    const res = await sb.from('prayer_requests').delete().eq('id', id);
    if (res.error) throw new Error(res.error.message);
  },

  async prayForRequest(id) {
    const sb = requireSupabase();
    // 동시 클릭에도 카운트가 어긋나지 않도록 DB 함수로 증가시킵니다.
    const res = await sb.rpc('increment_pray_count', { request_id: id }).select().single();
    if (res.error) throw new Error(res.error.message);
    return toPrayer(res.data as Row);
  },

  async markPrayerAnswered(id, answered) {
    const sb = requireSupabase();
    const res = await sb
      .from('prayer_requests')
      .update({ answered })
      .eq('id', id)
      .select()
      .single();
    return toPrayer(unwrap(res));
  },

  async setPrayerShared(id, shared) {
    const sb = requireSupabase();
    const res = await sb
      .from('prayer_requests')
      .update({ shared })
      .eq('id', id)
      .select()
      .single();
    return toPrayer(unwrap(res));
  },

  async listCommunalPrayers() {
    const sb = requireSupabase();
    const res = await sb.from('communal_prayers').select('*').order('sort_order', { ascending: true });
    return unwrap(res).map(toCommunal);
  },

  async getCommunalPrayer(id) {
    const sb = requireSupabase();
    const res = await sb.from('communal_prayers').select('*').eq('id', id).maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return res.data ? toCommunal(res.data) : null;
  },

  async createCommunalPrayer(input) {
    const sb = requireSupabase();
    const res = await sb.from('communal_prayers').insert(fromCommunal(input)).select().single();
    return toCommunal(unwrap(res));
  },

  async updateCommunalPrayer(id, input) {
    const sb = requireSupabase();
    const res = await sb.from('communal_prayers').update(fromCommunal(input)).eq('id', id).select().single();
    return toCommunal(unwrap(res));
  },

  async deleteCommunalPrayer(id) {
    const sb = requireSupabase();
    const { error } = await sb.from('communal_prayers').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async prayCommunal(id, minutes) {
    const sb = requireSupabase();
    // 여러 성도가 동시에 기도해도 합계가 어긋나지 않도록 DB 함수로 누적합니다.
    const res = await sb
      .rpc('add_communal_prayer_minutes', { p_id: id, p_minutes: Math.max(0, Math.round(minutes)) })
      .select()
      .single();
    if (res.error) throw new Error(res.error.message);
    return toCommunal(res.data as Row);
  },

  async listMyPrayerTime() {
    const sb = requireSupabase();
    // RLS 로 본인 행만 조회됩니다.
    const res = await sb.from('prayer_time').select('date, kind, minutes');
    return unwrap(res).map(
      (row: Row): PrayerTimeEntry => ({
        date: row.date,
        kind: (row.kind as PrayerKind) ?? 'personal',
        minutes: row.minutes ?? 0,
      }),
    );
  },

  async addMyPrayerTime(kind, date, minutes) {
    const sb = requireSupabase();
    const { error } = await sb.rpc('add_prayer_time', {
      p_date: date,
      p_kind: kind,
      p_minutes: Math.max(0, Math.round(minutes)),
    });
    if (error) throw new Error(error.message);
  },

  async clearMyPrayerTime(kind, date) {
    const sb = requireSupabase();
    // RLS 로 본인 행만 삭제됩니다.
    const { error } = await sb.from('prayer_time').delete().eq('date', date).eq('kind', kind);
    if (error) throw new Error(error.message);
  },

  async getMyReadingProgress() {
    const sb = requireSupabase();
    const { data } = await sb.from('reading_plan_progress').select('done_days').maybeSingle();
    const days = (data as { done_days?: number[] } | null)?.done_days ?? [];
    return days.filter((n) => Number.isInteger(n));
  },

  async setMyReadingProgress(days) {
    const sb = requireSupabase();
    const { error } = await sb.rpc('set_reading_progress', { p_days: days });
    if (error) throw new Error(error.message);
  },

  async createNewFamily(input) {
    const sb = requireSupabase();
    const res = await sb
      .from('new_families')
      .insert({
        name: input.name,
        phone: input.phone,
        gender: input.gender,
        address: input.address,
        referrer: input.referrer,
        note: input.note,
      })
      .select()
      .single();
    return toNewFamily(unwrap(res));
  },

  async listNewFamilies() {
    const sb = requireSupabase();
    const res = await sb.from('new_families').select('*').order('created_at', { ascending: false });
    return unwrap(res).map(toNewFamily);
  },

  async deleteNewFamily(id) {
    const sb = requireSupabase();
    const { error } = await sb.from('new_families').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async listStaff() {
    const sb = requireSupabase();
    const res = await sb.from('church_staff').select('*').order('sort_order', { ascending: true });
    return unwrap(res).map(toStaff);
  },

  async getStaff(id) {
    const sb = requireSupabase();
    const res = await sb.from('church_staff').select('*').eq('id', id).maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return res.data ? toStaff(res.data) : null;
  },

  async createStaff(input) {
    const sb = requireSupabase();
    const res = await sb.from('church_staff').insert(fromStaff(input)).select().single();
    return toStaff(unwrap(res));
  },

  async updateStaff(id, input) {
    const sb = requireSupabase();
    const res = await sb.from('church_staff').update(fromStaff(input)).eq('id', id).select().single();
    return toStaff(unwrap(res));
  },

  async deleteStaff(id) {
    const sb = requireSupabase();
    const { error } = await sb.from('church_staff').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async listGroups() {
    const sb = requireSupabase();
    const res = await sb.from('small_groups').select('*').order('name', { ascending: true });
    return unwrap(res).map(toGroup);
  },

  async getGroup(id) {
    const sb = requireSupabase();
    const res = await sb.from('small_groups').select('*').eq('id', id).maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return res.data ? toGroup(res.data) : null;
  },

  async createGroup(input) {
    const sb = requireSupabase();
    const res = await sb.from('small_groups').insert(fromGroup(input)).select().single();
    const group = toGroup(unwrap(res));
    // 리더를 지정했으면 소통방 멤버(리더)로 등록합니다.
    if (input.leaderId) {
      await sb.from('group_members').upsert(
        { group_id: group.id, user_id: input.leaderId, role: 'leader' },
        { onConflict: 'group_id,user_id' },
      );
    }
    return group;
  },

  async updateGroup(id, input) {
    const sb = requireSupabase();
    const prev = await this.getGroup(id);
    const res = await sb.from('small_groups').update(fromGroup(input)).eq('id', id).select().single();
    const group = toGroup(unwrap(res));
    // 리더가 바뀌었으면: 이전 리더는 일반 멤버로, 새 리더는 리더 멤버로.
    if (input.leaderId && input.leaderId !== prev?.leaderId) {
      if (prev?.leaderId) {
        await sb.from('group_members').update({ role: 'member' }).eq('group_id', id).eq('user_id', prev.leaderId);
      }
      await sb.from('group_members').upsert(
        { group_id: id, user_id: input.leaderId, role: 'leader' },
        { onConflict: 'group_id,user_id' },
      );
    }
    return group;
  },

  async deleteGroup(id) {
    const sb = requireSupabase();
    // group_messages · group_members 는 on delete cascade 로 함께 지워집니다.
    const { error } = await sb.from('small_groups').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async listGroupMessages(groupId) {
    const sb = requireSupabase();
    const res = await sb
      .from('group_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(200);
    return unwrap(res).map(toMessage);
  },

  async sendGroupMessage(groupId, author, body, imageUrl) {
    const sb = requireSupabase();
    const res = await sb
      .from('group_messages')
      .insert({ group_id: groupId, author, body, image_url: imageUrl ?? null, author_id: await currentUserId() })
      .select()
      .single();
    const message = toMessage(unwrap(res));
    // 같은 방의 다른 멤버에게 푸시 알림(앱을 나가 있어도 옴). 실패해도 전송은 성공 처리.
    try {
      await sb.functions.invoke('notify-group', { body: { messageId: message.id } });
    } catch {
      /* 알림 실패는 무시 */
    }
    return message;
  },

  async deleteGroupMessage(messageId) {
    const sb = requireSupabase();
    // 첨부 사진이 있으면 저장소에서도 정리(권한이 없어 못 지워도 메시지 삭제는 진행).
    const { data } = await sb.from('group_messages').select('image_url').eq('id', messageId).maybeSingle();
    const imageUrl = (data?.image_url as string | null) ?? null;
    if (imageUrl) await deleteImage(imageUrl);
    const { error } = await sb.from('group_messages').delete().eq('id', messageId);
    if (error) throw new Error(error.message);
  },

  async listGroupReads(groupId) {
    const sb = requireSupabase();
    const res = await sb.from('group_reads').select('user_id, last_read_at').eq('group_id', groupId);
    if (res.error) throw new Error(res.error.message);
    return ((res.data ?? []) as { user_id: string; last_read_at: string }[]).map((r) => ({
      userId: r.user_id,
      lastReadAt: r.last_read_at,
    }));
  },

  async markGroupRead(groupId) {
    const sb = requireSupabase();
    const { error } = await sb.rpc('mark_group_read', { gid: groupId });
    if (error) throw new Error(error.message);
  },

  async countMembers() {
    const sb = requireSupabase();
    const res = await sb.from('profiles').select('id', { count: 'exact', head: true });
    if (res.error) return 0;
    return res.count ?? 0;
  },

  async listMembers() {
    const sb = requireSupabase();
    const res = await sb.from('profiles').select('id, name, role, created_at').order('created_at', { ascending: false });
    if (res.error) throw new Error(res.error.message);
    return ((res.data ?? []) as { id: string; name: string; role: string; created_at: string }[]).map((r) => ({
      id: r.id,
      name: r.name,
      role: (r.role === 'admin' ? 'admin' : 'member') as 'admin' | 'member',
      createdAt: r.created_at,
    }));
  },

  async deleteMember(userId: string) {
    const sb = requireSupabase();
    const { data, error } = await sb.functions.invoke('admin-delete-user', { body: { userId } });
    if (error) throw new Error(error.message);
    const res = data as { ok?: boolean; error?: string };
    if (!res?.ok) throw new Error(res?.error ?? '삭제하지 못했습니다.');
  },

  async searchUsers(query) {
    const sb = requireSupabase();
    const q = query.trim();
    if (!q) return [];
    const res = await sb.rpc('search_app_users', { q });
    if (res.error) throw new Error(res.error.message);
    return ((res.data ?? []) as { id: string; name: string }[]).map((r) => ({ id: r.id, name: r.name }));
  },

  async listGroupMembers(groupId) {
    const sb = requireSupabase();
    const res = await sb.rpc('list_group_members', { gid: groupId });
    if (res.error) throw new Error(res.error.message);
    return ((res.data ?? []) as { user_id: string; name: string; role: GroupMemberRole; notify: boolean }[]).map((r) => ({
      userId: r.user_id,
      name: r.name,
      role: r.role,
      notify: r.notify,
    }));
  },

  async addGroupMember(groupId, userId, role) {
    const sb = requireSupabase();
    const { error } = await sb
      .from('group_members')
      .upsert({ group_id: groupId, user_id: userId, role }, { onConflict: 'group_id,user_id' });
    if (error) throw new Error(error.message);
  },

  async removeGroupMember(groupId, userId) {
    const sb = requireSupabase();
    const { error } = await sb.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
    if (error) throw new Error(error.message);
  },

  async setGroupNotify(groupId, notify) {
    const sb = requireSupabase();
    const { error } = await sb.rpc('set_group_notify', { gid: groupId, want: notify });
    if (error) throw new Error(error.message);
  },

  async getMyGroupMembership(groupId) {
    const sb = requireSupabase();
    const uid = await currentUserId();
    if (!uid) return { isMember: false, role: null, notify: true };
    const res = await sb
      .from('group_members')
      .select('role, notify')
      .eq('group_id', groupId)
      .eq('user_id', uid)
      .maybeSingle();
    if (res.error) throw new Error(res.error.message);
    if (!res.data) return { isMember: false, role: null, notify: true };
    return { isMember: true, role: res.data.role as GroupMemberRole, notify: Boolean(res.data.notify) };
  },
};
