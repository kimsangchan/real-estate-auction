import { UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/guards/jwt-auth.guard';
import { NotificationsController } from './notifications.controller';
import type { NotificationsService } from './notifications.service';

const authedReq = (userId?: string): AuthenticatedRequest =>
  ({ user: userId ? { id: userId } : undefined }) as AuthenticatedRequest;

describe('NotificationsController', () => {
  it('기기 토큰을 사용자와 함께 등록한다', async () => {
    const service = { registerDevice: jest.fn() } as unknown as NotificationsService;
    const controller = new NotificationsController(service);

    const result = await controller.register(authedReq('user-1'), {
      token: 'fcm-token',
      platform: 'android',
    });

    expect(service.registerDevice).toHaveBeenCalledWith('user-1', 'fcm-token', 'android');
    expect(result).toEqual({ success: true });
  });

  it('req.user가 없으면 UnauthorizedException을 던진다', async () => {
    const service = { registerDevice: jest.fn() } as unknown as NotificationsService;
    const controller = new NotificationsController(service);

    await expect(
      controller.register(authedReq(), { token: 'fcm-token', platform: 'android' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(service.registerDevice).not.toHaveBeenCalled();
  });

  it('로그아웃 시 기기 토큰을 지운다', async () => {
    const service = { unregisterDevice: jest.fn() } as unknown as NotificationsService;
    const controller = new NotificationsController(service);

    const result = await controller.unregister({ token: 'fcm-token' });

    expect(service.unregisterDevice).toHaveBeenCalledWith('fcm-token');
    expect(result).toEqual({ success: true });
  });
});
