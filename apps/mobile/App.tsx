// 앱 진입점 — 네비게이션 컨테이너와 네이티브 스택(지도 홈 → 물건 상세)을 구성한다.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { RootStackParamList } from './src/navigation';
import { ItemDetailScreen } from './src/screens/ItemDetailScreen';
import { MapHomeScreen } from './src/screens/MapHomeScreen';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.canvas },
            headerTintColor: colors.inkDeep,
            headerTitleStyle: { color: colors.inkDeep },
            contentStyle: { backgroundColor: colors.canvas },
          }}
        >
          <Stack.Screen
            name="MapHome"
            component={MapHomeScreen}
            options={{ title: '경매 지도' }}
          />
          <Stack.Screen
            name="ItemDetail"
            component={ItemDetailScreen}
            options={{ title: '물건 상세' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
