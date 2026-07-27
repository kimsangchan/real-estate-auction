// 리프레시·로그아웃 body DTO — 모바일은 쿠키 대신 body로 리프레시 토큰을 보낸다 (WP-08b §1-5)
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenBodyDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
