// 지도 홈(F-01) — 서울 중심 네이버 지도에 뷰포트(bbox) 안의 경매 물건을 마커로 얹고, 탭하면 상세로 이동한다.
// 카메라가 멈출 때마다 현재 화면의 bbox로 물건을 다시 조회한다(GET /auction-items/bbox).
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  NaverMapMarkerOverlay,
  NaverMapView,
} from '@mj-studio/react-native-naver-map';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  fetchItemsInBbox,
  type AuctionItem,
  type Bbox,
} from '../api/auctionItems';
import { formatWonCompact } from '../lib/format';
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

  const markers = items.filter(item => item.lng !== null && item.lat !== null);

  return (
    <View style={styles.container}>
      <NaverMapView
        style={styles.map}
        initialCamera={{ ...SEOUL_CENTER, zoom: 11 }}
        isShowLocationButton={false}
        onCameraIdle={event =>
          load({
            minLng: event.region.longitude,
            minLat: event.region.latitude,
            maxLng: event.region.longitude + event.region.longitudeDelta,
            maxLat: event.region.latitude + event.region.latitudeDelta,
          })
        }
      >
        {markers.map(item => (
          <NaverMapMarkerOverlay
            key={`${item.courtOfficeCode}_${item.caseNo}_${item.itemNo}`}
            latitude={item.lat as number}
            longitude={item.lng as number}
            onTap={() =>
              navigation.navigate('ItemDetail', {
                courtOfficeCode: item.courtOfficeCode,
                caseNo: item.caseNo,
                itemNo: item.itemNo,
                address: item.address,
              })
            }
            caption={
              item.minimumSalePrice !== null
                ? {
                    text: formatWonCompact(item.minimumSalePrice),
                    textSize: 12,
                  }
                : undefined
            }
          />
        ))}
      </NaverMapView>

      <View style={styles.badge} pointerEvents="none">
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.badgeText}>
            {error ? '불러오기 실패' : `이 지역 ${markers.length}건`}
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
