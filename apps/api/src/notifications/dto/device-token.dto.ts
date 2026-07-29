// 기기 토큰 등록·해제 body DTO — 전역 ValidationPipe(whitelist, forbidNonWhitelisted)가 걸러내도록
// 모든 필드를 명시한다 (WP-09 §3-6).
import { IsIn, IsString, Length } from 'class-validator';

// FCM 등록 토큰은 보통 수백 자다 — 상한을 둬 과대 body를 미리 막는다.
const TOKEN_MAX_LENGTH = 4096;

export class RegisterDeviceDto {
  @IsString()
  @Length(1, TOKEN_MAX_LENGTH)
  token!: string;

  @IsIn(['android', 'ios'])
  platform!: string;
}

export class UnregisterDeviceDto {
  @IsString()
  @Length(1, TOKEN_MAX_LENGTH)
  token!: string;
}
