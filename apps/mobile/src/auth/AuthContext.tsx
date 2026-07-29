// 로그인 상태 공유 — 딥링크 수신과 세션 복구를 한 곳에서 처리해 화면들은 상태만 읽게 한다 (WP-08b §1-6)
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Linking } from 'react-native';
import {
  completeLogin,
  deleteAccount,
  fetchCurrentUser,
  logout,
  restoreSession,
  startLogin,
  type AuthProvider,
  type CurrentUser,
} from '../api/authSession';
import { parseAuthCallbackCode } from '../api/deepLink';
import {
  clearPushRegistration,
  syncPushRegistration,
} from '../notifications/push';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  signIn: (provider: AuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
  removeAccount: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<CurrentUser | null>(null);

  // 세션을 건드리는 비동기 작업이 겹칠 수 있다(부트스트랩 ↔ 딥링크 ↔ 로그아웃).
  // 마지막으로 시작한 작업의 결과만 반영해 늦게 끝난 이전 작업이 상태를 되돌리지 못하게 한다.
  const generation = useRef(0);

  const applySession = useCallback(async () => {
    const mine = ++generation.current;
    const current = await fetchCurrentUser();
    if (generation.current !== mine) return;

    setUser(current);
    setStatus(current ? 'authenticated' : 'anonymous');

    // 로그인 상태가 되면 푸시 토큰을 올린다 — 등록을 기다리지 않고, 실패해도 로그인 흐름은
    // 그대로 간다 (syncPushRegistration이 내부에서 삼킨다, WP-09 §1-9).
    if (current) {
      syncPushRegistration().catch(() => {});
    }
  }, []);

  const goAnonymous = useCallback(() => {
    generation.current += 1;
    setUser(null);
    setStatus('anonymous');
  }, []);

  // 부트스트랩 — 딥링크로 깨어난 경우를 먼저 처리하고, 아니면 Keystore의 토큰으로 세션을 되살린다.
  // 두 경로를 한 effect에서 순차로 처리해야 서로의 결과를 덮어쓰지 않는다.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const initialCode = parseAuthCallbackCode(await Linking.getInitialURL());
      if (initialCode && (await completeLogin(initialCode))) {
        if (!cancelled) await applySession();
        return;
      }

      const restored = await restoreSession();
      if (cancelled) return;
      if (restored) await applySession();
      else goAnonymous();
    })().catch(() => {
      if (!cancelled) goAnonymous();
    });

    return () => {
      cancelled = true;
    };
  }, [applySession, goAnonymous]);

  // 앱이 떠 있는 동안 도착하는 로그인 콜백 딥링크.
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const code = parseAuthCallbackCode(url);
      if (!code) return;

      completeLogin(code)
        .then(exchanged => {
          // 교환 실패는 기존 세션을 건드리지 않는다 — 이미 소비됐거나 남이 던진 딥링크로
          // 멀쩡한 로그인 상태를 잃으면 안 된다.
          if (exchanged) return applySession();
        })
        .catch(() => {});
    });

    return () => {
      subscription.remove();
    };
  }, [applySession]);

  const signIn = useCallback(async (provider: AuthProvider) => {
    await startLogin(provider);
  }, []);

  const signOut = useCallback(async () => {
    // 세션이 살아 있을 때 지워야 서버가 토큰을 지운다 — 순서를 바꾸면 죽은 토큰이 남는다.
    await clearPushRegistration();
    await logout();
    goAnonymous();
  }, [goAnonymous]);

  const removeAccount = useCallback(async () => {
    await clearPushRegistration();
    const removed = await deleteAccount();
    if (removed) goAnonymous();
    return removed;
  }, [goAnonymous]);

  const value = useMemo(
    () => ({ status, user, signIn, signOut, removeAccount }),
    [status, user, signIn, signOut, removeAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있어요');
  }
  return value;
}
