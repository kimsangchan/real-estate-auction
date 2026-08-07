// 입찰가 직접 입력 — "내가 이 가격을 쓰면 결국 얼마가 드나"를 그 자리에서 계산한다.
// 상세 화면 전용(패널은 공간이 좁다). 계산은 API가 한다 — 취득세율·명도 구간 정의를
// 클라이언트에 복제하면 두 곳이 갈라진다.
'use client';

import { useState } from 'react';
import {
  formatRatioRange,
  formatWonRangeCompact,
  type Affordability,
} from '../affordability';
import { formatWon } from '../format';
import styles from './AffordabilityCustomBid.module.css';

export function AffordabilityCustomBid({
  courtOfficeCode,
  caseNo,
  itemNo,
}: {
  courtOfficeCode: string;
  caseNo: string;
  itemNo: string;
}) {
  const [raw, setRaw] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Affordability | null>(null);

  const bidPrice = Number(raw.replace(/[,\s]/g, ''));
  const valid = Number.isFinite(bidPrice) && bidPrice > 0;

  async function compute() {
    if (!valid || pending) return;
    setPending(true);
    setError(null);
    try {
      const base = `/api/auction-items/${encodeURIComponent(courtOfficeCode)}/${encodeURIComponent(caseNo)}/${encodeURIComponent(itemNo)}`;
      const response = await fetch(`${base}/affordability?bidPrice=${bidPrice}`);
      if (!response.ok) throw new Error(String(response.status));
      setResult((await response.json()) as Affordability);
    } catch {
      setError('계산하지 못했어요. 잠시 뒤 다시 시도해주세요.');
    } finally {
      setPending(false);
    }
  }

  const custom = result?.scenarios.find((s) => s.kind === 'CUSTOM') ?? null;

  return (
    <section className={styles.root}>
      <h3 className={styles.title}>입찰가를 직접 넣어보기</h3>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void compute();
        }}
      >
        <input
          className={styles.input}
          inputMode="numeric"
          placeholder="입찰가 (원)"
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          aria-label="입찰가 (원)"
        />
        <button className={styles.button} type="submit" disabled={!valid || pending}>
          {pending ? '계산 중...' : '계산'}
        </button>
      </form>
      {valid ? <p className={styles.echo}>{formatWon(bidPrice)}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {custom ? (
        <p className={styles.result}>
          인수·취득세·등기·명도비까지 총 {formatWonRangeCompact(custom.totalWithExtras)}
          {result?.assumedIsLowerBound ? ' 이상' : ''}
          {custom.appraisalRatio ? ` · 감정가의 ${formatRatioRange(custom.appraisalRatio)}` : ''}
        </p>
      ) : null}
    </section>
  );
}
