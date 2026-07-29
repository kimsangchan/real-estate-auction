// FCM HTTP v1 전송 클라이언트 — 서비스 계정으로 액세스 토큰을 받아 메시지를 보낸다 (WP-09).
// firebase-admin은 무겁고 이 용도엔 과하다 — 이미 있는 jose + fetch로 끝난다 (AGENTS.md 규칙 14).
import { readFileSync } from 'node:fs';
import { importPKCS8, SignJWT } from 'jose';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_SKEW_SECONDS = 60;

/** 전송 결과 — 'unregistered'는 기기에서 앱이 지워졌다는 뜻이라 토큰 행을 지워야 한다 */
export type SendResult = 'sent' | 'unregistered' | 'failed';

export interface PushMessage {
  title: string;
  body: string;
  /** 알림을 탭했을 때 어느 물건으로 갈지 — 문자열만 담을 수 있다(FCM data 제약) */
  data: Record<string, string>;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

export class FcmClient {
  private readonly account: ServiceAccount;
  private cachedToken: { value: string; expiresAtMs: number } | null = null;

  constructor(
    serviceAccountPath: string,
    private readonly now: () => number = Date.now,
  ) {
    const parsed = JSON.parse(readFileSync(serviceAccountPath, 'utf8')) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
      throw new Error('FCM 서비스 계정 파일에 필요한 필드가 없어요');
    }
    this.account = parsed as ServiceAccount;
  }

  private async accessToken(): Promise<string> {
    const cached = this.cachedToken;
    if (cached && cached.expiresAtMs > this.now()) {
      return cached.value;
    }

    const issuedAt = Math.floor(this.now() / 1000);
    const key = await importPKCS8(this.account.private_key, 'RS256');
    const assertion = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(this.account.client_email)
      .setSubject(this.account.client_email)
      .setAudience(TOKEN_URL)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 3600)
      .sign(key);

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!response.ok) {
      throw new Error(`FCM 액세스 토큰 발급 실패: ${response.status}`);
    }

    const body = (await response.json()) as { access_token: string; expires_in: number };
    this.cachedToken = {
      value: body.access_token,
      expiresAtMs: this.now() + (body.expires_in - TOKEN_SKEW_SECONDS) * 1000,
    };
    return body.access_token;
  }

  async send(deviceToken: string, message: PushMessage): Promise<SendResult> {
    let accessToken: string;
    try {
      accessToken = await this.accessToken();
    } catch {
      // 토큰 발급 실패는 이번 실행 전체가 못 나가는 상황 — 토큰 행은 건드리지 않는다.
      return 'failed';
    }

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${this.account.project_id}/messages:send`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title: message.title, body: message.body },
            data: message.data,
            android: { priority: 'high' },
          },
        }),
      },
    );

    if (response.ok) return 'sent';

    // 404 UNREGISTERED = 앱 삭제·토큰 폐기, 400 INVALID_ARGUMENT = 형식이 깨진 토큰.
    // 둘 다 다시 시도해도 소용없으니 호출부가 토큰을 지우게 한다.
    if (response.status === 404) return 'unregistered';
    if (response.status === 400) {
      const body = (await response.json().catch(() => null)) as { error?: { status?: string } } | null;
      return body?.error?.status === 'INVALID_ARGUMENT' ? 'unregistered' : 'failed';
    }
    return 'failed';
  }
}
