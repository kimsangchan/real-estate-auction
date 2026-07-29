// 기기 토큰 등록·해제 — API가 처리하는 부분. 발송은 cron이 부르는 dispatcher가 맡는다 (WP-09 §1-3).
import { Injectable } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(private readonly repository: NotificationsRepository) {}

  registerDevice(userId: string, token: string, platform: string): Promise<void> {
    return this.repository.upsertDeviceToken(userId, token, platform);
  }

  unregisterDevice(token: string): Promise<void> {
    return this.repository.deleteDeviceToken(token);
  }
}
