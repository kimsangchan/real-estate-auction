// 룰 역채점 조회 — **내부 확인용**이라 프로덕션에서는 열지 않는다.
// 사용자에게 보여줄 수치가 아니다(표본이 작고 해석에 전제가 많다, WP-11 §4-20).
import { Controller, Get, NotFoundException } from '@nestjs/common';
import { BacktestRepository } from './backtest.repository';
import type { BacktestDto } from './dto/backtest.dto';

@Controller('backtest')
export class BacktestController {
  constructor(private readonly repository: BacktestRepository) {}

  @Get()
  async scoring(): Promise<BacktestDto> {
    // 인증 장치가 없으므로 배포 환경에서는 아예 없는 경로로 둔다.
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException('Not found');
    }
    return this.repository.findScoring();
  }
}
