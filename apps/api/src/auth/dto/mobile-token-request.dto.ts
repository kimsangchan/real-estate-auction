// 모바일 교환 코드 → 토큰 요청 DTO — 딥링크로 받은 일회성 코드와 PKCE verifier (WP-08b §1-1)
import { IsNotEmpty, IsString, Matches } from 'class-validator';

// RFC 7636 §4.1 — code_verifier 문자 집합·길이 (43~128자)
const CODE_VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;

export class MobileTokenRequestDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @Matches(CODE_VERIFIER_PATTERN, { message: 'codeVerifier 형식이 올바르지 않아요' })
  codeVerifier!: string;
}
