// 기기 토큰 등록·해제 — API가 처리하는 부분. 발송은 cron이 부르는 dispatcher가 맡는다 (WP-09 §1-3).
import { Injectable } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';

// 계정당 보관할 기기 수 — 초과분은 오래된 것부터 지운다 (발송 루프 증폭 방지)
const MAX_DEVICES_PER_USER = 10;

@Injectable()
export class NotificationsService {
  constructor(private readonly repository: NotificationsRepository) {}

  async registerDevice(userId: string, token: string, platform: string): Promise<void> {
    await this.repository.upsertDeviceToken(userId, token, platform);
    await this.repository.pruneDeviceTokens(userId, MAX_DEVICES_PER_USER);
  }

  /** 본인 토큰만 지운다 — 토큰 값만으로 남의 기기를 해제할 수 없어야 한다 */
  unregisterDevice(userId: string, token: string): Promise<void> {
    return this.repository.deleteOwnDeviceToken(userId, token);
  }
}
