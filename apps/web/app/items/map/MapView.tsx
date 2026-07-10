// 지도 탐색 화면의 클라이언트 로직 — 네이버 Web Dynamic Map 스크립트 로드, 카메라 idle마다 bbox 재조회,
// 줌에 따라 클러스터 버블/개별 마커(가격 캡션) 전환, 마커 클릭 시 물건 상세로 이동한다 (모바일 F-01과 동일 문법).
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { formatWonCompact } from '../format';
import { encodeItemId } from '../item-id';
import { clusterPoints, type ClusterInput } from './cluster';
import styles from './page.module.css';

const NCP_MAPS_CLIENT_ID = process.env.NEXT_PUBLIC_NCP_MAPS_CLIENT_ID;
const MAP_SCRIPT_SRC = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NCP_MAPS_CLIENT_ID ?? ''}`;

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
  minimumSalePrice: number | null;
  lng: number | null;
  lat: number | null;
}

type ScriptState = 'loading' | 'ready' | 'error';
type FetchState = 'loading' | 'idle' | 'error';

function itemKey(item: { courtOfficeCode: string; caseNo: string; itemNo: string }): string {
  return `${item.courtOfficeCode}_${item.caseNo}_${item.itemNo}`;
}

function markerHtml(priceLabel: string | null): string {
  return `<div class="${styles.marker}"><span class="${styles.markerDot}"></span>${
    priceLabel ? `<span class="${styles.markerPrice}">${priceLabel}</span>` : ''
  }</div>`;
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
      const data = (await response.json()) as AuctionItemPin[];
      if (requestIdRef.current !== requestId) return; // 그 사이 더 최신 요청이 시작됐으면 이 응답은 버린다
      setItems(data);
      setFetchState('idle');
    } catch {
      if (requestIdRef.current !== requestId) return;
      setFetchState('error');
    }
  }, []);

  const handleIdle = useCallback(
    (map: naver.maps.Map) => {
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
    if (idleListenerRef.current && window.naver?.maps) {
      window.naver.maps.Event.removeListener(idleListenerRef.current);
    }
    idleListenerRef.current = null;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    mapRef.current?.destroy();
    mapRef.current = null;
  }, []);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      cleanupMap();
    },
    [cleanupMap],
  );

  // 물건 목록이 바뀔 때마다 기존 마커를 지우고 현재 줌에 맞춰 클러스터 버블 또는 개별 마커를 다시 그린다.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof window === 'undefined' || !window.naver?.maps) return;
    const naverMaps = window.naver.maps;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    const withCoords = items.filter(
      (item): item is AuctionItemPin & { lng: number; lat: number } => item.lng !== null && item.lat !== null,
    );
    const zoom = map.getZoom();

    if (zoom >= CAPTION_ZOOM) {
      for (const item of withCoords) {
        const priceLabel = item.minimumSalePrice !== null ? formatWonCompact(item.minimumSalePrice) : null;
        const marker = new naverMaps.Marker({
          position: new naverMaps.LatLng(item.lat, item.lng),
          map,
          icon: { content: markerHtml(priceLabel), anchor: new naverMaps.Point(28, 12) },
        });
        naverMaps.Event.addListener(marker, 'click', () => goToDetail(item));
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
    fetchState === 'loading' ? '조회 중...' : fetchState === 'error' ? '불러오기 실패' : `이 지역 ${items.length}건`;

  return (
    <main className={styles.page}>
      <Script
        key={scriptRetryKey}
        src={MAP_SCRIPT_SRC}
        strategy="afterInteractive"
        onReady={handleScriptReady}
        onError={() => setScriptState('error')}
      />

      <div ref={mapElementRef} className={styles.map} />

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
