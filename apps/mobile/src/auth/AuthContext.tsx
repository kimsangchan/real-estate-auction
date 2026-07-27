// 로그인 상태 공유 — 딥링크 수신과 세션 복구를 한 곳에서 처리해 화면들은 상태만 읽게 한다 (WP-08b §1-6)
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

  const applySession = useCallback(async (hasSession: boolean) => {
    const current = hasSession ? await fetchCurrentUser() : null;
    setUser(current);
    setStatus(current ? 'authenticated' : 'anonymous');
  }, []);

  // 앱 시작 시 Keystore의 리프레시 토큰으로 세션을 되살린다 (강제 종료 후 재실행에도 로그인 유지)
  useEffect(() => {
    let cancelled = false;

    restoreSession()
      .then(restored => {
        if (!cancelled) return applySession(restored);
      })
      .catch(() => {
        if (!cancelled) setStatus('anonymous');
      });

    return () => {
      cancelled = true;
    };
  }, [applySession]);

  // 로그인 콜백 딥링크 — 앱이 떠 있을 때(url 이벤트)와 딥링크로 깨어날 때(getInitialURL)를 모두 받는다
  useEffect(() => {
    let cancelled = false;

    const handleUrl = async (url: string | null) => {
      const code = parseAuthCallbackCode(url);
      if (!code || cancelled) return;

      const exchanged = await completeLogin(code);
      if (!cancelled) await applySession(exchanged);
    };

    Linking.getInitialURL()
      .then(handleUrl)
      .catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [applySession]);

  const signIn = useCallback(async (provider: AuthProvider) => {
    await startLogin(provider);
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const removeAccount = useCallback(async () => {
    const removed = await deleteAccount();
    if (removed) {
      setUser(null);
      setStatus('anonymous');
    }
    return removed;
  }, []);

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
