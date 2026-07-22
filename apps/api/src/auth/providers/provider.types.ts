// 소셜 로그인 제공자 어댑터 인터페이스 — 카카오(OIDC)·네이버(OAuth2+프로필 API)를
// `{ providerUserId, nickname }`으로 통일해 서비스가 provider별 차이를 몰라도 되게 한다 (WP-08 §1-2)
import { BadRequestException } from '@nestjs/common';

export const OAUTH_PROVIDERS = ['kakao', 'naver'] as const;
export type Provider = (typeof OAUTH_PROVIDERS)[number];

export function assertProvider(value: string): Provider {
  if (!(OAUTH_PROVIDERS as readonly string[]).includes(value)) {
    throw new BadRequestException(`지원하지 않는 로그인 제공자예요: ${value}`);
  }
  return value as Provider;
}

export interface OAuthProfile {
  providerUserId: string;
  nickname: string;
}

export interface OAuthProvider {
  readonly name: Provider;
  buildAuthorizeUrl(params: { redirectUri: string; state: string; nonce?: string }): string;
  exchangeCodeForProfile(params: { code: string; redirectUri: string; nonce?: string }): Promise<OAuthProfile>;
}
