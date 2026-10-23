/**
 * 성도 통계 공통 — 생년월일에서 연령대(10대·20대…)를 구합니다.
 * birthDate 는 'YYYY-MM-DD' 또는 연도가 포함된 자유 입력을 받습니다.
 */

/** 연령대 표시 순서 (통계·명단 공통). '미지정'은 목록에 넣지 않고 맨 뒤에 따로 둡니다. */
export const AGE_GROUP_ORDER = ['10대 미만', '10대', '20대', '30대', '40대', '50대', '60대', '70대 이상'] as const;

/** 생년월일 → 만 나이(대략, 연도 기준). 구할 수 없으면 null. */
export function ageOf(birthDate?: string): number | null {
  if (!birthDate) return null;
  const m = birthDate.match(/(\d{4})/);
  if (!m) return null;
  const year = Number(m[1]);
  if (!Number.isFinite(year)) return null;
  const age = new Date().getFullYear() - year;
  if (age < 0 || age > 120) return null;
  return age;
}

/** 생년월일 → 연령대 라벨. 구할 수 없으면 '미지정'. */
export function ageGroupOf(birthDate?: string): string {
  const age = ageOf(birthDate);
  if (age == null) return '미지정';
  if (age < 10) return '10대 미만';
  const decade = Math.min(70, Math.floor(age / 10) * 10);
  return decade >= 70 ? '70대 이상' : `${decade}대`;
}
