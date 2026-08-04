// 물건 카드·상세 공용 포맷터 — Hermes의 Intl 구현에 의존하지 않도록 수동으로 구현한다
// (웹 apps/web의 format.ts와 같은 규칙이지만 toLocaleString 대신 순수 로직 사용).

const group = (value: number): string =>
  value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function formatWon(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}${group(Math.abs(Math.round(amount)))}원`;
}

// 지도 마커 캡션용 축약 표기 — 예: 123,000,000 → "1억 2,300만"
export function formatWonCompact(amount: number): string {
  const value = Math.round(amount);
  const eok = Math.floor(value / 100_000_000);
  const man = Math.floor((value % 100_000_000) / 10_000);
  if (eok > 0) return man > 0 ? `${eok}억 ${group(man)}만` : `${eok}억`;
  if (man > 0) return `${group(man)}만`;
  return `${group(value)}원`;
}

export function computeMinimumBidRate(
  appraisalAmount: number | null,
  minimumSalePrice: number | null,
): number | null {
  if (!appraisalAmount || minimumSalePrice === null) return null;
  return Math.round((minimumSalePrice / appraisalAmount) * 100);
}

/** 감정가 대비 하락률 라벨("↓36%"). 신건처럼 하락이 없으면 붙일 게 없어 null. (웹 format.ts와 같은 규칙) */
export function formatDropRate(
  appraisalAmount: number | null,
  minimumSalePrice: number | null,
): string | null {
  const rate = computeMinimumBidRate(appraisalAmount, minimumSalePrice);
  if (rate === null || rate >= 100) return null;
  return `↓${100 - rate}%`;
}

/** 1평 = 400/121 ㎡ (약 3.3058). (웹 format.ts와 같은 상수) */
const M2_PER_PYEONG = 400 / 121;

export function formatPyeong(areaM2: number | null): string | null {
  if (areaM2 === null || areaM2 <= 0) return null;
  return `${(areaM2 / M2_PER_PYEONG).toFixed(1)}평`;
}

export function formatAreaM2(areaM2: number | null): string | null {
  if (areaM2 === null || areaM2 <= 0) return null;
  return `${areaM2.toFixed(1)}㎡`;
}

/** 단위면적당 가격(만원). 평당·㎡당을 같은 규칙으로 뽑는다. (웹 format.ts와 같은 규칙) */
export function formatUnitPrice(
  amount: number | null,
  areaM2: number | null,
  unit: 'pyeong' | 'm2',
): string | null {
  if (amount === null || areaM2 === null || areaM2 <= 0) return null;
  const area = unit === 'pyeong' ? areaM2 / M2_PER_PYEONG : areaM2;
  const manwon = Math.round(amount / area / 10_000);
  const grouped = manwon.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${unit === 'pyeong' ? '평당' : '㎡당'} ${grouped}만`;
}

/** 면적 종류 → 화면 라벨. 종류마다 평당가의 분모가 달라 라벨을 반드시 구분해 적는다. */
const AREA_KIND_LABEL: Record<string, string> = {
  AGGREGATE: '전용',
  LAND: '토지',
  BUILDING: '연면적',
};

/**
 * "전용 8.5평 (28.2㎡)" 형태. 종류를 앞에 붙이는 이유는 토지 평당가와 건물 평당가가
 * 두 배 가까이 차이 날 수 있어, 무엇의 면적인지 밝히지 않으면 비교할 수 없기 때문이다.
 */
export function formatAreaWithKind(areaM2: number | null, areaKind: string | null): string | null {
  const pyeong = formatPyeong(areaM2);
  const m2 = formatAreaM2(areaM2);
  if (pyeong === null || m2 === null) return null;
  const kind = areaKind === null ? null : (AREA_KIND_LABEL[areaKind] ?? null);
  return kind === null ? `${pyeong} (${m2})` : `${kind} ${pyeong} (${m2})`;
}

/** "전용 평당 3,105만" 형태. 분모가 무엇인지 라벨에 드러낸다.
 *
 * 일괄매각(bulkSale)이면 **null을 준다** — 면적은 목적물 하나 것인데 최저가는 묶음 전체라
 * 단위가 어긋난다(실측: 34.32㎡ 상가에 최저가 340억 → 평당 32.8억). 계산이 산술적으로는
 * 되지만 뜻이 없는 값이라 아예 내지 않는다.
 */
export function formatUnitPriceWithKind(
  amount: number | null,
  areaM2: number | null,
  areaKind: string | null,
  unit: 'pyeong' | 'm2',
  bulkSale = false,
): string | null {
  if (bulkSale) return null;
  const base = formatUnitPrice(amount, areaM2, unit);
  if (base === null) return null;
  const kind = areaKind === null ? null : (AREA_KIND_LABEL[areaKind] ?? null);
  return kind === null ? base : `${kind} ${base}`;
}

const pad = (n: number): string => n.toString().padStart(2, '0');

/** KST 기준 달력 날짜의 자정 시각(ms). Hermes에 Intl 타임존이 없어 +9시간을 직접 더한다. */
function kstMidnight(value: Date): number {
  const kst = new Date(value.getTime() + 9 * 60 * 60 * 1000);
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
}

/**
 * 매각기일까지 남은 일수 라벨. 시각 차가 아니라 **KST 달력 날짜** 차로 센다 —
 * "오늘 오후 2시"와 "내일 오전 10시"는 24시간이 안 되지만 D-0과 D-1이어야 한다.
 * 기일이 지났으면 null. (웹 format.ts와 같은 규칙)
 */
export function formatDday(
  iso: string | null,
  now: Date = new Date(),
): string | null {
  if (!iso) return null;
  const bid = new Date(iso);
  if (Number.isNaN(bid.getTime())) return null;
  const days = Math.round((kstMidnight(bid) - kstMidnight(now)) / 86_400_000);
  if (days < 0) return null;
  return days === 0 ? 'D-day' : `D-${days}`;
}

// 매각기일은 법적으로 중요한 값이라 기기 타임존과 무관하게 항상 KST(+09:00)로 표기한다.
export function formatBidDatetime(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = pad(kst.getUTCMonth() + 1);
  const d = pad(kst.getUTCDate());
  const hh = pad(kst.getUTCHours());
  const mm = pad(kst.getUTCMinutes());
  return `${y}. ${m}. ${d}. ${hh}:${mm}`;
}
