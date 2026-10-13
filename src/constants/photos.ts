import type { ImageSourcePropType } from 'react-native';

/**
 * 앱에 포함된(로컬) 이미지. 인터넷 없이도 항상 보입니다.
 */
export const LocalPhotos = {
  // 장례(부고) 공지 카드에 쓰는 국화 이미지
  funeral: require('@/assets/images/funeral-chrysanthemum.jpg') as ImageSourcePropType,
  // 교회 비전 히어로 — 손으로 십자가를 만든 공동체 사진
  vision: require('@/assets/images/vision-cross.jpg') as ImageSourcePropType,
  // 성경 읽기표 히어로 — 가을 숲의 펼쳐진 성경책
  reading: require('@/assets/images/reading-hero.jpg') as ImageSourcePropType,
} as const;

/**
 * 화면 배경으로 쓰는 무료 스톡 사진 주소.
 * 앱이 실행되는 기기에서 불러오며, 못 불러오면 따뜻한 그라데이션이 대신 보입니다.
 * 교회 사진으로 바꾸려면 이 주소만 교체하면 됩니다. (Unsplash · 자유 이용)
 */
export const Photos = {
  // 잔잔한 자연/빛 — 이 주의 말씀 히어로
  heroWorship: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=900&q=60',
  // 성경과 빛
  bible: 'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=900&q=60',
  // 공동체/손 모음
  community: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=800&q=60',
} as const;
