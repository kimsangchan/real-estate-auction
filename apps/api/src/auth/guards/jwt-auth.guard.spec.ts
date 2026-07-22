import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';
import { JwtService } from '../token/jwt.service';

const SECRET = 'a'.repeat(32);

function buildContext(req: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('Authorization 헤더의 Bearer 토큰으로 인증한다', async () => {
    const jwtService = new JwtService(SECRET);
    const token = await jwtService.issueAccessToken('user-1');
    const guard = new JwtAuthGuard(jwtService);
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthenticatedRequest;

    await expect(guard.canActivate(buildContext(req))).resolves.toBe(true);
    expect(req.user).toEqual({ id: 'user-1' });
  });

  it('access_token 쿠키로도 인증한다', async () => {
    const jwtService = new JwtService(SECRET);
    const token = await jwtService.issueAccessToken('user-2');
    const guard = new JwtAuthGuard(jwtService);
    const req = { headers: { cookie: `access_token=${token}; other=1` } } as AuthenticatedRequest;

    await expect(guard.canActivate(buildContext(req))).resolves.toBe(true);
    expect(req.user).toEqual({ id: 'user-2' });
  });

  it('헤더가 쿠키보다 우선한다', async () => {
    const jwtService = new JwtService(SECRET);
    const headerToken = await jwtService.issueAccessToken('header-user');
    const cookieToken = await jwtService.issueAccessToken('cookie-user');
    const guard = new JwtAuthGuard(jwtService);
    const req = {
      headers: { authorization: `Bearer ${headerToken}`, cookie: `access_token=${cookieToken}` },
    } as AuthenticatedRequest;

    await guard.canActivate(buildContext(req));

    expect(req.user).toEqual({ id: 'header-user' });
  });

  it('토큰이 전혀 없으면 UnauthorizedException을 던진다', async () => {
    const guard = new JwtAuthGuard(new JwtService(SECRET));
    const req = { headers: {} } as AuthenticatedRequest;

    await expect(guard.canActivate(buildContext(req))).rejects.toThrow(UnauthorizedException);
  });

  it('토큰이 유효하지 않으면 UnauthorizedException을 던진다', async () => {
    const guard = new JwtAuthGuard(new JwtService(SECRET));
    const req = { headers: { authorization: 'Bearer garbage' } } as AuthenticatedRequest;

    await expect(guard.canActivate(buildContext(req))).rejects.toThrow(UnauthorizedException);
  });

  it('만료된 토큰은 UnauthorizedException을 던진다', async () => {
    let now = 0;
    const jwtService = new JwtService(SECRET, () => now);
    const token = await jwtService.issueAccessToken('user-1');
    now += 16 * 60 * 1000;
    const guard = new JwtAuthGuard(jwtService);
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthenticatedRequest;

    await expect(guard.canActivate(buildContext(req))).rejects.toThrow(UnauthorizedException);
  });
});
