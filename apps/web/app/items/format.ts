// 물건·권리분석 화면 공용 포맷터
export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

// 지도 마커 캡션용 축약 표기 — 예: 123,000,000 → "1억 2,300만" (apps/mobile/src/lib/format.ts:13-20 이식,
// 모바일은 Hermes에 Intl 그룹핑이 없어 정규식으로 직접 구현하지만 웹은 기존 formatWon과 동일하게 toLocaleString 사용)
export function formatWonCompact(amount: number): string {
  const value = Math.round(amount);
  const eok = Math.floor(value / 100_000_000);
  const man = Math.floor((value % 100_000_000) / 10_000);
  if (eok > 0) return man > 0 ? `${eok}억 ${man.toLocaleString('ko-KR')}만` : `${eok}억`;
  if (man > 0) return `${man.toLocaleString('ko-KR')}만`;
  return `${value.toLocaleString('ko-KR')}원`;
}

export function computeMinimumBidRate(
  appraisalAmount: number | null,
  minimumSalePrice: number | null,
): number | null {
  if (!appraisalAmount || minimumSalePrice === null) return null;
  return Math.round((minimumSalePrice / appraisalAmount) * 100);
}

/** 감정가 대비 하락률 라벨("↓36%"). 신건처럼 하락이 없으면 붙일 게 없어 null. */
export function formatDropRate(
  appraisalAmount: number | null,
  minimumSalePrice: number | null,
): string | null {
  const rate = computeMinimumBidRate(appraisalAmount, minimumSalePrice);
  if (rate === null || rate >= 100) return null;
  return `↓${100 - rate}%`;
}

/** KST 기준 달력 날짜(YYYY-MM-DD). 기기 타임존과 무관하게 매각기일을 세려면 여기서 맞춰야 한다. */
function kstDate(value: Date): string {
  return value.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

/**
 * 매각기일까지 남은 일수 라벨. 시각이 아니라 **KST 달력 날짜** 차이로 센다 —
 * "오늘 오후 2시"와 "내일 오전 10시"는 24시간이 안 되지만 D-0과 D-1이어야 한다.
 * 기일이 지난 물건은 null (지도에 남아 있을 수 있다).
 */
export function formatDday(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const bid = new Date(iso);
  if (Number.isNaN(bid.getTime())) return null;
  const days = Math.round(
    (Date.parse(`${kstDate(bid)}T00:00:00Z`) - Date.parse(`${kstDate(now)}T00:00:00Z`)) / 86_400_000,
  );
  if (days < 0) return null;
  return days === 0 ? 'D-day' : `D-${days}`;
}

export function formatBidDatetime(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
