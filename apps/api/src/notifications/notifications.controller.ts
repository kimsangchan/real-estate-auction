// 알림 컨트롤러 — 기기 토큰 등록·해제만 담당한다. 발송은 cron CLI 소관 (WP-09 §1-10).
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RegisterDeviceDto, UnregisterDeviceDto } from './dto/device-token.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  // 토큰은 URL이 아니라 body로 받는다 — 접근 로그에 남지 않게 (AGENTS.md 규칙 8)
  @Put('device')
  @HttpCode(200)
  async register(
    @Req() req: AuthenticatedRequest,
    @Body() body: RegisterDeviceDto,
  ): Promise<{ success: true }> {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }

    await this.service.registerDevice(userId, body.token, body.platform);
    return { success: true };
  }

  // 토큰 값만으로는 소유를 증명하지 못한다 — 반드시 로그인한 본인 토큰만 지운다
  @Delete('device')
  @HttpCode(200)
  async unregister(
    @Req() req: AuthenticatedRequest,
    @Body() body: UnregisterDeviceDto,
  ): Promise<{ success: true }> {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }

    await this.service.unregisterDevice(userId, body.token);
    return { success: true };
  }
}
