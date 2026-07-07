// API 서버 부트스트랩 — env 검증 실패 시 기동 중단, 전역 입력 검증 파이프 적용 (AGENTS.md 규칙 5, 21)
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')] });

import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = loadEnv(process.env);
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.listen(env.PORT);
}

void bootstrap();
