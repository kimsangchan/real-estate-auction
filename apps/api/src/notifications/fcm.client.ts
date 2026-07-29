// FCM HTTP v1 전송 클라이언트 — 서비스 계정으로 액세스 토큰을 받아 메시지를 보낸다 (WP-09).
// firebase-admin은 무겁고 이 용도엔 과하다 — 이미 있는 jose + fetch로 끝난다 (AGENTS.md 규칙 14).
import { readFileSync } from 'node:fs';
import { importPKCS8, SignJWT } from 'jose';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_SKEW_SECONDS = 60;
// Node fetch에는 기본 타임아웃이 없다 — 반쯤 열린 연결에 cron 프로세스가 영영 매달리지 않게 한다.
const REQUEST_TIMEOUT_MS = 10_000;
// FCM 메시지 상한은 4KB다. 주소가 비정상적으로 긴 물건 하나가 전체 발송을 깨지 않게 미리 자른다.
const TITLE_MAX = 200;
const BODY_MAX = 800;

/** 액세스 토큰을 못 받으면 이번 실행 전체가 못 나간다 — 개별 실패와 구분해 던진다 */
export class FcmUnavailableError extends Error {}

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

const truncate = (value: string, max: number): string =>
  value.length <= max ? value : `${value.slice(0, max - 1)}…`;

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

    let response: Response;
    try {
      response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new FcmUnavailableError('FCM 액세스 토큰 발급에 실패했어요');
    }
    if (!response.ok) {
      throw new FcmUnavailableError(`FCM 액세스 토큰 발급 실패: ${response.status}`);
    }

    const body = (await response.json()) as { access_token?: string; expires_in?: number };
    // expires_in이 없거나 숫자가 아니면 만료 계산이 NaN이 되어 캐시가 조용히 꺼진다 — 기본값을 쓴다.
    const expiresIn = Number.isFinite(body.expires_in) ? (body.expires_in as number) : 3600;
    if (!body.access_token) {
      throw new FcmUnavailableError('FCM 액세스 토큰 응답이 비어 있어요');
    }

    this.cachedToken = {
      value: body.access_token,
      expiresAtMs: this.now() + (expiresIn - TOKEN_SKEW_SECONDS) * 1000,
    };
    return body.access_token;
  }

  /** @throws FcmUnavailableError 액세스 토큰을 못 받은 경우(이번 실행 전체 중단 대상) */
  async send(deviceToken: string, message: PushMessage): Promise<SendResult> {
    const accessToken = await this.accessToken();

    let response: Response;
    try {
      response = await fetch(
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
              notification: {
                title: truncate(message.title, TITLE_MAX),
                body: truncate(message.body, BODY_MAX),
              },
              data: message.data,
              // 잠금화면에 주소가 그대로 드러나지 않게 한다 — 어떤 물건을 보고 있는지가 민감하다 (규칙 8)
              android: { priority: 'high', notification: { visibility: 'PRIVATE' } },
            },
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
    } catch {
      // 네트워크 실패는 이 기기 건만 실패로 본다 — 토큰을 지우지 않는다.
      return 'failed';
    }

    if (response.ok) return 'sent';

    // 404 UNREGISTERED만 "죽은 토큰"이다. 400 INVALID_ARGUMENT는 페이로드가 잘못돼도 오므로
    // 토큰 삭제 근거가 될 수 없다 — 이걸 삭제로 처리하면 물건 하나의 데이터 이상이
    // 그 물건을 등록한 전원의 토큰을 지워버린다.
    return response.status === 404 ? 'unregistered' : 'failed';
  }
}
