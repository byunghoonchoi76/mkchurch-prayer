import { Platform } from 'react-native';

import { requireSupabase, hasSupabaseConfig } from '@/lib/supabase';

/** 주보 원본 이미지를 담는 Supabase Storage 버킷 (supabase/storage.sql 참고) */
export const BULLETIN_BUCKET = 'bulletins';

/** base64 문자열을 업로드에 쓸 수 있는 바이트 배열로 바꿉니다. */
function base64ToBytes(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array((clean.length * 3) / 4 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0));

  let byteIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const chunk =
      (chars.indexOf(clean[i]) << 18) |
      (chars.indexOf(clean[i + 1]) << 12) |
      (chars.indexOf(clean[i + 2]) << 6) |
      chars.indexOf(clean[i + 3]);

    if (byteIndex < bytes.length) bytes[byteIndex++] = (chunk >> 16) & 0xff;
    if (byteIndex < bytes.length) bytes[byteIndex++] = (chunk >> 8) & 0xff;
    if (byteIndex < bytes.length) bytes[byteIndex++] = chunk & 0xff;
  }
  return bytes;
}

function extensionFor(mimeType: string | undefined, fileName: string | undefined): string {
  const fromName = fileName?.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 4) return fromName;
  if (mimeType?.includes('png')) return 'png';
  if (mimeType?.includes('webp')) return 'webp';
  if (mimeType?.includes('heic')) return 'heic';
  return 'jpg';
}

export interface PickedImage {
  uri: string;
  base64?: string | null;
  mimeType?: string;
  fileName?: string;
}

/**
 * (웹 전용) 사진을 캔버스로 다시 그려 가로·세로 최대 1600px 로 줄이고 JPEG 로 압축합니다.
 * 포스터 한 장이 보통 3~8MB → 200~400KB 수준으로 줄어 저장소·전송량을 아낍니다.
 * 캔버스를 쓸 수 없으면 원본을 그대로 올립니다.
 */
async function shrinkForWeb(uri: string, maxEdge = 1600, quality = 0.8): Promise<{ body: Blob; contentType: string; extension: string }> {
  const srcBlob = await (await fetch(uri)).blob();
  try {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
      return { body: srcBlob, contentType: srcBlob.type || 'image/jpeg', extension: 'jpg' };
    }
    const bitmap = await createImageBitmap(srcBlob);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { body: srcBlob, contentType: srcBlob.type || 'image/jpeg', extension: 'jpg' };
    ctx.drawImage(bitmap, 0, 0, w, h);
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (out) return { body: out, contentType: 'image/jpeg', extension: 'jpg' };
  } catch {
    // 아래에서 원본으로 처리
  }
  return { body: srcBlob, contentType: srcBlob.type || 'image/jpeg', extension: 'jpg' };
}

/**
 * 고른 사진을 Supabase Storage(bulletins 버킷) 의 `folder` 아래에 올리고, 공개 주소를 돌려줍니다.
 * - 웹에서는 올리기 전에 자동으로 리사이즈·압축합니다.
 * - Supabase 를 연결하지 않은 샘플 모드에서는 기기 안의 주소를 그대로 씁니다.
 */
export async function uploadImage(image: PickedImage, folder = ''): Promise<string> {
  if (!hasSupabaseConfig) {
    // 샘플 모드: 올릴 곳이 없으므로 이 기기에서만 보이는 주소를 사용합니다.
    return image.uri;
  }

  const supabase = requireSupabase();
  const prefix = folder ? `${folder.replace(/\/$/, '')}/` : '';
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let body: Blob | Uint8Array;
  let contentType: string;
  let extension: string;
  if (Platform.OS === 'web') {
    const shrunk = await shrinkForWeb(image.uri);
    body = shrunk.body;
    contentType = shrunk.contentType;
    extension = shrunk.extension;
  } else {
    // 앱(iOS·안드로이드): 사진 picker 의 quality 로 이미 압축된 base64 를 그대로 올립니다.
    body = base64ToBytes(image.base64 ?? '');
    extension = extensionFor(image.mimeType, image.fileName);
    contentType = image.mimeType ?? `image/${extension === 'jpg' ? 'jpeg' : extension}`;
  }

  const path = `${prefix}${new Date().toISOString().slice(0, 10)}/${name}.${extension}`;
  const { error } = await supabase.storage.from(BULLETIN_BUCKET).upload(path, body, {
    contentType,
    upsert: false,
  });
  if (error) {
    if (/bucket/i.test(error.message)) {
      throw new Error('저장소가 준비되지 않았습니다. supabase/storage.sql 을 실행해 주세요.');
    }
    if (/policy|permission|unauthorized/i.test(error.message)) {
      throw new Error('업로드 권한이 없습니다. 로그인했는지 확인해 주세요.');
    }
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(BULLETIN_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** 주보 사진 업로드 (기존 호출 호환) */
export function uploadBulletinImage(image: PickedImage): Promise<string> {
  return uploadImage(image, '');
}

/** 교회 소식 포스터 업로드 */
export function uploadAnnouncementImage(image: PickedImage): Promise<string> {
  return uploadImage(image, 'announcements');
}

/** 소통방 사진 업로드 */
export function uploadChatImage(image: PickedImage): Promise<string> {
  return uploadImage(image, 'chat');
}

/** 우리 저장소(bulletins 버킷)의 파일이면 지웁니다. 다른 주소는 건드리지 않습니다. (실패해도 무시) */
export async function deleteImage(publicUrl: string): Promise<void> {
  if (!hasSupabaseConfig || !publicUrl) return;

  const marker = `/storage/v1/object/public/${BULLETIN_BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  if (index < 0) return; // 우리 저장소 파일이 아니면 건드리지 않습니다.

  const path = decodeURIComponent(publicUrl.slice(index + marker.length));
  try {
    await requireSupabase().storage.from(BULLETIN_BUCKET).remove([path]);
  } catch {
    // 지우지 못해도 화면에서는 이미 빠졌으므로 넘어갑니다.
  }
}

/** 기존 호출 호환 (deleteImage 와 동일) */
export const deleteBulletinImage = deleteImage;
