// 지도 홈(F-01) — 서울 중심 네이버 지도에 뷰포트(bbox) 안의 경매 물건을 표시한다.
// 낮은 줌에서는 클러스터(개수 버블)로 겹침을 줄이고, 일정 줌(CAPTION_ZOOM) 이상에서는 화면당 물건이
// 적어 겹치지 않으므로 개별 마커에 가격 캡션을 붙인다. 어느 쪽이든 마커를 탭하면 상세로 이동하고,
// 카메라가 멈출 때마다 현재 화면의 bbox로 재조회한다.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  type ClusterMarkerProp,
  NaverMapMarkerOverlay,
  NaverMapView,
} from '@mj-studio/react-native-naver-map';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  fetchItemsInBbox,
  type AuctionItem,
  type Bbox,
} from '../api/auctionItems';
import { formatDropRate, formatWonCompact } from '../lib/format';
import type { RootStackParamList, TabParamList } from '../navigation';
import { colors, radius, space, text } from '../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'MapHome'>,
  NativeStackScreenProps<RootStackParamList>
>;

// 서울 중심 초기 카메라 + 최초 로딩용 bbox(현재 수집 데이터는 전부 서울이라 서울 전역을 덮는다).
const SEOUL_CENTER = { latitude: 37.5665, longitude: 126.978 };
const SEOUL_BBOX: Bbox = {
  minLng: 126.76,
  minLat: 37.42,
  maxLng: 127.18,
  maxLat: 37.7,
};

// 이 줌 이상에서는 화면당 물건이 적어 개별 마커에 가격 캡션을 노출한다(그 아래는 클러스터).
const CAPTION_ZOOM = 15;

// 클러스터 leaf/마커 탭에서 원본 물건을 역조회하기 위한 식별자.
const itemKey = (item: AuctionItem): string =>
  `${item.courtOfficeCode}_${item.caseNo}_${item.itemNo}`;

export function MapHomeScreen({ navigation }: Props) {
  const [items, setItems] = useState<AuctionItem[]>([]);
  const [zoom, setZoom] = useState(11);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (bbox: Bbox) => {
    setLoading(true);
    setError(false);
    try {
      setItems(await fetchItemsInBbox(bbox));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(SEOUL_BBOX);
  }, [load]);

  const goToDetail = useCallback(
    (item: AuctionItem) =>
      navigation.navigate('ItemDetail', {
        courtOfficeCode: item.courtOfficeCode,
        caseNo: item.caseNo,
        itemNo: item.itemNo,
        address: item.address,
      }),
    [navigation],
  );

  // 좌표가 있는 물건을 identifier로 dedupe(복합키는 사실상 PK) — 클러스터·마커·역조회의 단일 소스.
  const itemsById = useMemo(() => {
    const map = new Map<string, AuctionItem>();
    items
      .filter(item => item.lng !== null && item.lat !== null)
      .forEach(item => map.set(itemKey(item), item));
    return map;
  }, [items]);

  const clusterMarkers = useMemo<ClusterMarkerProp[]>(
    () =>
      Array.from(itemsById, ([identifier, item]) => ({
        identifier,
        latitude: item.lat as number,
        longitude: item.lng as number,
        image: { symbol: 'green' },
      })),
    [itemsById],
  );

  // clusters prop 리터럴을 메모이즈해 리렌더마다 마커 배열이 재해싱되는 것을 막는다.
  const clusters = useMemo(
    () =>
      clusterMarkers.length
        ? [{ markers: clusterMarkers, screenDistance: 70, animate: true }]
        : undefined,
    [clusterMarkers],
  );

  // 줌이 임계값 이상이면 클러스터 대신 가격 캡션이 붙은 개별 마커를 그린다.
  const showCaptions = zoom >= CAPTION_ZOOM;

  return (
    <View style={styles.container}>
      <NaverMapView
        style={styles.map}
        initialCamera={{ ...SEOUL_CENTER, zoom: 11 }}
        isShowLocationButton={false}
        clusters={showCaptions ? undefined : clusters}
        onTapClusterLeaf={({ markerIdentifier }) => {
          const item = itemsById.get(markerIdentifier);
          if (item) goToDetail(item);
        }}
        onCameraIdle={event => {
          if (typeof event.zoom === 'number') setZoom(event.zoom);
          load({
            minLng: event.region.longitude,
            minLat: event.region.latitude,
            maxLng: event.region.longitude + event.region.longitudeDelta,
            maxLat: event.region.latitude + event.region.latitudeDelta,
          });
        }}
      >
        {showCaptions
          ? Array.from(itemsById.values()).map(item => {
              // 감정가 대비 하락률. 최저가에 종속된 보조 정보라 한 단계 작고 무채색으로 눌러둔다.
              // 좋고 나쁨을 뜻하는 색은 쓰지 않는다 — 하락률은 사실이지 우리 판단이 아니다.
              const drop = formatDropRate(item.appraisalAmount, item.minimumSalePrice);
              return (
                <NaverMapMarkerOverlay
                  key={itemKey(item)}
                  latitude={item.lat as number}
                  longitude={item.lng as number}
                  onTap={() => goToDetail(item)}
                  caption={
                    item.minimumSalePrice !== null
                      ? {
                          text: formatWonCompact(item.minimumSalePrice),
                          textSize: 12,
                        }
                      : undefined
                  }
                  subCaption={
                    drop !== null
                      ? { text: drop, textSize: 10, color: colors.slate }
                      : undefined
                  }
                />
              );
            })
          : null}
      </NaverMapView>

      <View style={styles.badge} pointerEvents="none">
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.badgeText}>
            {error ? '불러오기 실패' : `이 지역 ${itemsById.size}건`}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSoft },
  map: { flex: 1 },
  badge: {
    position: 'absolute',
    top: space.base,
    alignSelf: 'center',
    minWidth: 96,
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    paddingHorizontal: space.base,
    paddingVertical: space.xs,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  badgeText: { ...text.bodySmBold, color: colors.inkDeep },
});
