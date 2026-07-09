// 지도 홈(F-01) — 서울 중심 네이버 지도에 뷰포트(bbox) 안의 경매 물건을 클러스터 마커로 얹고,
// 개별(leaf) 마커를 탭하면 상세로 이동한다. 카메라가 멈출 때마다 현재 화면의 bbox로 재조회한다.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  type ClusterMarkerProp,
  NaverMapView,
} from '@mj-studio/react-native-naver-map';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  fetchItemsInBbox,
  type AuctionItem,
  type Bbox,
} from '../api/auctionItems';
import type { RootStackParamList } from '../navigation';
import { colors, radius, space, text } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MapHome'>;

// 서울 중심 초기 카메라 + 최초 로딩용 bbox(현재 수집 데이터는 전부 서울이라 서울 전역을 덮는다).
const SEOUL_CENTER = { latitude: 37.5665, longitude: 126.978 };
const SEOUL_BBOX: Bbox = {
  minLng: 126.76,
  minLat: 37.42,
  maxLng: 127.18,
  maxLat: 37.7,
};

// 클러스터 leaf 탭 이벤트에서 원본 물건을 역조회하기 위한 식별자.
const itemKey = (item: AuctionItem): string =>
  `${item.courtOfficeCode}_${item.caseNo}_${item.itemNo}`;

export function MapHomeScreen({ navigation }: Props) {
  const [items, setItems] = useState<AuctionItem[]>([]);
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

  // 좌표가 있는 물건만 클러스터 대상으로 삼는다.
  const located = useMemo(
    () => items.filter(item => item.lng !== null && item.lat !== null),
    [items],
  );

  // leaf 마커 탭 시 identifier로 원본 물건을 역조회하기 위한 맵.
  const itemsById = useMemo(() => {
    const map = new Map<string, AuctionItem>();
    located.forEach(item => map.set(itemKey(item), item));
    return map;
  }, [located]);

  // 마커는 itemsById에서 파생해 identifier 유일성을 보장한다(복합키 중복 시 leaf 탭이
  // 엉뚱한 물건으로 가는 것을 방지 — 사건키는 사실상 PK지만 방어적으로 dedupe).
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

  return (
    <View style={styles.container}>
      <NaverMapView
        style={styles.map}
        initialCamera={{ ...SEOUL_CENTER, zoom: 11 }}
        isShowLocationButton={false}
        clusters={clusters}
        onTapClusterLeaf={({ markerIdentifier }) => {
          const item = itemsById.get(markerIdentifier);
          if (!item) return;
          navigation.navigate('ItemDetail', {
            courtOfficeCode: item.courtOfficeCode,
            caseNo: item.caseNo,
            itemNo: item.itemNo,
            address: item.address,
          });
        }}
        onCameraIdle={event =>
          load({
            minLng: event.region.longitude,
            minLat: event.region.latitude,
            maxLng: event.region.longitude + event.region.longitudeDelta,
            maxLat: event.region.latitude + event.region.latitudeDelta,
          })
        }
      />

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
