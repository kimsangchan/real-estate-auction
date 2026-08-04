// 지도 탐색 화면의 클라이언트 로직 — 네이버 Web Dynamic Map 스크립트 로드, 카메라 idle마다 bbox 재조회,
// 줌에 따라 클러스터 버블/개별 마커(가격 캡션) 전환, 마커 클릭 시 물건 상세로 이동한다 (모바일 F-01과 동일 문법).
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { formatDropRate, formatWonCompact } from '../format';
import { encodeItemId } from '../item-id';
import { clusterPoints, type ClusterInput } from './cluster';
import { ItemHoverCard } from './ItemHoverCard';
import styles from './page.module.css';

const NCP_MAPS_CLIENT_ID = process.env.NEXT_PUBLIC_NCP_MAPS_CLIENT_ID;
const MAP_SCRIPT_SRC = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NCP_MAPS_CLIENT_ID ?? ''}`;
// API bbox 조회 상한 (apps/api auction-items.controller.ts BBOX_LIMIT과 동일 값) — 도달 시 "N건+"로 표시
const BBOX_LIMIT = 500;

// 초기 카메라: 서울시청 (WP-07 §1-9)
const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 };
const INITIAL_ZOOM = 12;
// 이 줌 이상에서는 클러스터 대신 개별 마커 + 가격 캡션을 보여준다 (모바일 CAPTION_ZOOM과 동일, §1-6)
const CAPTION_ZOOM = 15;
const IDLE_DEBOUNCE_MS = 300;

interface AuctionItemPin {
  courtOfficeCode: string;
  caseNo: string;
  itemNo: string;
  address: string | null;
  usageName: string | null;
  appraisalAmount: number | null;
  minimumSalePrice: number | null;
  failedBidCount: number | null;
  bidDatetime: string | null;
  assumedRightsKind: string | null;
  riskFlags: string[];
  tenantCount: number | null;
  lng: number | null;
  lat: number | null;
}

type ScriptState = 'loading' | 'ready' | 'error';
type FetchState = 'loading' | 'idle' | 'error';

function itemKey(item: { courtOfficeCode: string; caseNo: string; itemNo: string }): string {
  return `${item.courtOfficeCode}_${item.caseNo}_${item.itemNo}`;
}

function markerHtml(priceLabel: string | null, drop: string | null): string {
  return `<div class="${styles.marker}"><span class="${styles.markerDot}"></span>${
    priceLabel ? `<span class="${styles.markerPrice}">${priceLabel}</span>` : ''
  }${drop ? `<span class="${styles.markerDrop}">${drop}</span>` : ''}</div>`;
}

function clusterHtml(count: number): string {
  return `<div class="${styles.clusterBubble}"><span class="${styles.clusterCount}">${count}</span></div>`;
}

export function MapView() {
  const router = useRouter();
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<naver.maps.Map | null>(null);
  const idleListenerRef = useRef<naver.maps.MapEventListener | null>(null);
  const markersRef = useRef<naver.maps.Marker[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0); // bbox 요청이 역전 응답되어도 최신 결과만 반영하기 위한 순번

  const [scriptState, setScriptState] = useState<ScriptState>('loading');
  const [scriptRetryKey, setScriptRetryKey] = useState(0);
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [items, setItems] = useState<AuctionItemPin[]>([]);
  const [hovered, setHovered] = useState<{
    item: AuctionItemPin;
    left: number;
    top: number;
  } | null>(null);

  const goToDetail = useCallback(
    (item: AuctionItemPin) => {
      router.push(`/items/${encodeItemId({ courtOfficeCode: item.courtOfficeCode, caseNo: item.caseNo, itemNo: item.itemNo })}`);
    },
    [router],
  );

  const loadBbox = useCallback(async (bounds: naver.maps.LatLngBounds) => {
    const requestId = ++requestIdRef.current;
    setFetchState('loading');
    const params = new URLSearchParams({
      minLng: String(bounds.getSW().lng()),
      minLat: String(bounds.getSW().lat()),
      maxLng: String(bounds.getNE().lng()),
      maxLat: String(bounds.getNE().lat()),
    });
    try {
      const response = await fetch(`/api/auction-items/bbox?${params.toString()}`);
      if (!response.ok) throw new Error(`bbox 조회 실패: ${response.status}`);
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error('bbox 응답이 배열이 아님');
      if (requestIdRef.current !== requestId) return; // 그 사이 더 최신 요청이 시작됐으면 이 응답은 버린다
      setItems(data as AuctionItemPin[]);
      setFetchState('idle');
    } catch {
      if (requestIdRef.current !== requestId) return;
      // 실패 시 이전 범위·줌 기준으로 그린 마커가 잔존하지 않게 지운다 (§1-10: 에러 배너 + 빈 지도).
      setItems([]);
      setFetchState('error');
    }
  }, []);

  const handleIdle = useCallback(
    (map: naver.maps.Map) => {
      // 호버 카드는 마커의 화면 좌표에 고정돼 있어 지도가 움직이면 엉뚱한 곳을 가리킨다 — 닫는다.
      setHovered(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        loadBbox(map.getBounds());
      }, IDLE_DEBOUNCE_MS);
    },
    [loadBbox],
  );

  const handleScriptReady = useCallback(() => {
    if (mapRef.current) return; // React strict mode 등으로 onReady가 중복 호출돼도 지도를 두 번 만들지 않는다
    const element = mapElementRef.current;
    if (!element || typeof window === 'undefined' || !window.naver?.maps) {
      setScriptState('error');
      return;
    }
    const map = new window.naver.maps.Map(element, {
      center: new window.naver.maps.LatLng(SEOUL_CENTER.lat, SEOUL_CENTER.lng),
      zoom: INITIAL_ZOOM,
    });
    mapRef.current = map;
    setScriptState('ready');
    idleListenerRef.current = window.naver.maps.Event.addListener(map, 'idle', () => handleIdle(map));
    handleIdle(map); // 최초 화면도 idle과 동일한 흐름으로 조회한다

    // 브라우저 검증(WP-07 §2-d, map.panBy 호출)용 — 프로덕션 번들에는 포함하지 않는다.
    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as { __auctionMapDebug?: naver.maps.Map }).__auctionMapDebug = map;
    }
  }, [handleIdle]);

  // 네이버 지도 인증 실패(서비스 URL 미등록 등, WP-07 §0)는 스크립트 로드 자체는 성공하고 이 전역
  // 콜백으로만 통지된다 — next/script의 onError로는 잡히지 않아 별도로 등록해야 한다.
  useEffect(() => {
    window.navermap_authFailure = () => setScriptState('error');
    return () => {
      delete window.navermap_authFailure;
    };
  }, []);

  // 지도 인스턴스·리스너·마커를 정리한다 — 언마운트 시와 재시도로 지도를 다시 만들기 직전 둘 다에서 쓴다.
  const cleanupMap = useCallback(() => {
    // 대기 중인 debounce 타이머가 파괴된 map의 getBounds()를 호출하지 않게 먼저 정리한다.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    if (idleListenerRef.current && window.naver?.maps) {
      window.naver.maps.Event.removeListener(idleListenerRef.current);
    }
    idleListenerRef.current = null;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    mapRef.current?.destroy();
    mapRef.current = null;
  }, []);

  useEffect(() => () => cleanupMap(), [cleanupMap]);

  // 물건 목록이 바뀔 때마다 기존 마커를 지우고 현재 줌에 맞춰 클러스터 버블 또는 개별 마커를 다시 그린다.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof window === 'undefined' || !window.naver?.maps) return;
    const naverMaps = window.naver.maps;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    // 마커를 다시 그리면 호버 중이던 마커 객체가 사라진다 — 카드가 유령으로 남지 않게 닫는다.
    setHovered(null);

    const withCoords = items.filter(
      (item): item is AuctionItemPin & { lng: number; lat: number } => item.lng !== null && item.lat !== null,
    );
    const zoom = map.getZoom();

    if (zoom >= CAPTION_ZOOM) {
      // 동일 좌표 물건(같은 건물 다세대 등)이 완전히 겹쳐 아래 마커가 클릭 불가가 되지 않게,
      // 같은 좌표의 두 번째 물건부터 위도를 살짝(≈7m/개) 어긋나게 배치한다.
      const seenCoords = new Map<string, number>();
      for (const item of withCoords) {
        const coordKey = `${item.lng},${item.lat}`;
        const dupIndex = seenCoords.get(coordKey) ?? 0;
        seenCoords.set(coordKey, dupIndex + 1);
        const priceLabel = item.minimumSalePrice !== null ? formatWonCompact(item.minimumSalePrice) : null;
        const marker = new naverMaps.Marker({
          position: new naverMaps.LatLng(item.lat + dupIndex * 0.00006, item.lng),
          map,
          icon: {
            content: markerHtml(
              priceLabel,
              formatDropRate(item.appraisalAmount, item.minimumSalePrice),
            ),
            anchor: new naverMaps.Point(28, 12),
          },
        });
        naverMaps.Event.addListener(marker, 'click', () => goToDetail(item));
        // 호버 카드는 마커 기준 화면 좌표에 띄운다. 지도 컨테이너 안 절대 위치라
        // 지도가 움직이면 좌표가 어긋나므로 카메라가 움직이면 닫는다(아래 idle 핸들러).
        naverMaps.Event.addListener(marker, 'mouseover', () => {
          const projection = map.getProjection();
          const offset = projection.fromCoordToOffset(
            new naverMaps.LatLng(item.lat + dupIndex * 0.00006, item.lng),
          );
          setHovered({ item, left: offset.x, top: offset.y });
        });
        naverMaps.Event.addListener(marker, 'mouseout', () => setHovered(null));
        markersRef.current.push(marker);
      }
      return;
    }

    const points: ClusterInput<AuctionItemPin>[] = withCoords.map((item) => ({
      id: itemKey(item),
      lng: item.lng,
      lat: item.lat,
      data: item,
    }));
    const projection = map.getProjection();
    const features = clusterPoints(points, (lng, lat) => projection.fromCoordToOffset(new naverMaps.LatLng(lat, lng)));

    for (const feature of features) {
      const marker = new naverMaps.Marker({
        position: new naverMaps.LatLng(feature.lat, feature.lng),
        map,
        icon: { content: clusterHtml(feature.count), anchor: new naverMaps.Point(20, 20) },
      });
      naverMaps.Event.addListener(marker, 'click', () => map.setZoom(map.getZoom() + 1, true));
      markersRef.current.push(marker);
    }
  }, [items, goToDetail]);

  const handleRetry = useCallback(() => {
    cleanupMap();
    setScriptState('loading');
    setScriptRetryKey((key) => key + 1);
  }, [cleanupMap]);

  const badgeLabel =
    fetchState === 'loading'
      ? '조회 중...'
      : fetchState === 'error'
        ? '불러오기 실패'
        : `이 지역 ${items.length}건${items.length >= BBOX_LIMIT ? '+' : ''}`;

  // next/script는 src 기준으로 로드 프라미스를 모듈 레벨에 캐시하고 실패도 fulfilled로 삼키므로,
  // key 재마운트만으로는 재요청이 일어나지 않는다(onReady/onError 재호출 없음 — 재시도 영구 고착).
  // 재시도마다 src를 바꿔 캐시를 우회하고 스크립트를 실제로 다시 로드·실행시킨다(인증 실패 복구 포함).
  const mapScriptSrc = scriptRetryKey === 0 ? MAP_SCRIPT_SRC : `${MAP_SCRIPT_SRC}&retry=${scriptRetryKey}`;

  return (
    <main className={styles.page}>
      <Script
        key={scriptRetryKey}
        src={mapScriptSrc}
        strategy="afterInteractive"
        onReady={handleScriptReady}
        onError={() => setScriptState('error')}
      />

      <div ref={mapElementRef} className={styles.map} />

      {hovered ? (
        <ItemHoverCard item={hovered.item} left={hovered.left} top={hovered.top} />
      ) : null}

      {scriptState === 'ready' ? (
        <p className={`${styles.badge} ${fetchState === 'error' ? styles.badgeError : ''}`}>{badgeLabel}</p>
      ) : null}

      {scriptState === 'error' ? (
        <div className={styles.scriptError}>
          <p className={styles.scriptErrorText}>지도를 불러오지 못했어요.</p>
          <button type="button" className={styles.retryButton} onClick={handleRetry}>
            다시 시도
          </button>
        </div>
      ) : null}
    </main>
  );
}
