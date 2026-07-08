// 외부 입력 런타임 검증 — Controller가 없는 순수 도메인 모듈이므로 서비스 진입점에서 직접 검증한다
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RightsAnalysisRequestDto } from './rights-analysis-request.dto';

export class RightsAnalysisValidationError extends Error {
  constructor(public readonly details: string[]) {
    super(`권리분석 요청 검증 실패: ${details.join('; ')}`);
  }
}

export function validateRightsAnalysisRequest(input: unknown): RightsAnalysisRequestDto {
  const instance = plainToInstance(RightsAnalysisRequestDto, input);
  const errors = validateSync(instance as object, { whitelist: true, forbidNonWhitelisted: true });

  if (errors.length > 0) {
    const details = errors.flatMap((error) => Object.values(error.constraints ?? {}));
    throw new RightsAnalysisValidationError(details);
  }

  return instance;
}
