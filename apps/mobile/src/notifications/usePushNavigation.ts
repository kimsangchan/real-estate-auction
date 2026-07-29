// 알림 탭 → 물건 상세 이동 (WP-09 §1-9). 새 화면을 만들지 않고 기존 ItemDetail을 그대로 쓴다.
import {
  getInitialNotification,
  getMessaging,
  onNotificationOpenedApp,
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { useEffect } from 'react';
import type { RootStackParamList } from '../navigation';
import { parseItemRoute } from './push-route';

export function usePushNavigation(
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>,
): void {
  useEffect(() => {
    let cancelled = false;

    const goToItem = (message: FirebaseMessagingTypes.RemoteMessage | null): void => {
      const route = parseItemRoute(message?.data);
      if (!route || cancelled || !navigationRef.isReady()) return;

      // 주소는 상세 화면이 사건키로 다시 조회하므로 비워 보낸다.
      navigationRef.navigate('ItemDetail', { ...route, address: null });
    };

    // 알림으로 앱이 처음 깨어난 경우와, 떠 있는 동안 탭한 경우를 모두 받는다.
    getInitialNotification(getMessaging())
      .then(goToItem)
      .catch(() => {});
    const unsubscribe = onNotificationOpenedApp(getMessaging(), goToItem);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [navigationRef]);
}
