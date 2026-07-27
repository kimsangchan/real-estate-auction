/**
 * @format
 */

// PKCE 난수(crypto.getRandomValues) 폴리필 — 앱 코드보다 먼저 로드돼야 한다 (WP-08b §1-1)
import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
