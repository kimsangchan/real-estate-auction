// 물건·권리분석 화면 공용 포맷터
export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

export function computeMinimumBidRate(
  appraisalAmount: number | null,
  minimumSalePrice: number | null,
): number | null {
  if (!appraisalAmount || minimumSalePrice === null) return null;
  return Math.round((minimumSalePrice / appraisalAmount) * 100);
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
