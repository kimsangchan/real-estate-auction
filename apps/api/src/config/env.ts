// 환경 변수 로딩·검증 — 외부 입력은 런타임 스키마로 검증하고 실패 시 기동을 중단한다 (AGENTS.md 규칙 21)
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z
    .string()
    .startsWith('postgresql://', { message: 'postgresql:// 형식이어야 합니다' }),
  // --- 인증 (WP-08 — 카카오·네이버 소셜 로그인, D-015) ---
  JWT_ACCESS_SECRET: z.string().min(32, 'HS256 서명 키는 최소 32자 이상이어야 합니다'),
  JWT_REFRESH_SECRET: z.string().min(32, 'HS256 서명 키는 최소 32자 이상이어야 합니다'),
  KAKAO_OAUTH_CLIENT_ID: z.string().min(1),
  KAKAO_OAUTH_CLIENT_SECRET: z.string().min(1),
  NAVER_OAUTH_CLIENT_ID: z.string().min(1),
  NAVER_OAUTH_CLIENT_SECRET: z.string().min(1),
  AUTH_WEB_ORIGIN: z.string().url({ message: 'URL 형식이어야 합니다' }).default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`환경 변수 검증 실패 — 기동을 중단합니다: ${detail}`);
  }
  return result.data;
}
