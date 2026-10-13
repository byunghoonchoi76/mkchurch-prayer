/**
 * '농협 382-01-017978 (예금주: 구리 목양교회)' 같은 한 줄 문자열에서
 * 은행 · 계좌번호 · 예금주를 뽑아냅니다. 형식이 조금 달라도 최대한 읽어 냅니다.
 */
export interface ParsedAccount {
  bank: string;
  number: string;
  holder: string;
  /** 복사에 쓸 계좌번호 (숫자·하이픈만). 못 찾으면 원본 전체 */
  copyText: string;
}

export function parseAccount(raw: string): ParsedAccount {
  const text = raw.trim();

  // 예금주: 괄호 안 '예금주: ...' 또는 그냥 괄호 안 내용
  const holderMatch = text.match(/\(?\s*예금주\s*[:：]?\s*([^)]+?)\s*\)?$/);
  const holder = holderMatch ? holderMatch[1].trim() : '';

  // 계좌번호: 숫자와 하이픈이 이어진 가장 긴 덩어리
  const numberMatch = text.match(/[\d]{2,}[\d-]{4,}/);
  const number = numberMatch ? numberMatch[0] : '';

  // 은행: 계좌번호 앞의 첫 단어
  let bank = '';
  if (numberMatch) {
    bank = text.slice(0, numberMatch.index).trim();
  } else {
    bank = text.split(/\s+/)[0] ?? '';
  }

  return {
    bank,
    number,
    holder,
    copyText: number || text,
  };
}
