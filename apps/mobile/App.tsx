// 앱 진입점 — 하단 탭(지도/목록)을 루트 스택(탭 → 물건 상세)으로 감싼다.
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import type { RootStackParamList, TabParamList } from './src/navigation';
import { ChecklistScreen } from './src/screens/ChecklistScreen';
import { FavoritesScreen } from './src/screens/FavoritesScreen';
import { ItemDetailScreen } from './src/screens/ItemDetailScreen';
import { ItemListScreen } from './src/screens/ItemListScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { MapHomeScreen } from './src/screens/MapHomeScreen';
import { RightsAnalysisScreen } from './src/screens/RightsAnalysisScreen';
import { RisksScreen } from './src/screens/RisksScreen';
import { colors } from './src/theme';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const renderMapIcon = ({ size }: { size: number }) => (
  <Text style={{ fontSize: size }}>🗺️</Text>
);
const renderListIcon = ({ size }: { size: number }) => (
  <Text style={{ fontSize: size }}>📋</Text>
);
const renderFavoritesIcon = ({ size }: { size: number }) => (
  <Text style={{ fontSize: size }}>♥</Text>
);

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.inkDeep,
        headerTitleStyle: { color: colors.inkDeep },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.stone,
        tabBarStyle: {
          backgroundColor: colors.canvas,
          borderTopColor: colors.hairlineSoft,
        },
      }}
    >
      <Tab.Screen
        name="MapHome"
        component={MapHomeScreen}
        options={{
          title: '경매 지도',
          tabBarLabel: '지도',
          tabBarIcon: renderMapIcon,
        }}
      />
      <Tab.Screen
        name="ItemList"
        component={ItemListScreen}
        options={{
          title: '물건 목록',
          tabBarLabel: '목록',
          tabBarIcon: renderListIcon,
        }}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{
          title: '관심 물건',
          tabBarLabel: '관심',
          tabBarIcon: renderFavoritesIcon,
        }}
      />
    </Tab.Navigator>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AuthProvider>
        <NavigationContainer>
          <RootStack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: colors.canvas },
              headerTintColor: colors.inkDeep,
              headerTitleStyle: { color: colors.inkDeep },
              contentStyle: { backgroundColor: colors.canvas },
            }}
          >
            <RootStack.Screen
              name="Tabs"
              component={Tabs}
              options={{ headerShown: false }}
            />
            <RootStack.Screen
              name="ItemDetail"
              component={ItemDetailScreen}
              options={{ title: '물건 상세' }}
            />
            <RootStack.Screen
              name="RightsAnalysis"
              component={RightsAnalysisScreen}
              options={{ title: '권리분석' }}
            />
            <RootStack.Screen
              name="Risks"
              component={RisksScreen}
              options={{ title: '확인이 필요해요' }}
            />
            <RootStack.Screen
              name="Checklist"
              component={ChecklistScreen}
              options={{ title: '임장 체크리스트' }}
            />
            <RootStack.Screen
              name="Login"
              component={LoginScreen}
              options={{ title: '로그인' }}
            />
          </RootStack.Navigator>
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
