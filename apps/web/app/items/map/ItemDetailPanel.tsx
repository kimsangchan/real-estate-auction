// 마커 클릭 시 지도 옆에 열리는 패널 — 페이지를 떠나지 않고 물건을 확인한다.
// 지도 탐색 중 화면이 통째로 바뀌면 줌·위치·주변 물건이라는 맥락이 끊긴다(네이버 지도와 같은 방식).
//
// 호버 카드가 "이 마커를 눌러볼지" 정하는 용도라면, 이 패널은 "권리를 확인해볼 물건인지" 정하는
// 용도다. 그래서 명세서 구획과 사진까지 담고, 그보다 깊은 것(권리분석·위험·체크리스트)은 링크로 넘긴다.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDday, formatDropRate, formatWon, formatWonCompact } from '../format';
import { encodeItemId } from '../item-id';
import { assumedRightsLabel, riskFlagLabels, shortUsageName, tenantLabel } from '../notice-labels';
import { photoAlt, photoProxySrc, type AuctionItemPhoto } from '../photo';
import styles from './ItemDetailPanel.module.css';

export interface PanelItem {
  courtOfficeCode: string;
  caseNo: string;
  itemNo: string;
  courtName: string | null;
  deptName: string | null;
  usageName: string | null;
  address: string | null;
  appraisalAmount: number | null;
  minimumSalePrice: number | null;
  failedBidCount: number | null;
  bidDatetime: string | null;
  assumedRightsKind: string | null;
  riskFlags: string[];
  tenantCount: number | null;
}

export function ItemDetailPanel({ item, onClose }: { item: PanelItem; onClose: () => void }) {
  const [photos, setPhotos] = useState<AuctionItemPhoto[]>([]);
  const id = encodeItemId(item);

  // 사진은 bbox 응답에 없어 패널을 열 때만 받는다 — 지도의 수백 건에 미리 붙일 이유가 없다.
  useEffect(() => {
    let cancelled = false;
    setPhotos([]);
    const url = `/api/auction-items/${encodeURIComponent(item.courtOfficeCode)}/${encodeURIComponent(item.caseNo)}/${encodeURIComponent(item.itemNo)}/photos`;
    fetch(url)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: unknown) => {
        if (!cancelled && Array.isArray(data)) setPhotos(data as AuctionItemPhoto[]);
      })
      .catch(() => {
        // 사진은 보조 정보다 — 실패해도 패널의 나머지는 그대로 쓸 수 있게 조용히 넘어간다
      });
    return () => {
      cancelled = true;
    };
  }, [item.courtOfficeCode, item.caseNo, item.itemNo]);

  // Esc로 닫기 — 지도 위 오버레이라 닫는 방법이 X 버튼 하나뿐이면 답답하다.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const usage = shortUsageName(item.usageName);
  const dday = formatDday(item.bidDatetime);
  const drop = formatDropRate(item.appraisalAmount, item.minimumSalePrice);
  const rights = assumedRightsLabel(item.assumedRightsKind);
  const tenants = tenantLabel(item.tenantCount);
  const flags = riskFlagLabels(item.riskFlags);
  const noticeMissing = rights === null && tenants === null && flags.length === 0;

  const meta = [usage, item.failedBidCount !== null ? `유찰 ${item.failedBidCount}회` : null].filter(
    (value): value is string => value !== null,
  );

  return (
    <aside className={styles.panel} aria-label="물건 요약">
      <div className={styles.header}>
        <span className={styles.court}>
          {item.courtName} {item.deptName} · {item.caseNo}
        </span>
        <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">
          ✕
        </button>
      </div>

      <h2 className={styles.address}>{item.address ?? '주소 정보 없음'}</h2>

      <div className={styles.meta}>
        {meta.map((value, index) => (
          <span key={value}>
            {index > 0 ? <span className={styles.metaDivider}>·</span> : null} {value}
          </span>
        ))}
        {dday ? (
          <>
            {meta.length > 0 ? <span className={styles.metaDivider}>·</span> : null}
            <span className={styles.dday}>{dday}</span>
          </>
        ) : null}
      </div>

      {photos.length > 0 ? (
        <div className={styles.photoStrip}>
          {photos.slice(0, 8).map((photo) => (
            // next/image 대신 <img> — 상세 화면과 같은 프록시 경로를 그대로 쓴다
            <img
              key={photo.id}
              className={styles.photo}
              src={photoProxySrc(photo.id)}
              alt={photoAlt(photo)}
              loading="lazy"
            />
          ))}
        </div>
      ) : null}

      <div className={styles.priceBlock}>
        <div className={styles.priceRow}>
          <span className={styles.price}>
            {item.minimumSalePrice !== null ? formatWon(item.minimumSalePrice) : '가격 정보 없음'}
          </span>
          {drop ? <span className={styles.drop}>{drop}</span> : null}
        </div>
        {item.appraisalAmount !== null ? (
          <div className={styles.appraisal}>감정가 {formatWonCompact(item.appraisalAmount)}</div>
        ) : null}
      </div>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>매각물건명세서</h3>
        {noticeMissing ? (
          <p className={styles.unknown}>
            아직 명세서를 받지 못했어요. 인수할 권리가 없다는 뜻이 아니라 확인되지 않았다는 뜻이에요.
          </p>
        ) : (
          <div className={styles.chips}>
            {tenants ? <span className={styles.chip}>{tenants}</span> : null}
            {rights ? <span className={styles.chip}>{rights}</span> : null}
            {flags.map((flag) => (
              <span key={flag} className={styles.chip}>
                {flag}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>물건 개요</h3>
        <div className={styles.specs}>
          <span className={styles.specsLabel}>물건종류</span>
          <span className={styles.specsValue}>{item.usageName ?? '정보 없음'}</span>
          <span className={styles.specsLabel}>담당계</span>
          <span className={styles.specsValue}>{item.deptName ?? '정보 없음'}</span>
        </div>
      </section>

      <div className={styles.actions}>
        <Link href={`/items/${id}/rights-analysis`} className={styles.primaryLink}>
          권리분석 보기
        </Link>
        <Link href={`/items/${id}`} className={styles.secondaryLink}>
          물건 상세 페이지
        </Link>
      </div>
    </aside>
  );
}
