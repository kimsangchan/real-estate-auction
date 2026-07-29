// 알림 발송 CLI — cron이 주기적으로 부른다 (WP-09 §1-3, 수집기와 같은 실행 패턴 C-04).
// API 프로세스에 스케줄러를 붙이지 않는 이유: 인스턴스가 2대가 되는 순간 같은 알림이 두 번 나간다.
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')] });

import 'reflect-metadata';
import { Pool } from 'pg';
import { loadEnv } from './config/env';
import { FcmClient } from './notifications/fcm.client';
import { NotificationDispatcher } from './notifications/notification-dispatcher';
import { NotificationsRepository } from './notifications/notifications.repository';

async function main(): Promise<void> {
  const env = loadEnv(process.env);
  if (!env.FCM_SERVICE_ACCOUNT_PATH) {
    throw new Error('FCM_SERVICE_ACCOUNT_PATH가 없어요 — 발송할 수 없습니다 (WP-09 §0-2)');
  }

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    const dispatcher = new NotificationDispatcher(
      new NotificationsRepository(pool),
      new FcmClient(env.FCM_SERVICE_ACCOUNT_PATH),
    );
    const summary = await dispatcher.run();
    // 처리 건수를 남긴다 — 실패 원인 추적에 필요 (AGENTS.md 규칙 7). 토큰·문구는 남기지 않는다 (규칙 8).
    console.log(`notify_run ${JSON.stringify(summary)}`);

    // 실패를 0으로 끝내면 cron·모니터링에 성공으로 보인다 — 발송 실패는 종료 코드로 드러낸다.
    if (summary.failed > 0 || summary.abortedUnavailable) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  // 서비스 계정 경로 같은 내부 경로가 로그로 새지 않게 메시지를 그대로 찍지 않는다 (규칙 8).
  console.error('notify_failed', error instanceof Error ? error.name : 'UnknownError');
  process.exit(1);
});
