// 마커 클릭 시 지도 옆에 열리는 패널 — 페이지를 떠나지 않고 물건을 확인한다.
// 지도 탐색 중 화면이 통째로 바뀌면 줌·위치·주변 물건이라는 맥락이 끊긴다(네이버 지도와 같은 방식).
//
// 탭 두 개를 한 패널에서 갈아 끼운다: 요약(상세 페이지와 같은 내용) ↔ 권리분석.
// 권리분석 탭에서는 패널이 넓어진다 — 권리 표는 행마다 종류·내용·인수여부 세 덩어리라
// 380px에서는 줄바꿈으로 뭉개진다. 넓히는 이유가 "멋있어서"가 아니라 읽히지 않아서다.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FavoriteButton } from '../components/FavoriteButton';
import { RightsAnalysisView } from '../components/RightsAnalysisView';
import {
  computeMinimumBidRate,
  formatAreaWithKind,
  formatBidDatetime,
  formatDday,
  formatDropRate,
  formatWon,
  formatWonCompact,
} from '../format';
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
  areaKind: string | null;
  areaM2: number | null;
  bulkSale: boolean;
  address: string | null;
  appraisalAmount: number | null;
  minimumSalePrice: number | null;
  failedBidCount: number | null;
  bidDatetime: string | null;
  assumedRightsKind: string | null;
  riskFlags: string[];
  tenantCount: number | null;
}

type PanelView = 'summary' | 'rights';

export function ItemDetailPanel({ item, onClose }: { item: PanelItem; onClose: () => void }) {
  const [photos, setPhotos] = useState<AuctionItemPhoto[]>([]);
  const [view, setView] = useState<PanelView>('summary');
  const pathname = usePathname();
  const id = encodeItemId(item);

  // 다른 마커를 누르면 요약부터 다시 본다 — 앞 물건의 권리분석 화면이 그대로 남으면
  // 새 물건의 분석으로 오인된다.
  useEffect(() => {
    setView('summary');
  }, [item.courtOfficeCode, item.caseNo, item.itemNo]);

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

  // Esc — 권리분석까지 들어갔으면 한 단계만 되돌린다. 넓어진 패널이 통째로 닫히면
  // 방금 보던 물건을 지도에서 다시 찾아야 한다.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (view === 'rights') setView('summary');
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, view]);

  const usage = shortUsageName(item.usageName);
  const dday = formatDday(item.bidDatetime);
  const drop = formatDropRate(item.appraisalAmount, item.minimumSalePrice);
  const minimumBidRate = computeMinimumBidRate(item.appraisalAmount, item.minimumSalePrice);
  const bidDatetimeLabel = formatBidDatetime(item.bidDatetime);
  const rights = assumedRightsLabel(item.assumedRightsKind);
  const tenants = tenantLabel(item.tenantCount);
  const flags = riskFlagLabels(item.riskFlags);
  const noticeMissing = rights === null && tenants === null && flags.length === 0;

  // 면적은 평·㎡ 둘 다 — 평이 익숙한 사람과 ㎡가 익숙한 사람이 갈린다.
  const areaText = formatAreaWithKind(item.areaM2, item.areaKind);

  const meta = [
    usage,
    areaText,
    item.failedBidCount !== null ? `유찰 ${item.failedBidCount}회` : null,
  ].filter((value): value is string => value !== null);

  return (
    <aside
      className={view === 'rights' ? `${styles.panel} ${styles.panelWide}` : styles.panel}
      aria-label="물건 정보"
    >
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

      <div className={styles.tabs} role="tablist" aria-label="물건 정보 구획">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'summary'}
          className={view === 'summary' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => setView('summary')}
        >
          요약
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'rights'}
          className={view === 'rights' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          onClick={() => setView('rights')}
        >
          권리분석
        </button>
      </div>

      {view === 'summary' ? (
        <>
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
            <div className={styles.appraisal}>
              {item.appraisalAmount !== null ? `감정가 ${formatWonCompact(item.appraisalAmount)}` : null}
              {minimumBidRate !== null ? (
                <span className={styles.minRate}>최저가율 {minimumBidRate}%</span>
              ) : null}
            </div>
          </div>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>매각물건명세서</h3>
            {noticeMissing ? (
              <p className={styles.unknown}>
                아직 명세서를 받지 못했어요. 인수할 권리가 없다는 뜻이 아니라 확인되지 않았다는
                뜻이에요.
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
              <span className={styles.specsLabel}>사건번호</span>
              <span className={styles.specsValue}>{item.caseNo}</span>
              <span className={styles.specsLabel}>물건종류</span>
              <span className={styles.specsValue}>{item.usageName ?? '정보 없음'}</span>
              <span className={styles.specsLabel}>면적</span>
              <span className={styles.specsValue}>{areaText ?? '정보 없음'}</span>
              <span className={styles.specsLabel}>매각기일</span>
              <span className={styles.specsValue}>{bidDatetimeLabel ?? '정보 없음'}</span>
              <span className={styles.specsLabel}>유찰</span>
              <span className={styles.specsValue}>
                {item.failedBidCount !== null ? `${item.failedBidCount}회` : '정보 없음'}
              </span>
              <span className={styles.specsLabel}>담당계</span>
              <span className={styles.specsValue}>{item.deptName ?? '정보 없음'}</span>
            </div>
          </section>
        </>
      ) : (
        <div className={styles.rightsBody}>
          {/* 이 물건의 최저가를 넘겨 예시 요약이 실제 물건 정보와 어긋나 보이지 않게 한다. */}
          <RightsAnalysisView itemId={id} basis={{ minimumSalePrice: item.minimumSalePrice }} />
        </div>
      )}

      <div className={styles.actions}>
        <FavoriteButton
          courtOfficeCode={item.courtOfficeCode}
          caseNo={item.caseNo}
          itemNo={item.itemNo}
          currentPath={pathname}
        />
        <Link href={`/items/${id}`} className={styles.secondaryLink}>
          물건 상세 페이지
        </Link>
      </div>
    </aside>
  );
}
