import { useEffect, useState } from 'react';

import { fetchYouTubeTitle } from '@/lib/youtube';

/**
 * 저장된 제목이 있으면 그대로 쓰고, 비어 있으면 유튜브에서 실제 제목을 가져옵니다.
 * (관리자가 제목을 따로 적지 않아도 영상 제목이 그대로 보입니다.)
 */
export function useYouTubeTitle(
  mediaUrl: string,
  storedTitle: string | null | undefined,
  fallback = '설교 영상',
): string {
  const stored = (storedTitle ?? '').trim();
  const [fetched, setFetched] = useState<string>();

  useEffect(() => {
    if (stored) return;
    let active = true;
    fetchYouTubeTitle(mediaUrl).then((title) => {
      if (active && title) setFetched(title);
    });
    return () => {
      active = false;
    };
  }, [mediaUrl, stored]);

  return stored || fetched || fallback;
}
