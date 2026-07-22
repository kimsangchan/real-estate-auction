import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { FavoritesController } from './favorites.controller';
import type { AuthenticatedRequest } from '../auth/guards/jwt-auth.guard';

function reqOf(userId: string | undefined): AuthenticatedRequest {
  return { headers: {}, user: userId ? { id: userId } : undefined } as AuthenticatedRequest;
}

describe('FavoritesController', () => {
  it('list는 req.user의 id로만 조회한다 (타 유저 격리)', async () => {
    const repository = { findByUser: jest.fn().mockResolvedValue([{ courtOfficeCode: 'B000210', caseNo: 'c1', itemNo: '1' }]) };
    const controller = new FavoritesController(repository as never);

    const result = await controller.list(reqOf('user-1'));

    expect(repository.findByUser).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([{ courtOfficeCode: 'B000210', caseNo: 'c1', itemNo: '1' }]);
  });

  it('서로 다른 유저는 서로 다른 목록을 받는다', async () => {
    const repository = {
      findByUser: jest.fn((userId: string) => Promise.resolve(userId === 'user-1' ? ['a'] : ['b'])),
    };
    const controller = new FavoritesController(repository as never);

    expect(await controller.list(reqOf('user-1'))).toEqual(['a']);
    expect(await controller.list(reqOf('user-2'))).toEqual(['b']);
  });

  it('add는 courtOfficeCode·caseNo·itemNo를 리포지토리에 그대로 전달한다', async () => {
    const repository = { add: jest.fn().mockResolvedValue(undefined) };
    const controller = new FavoritesController(repository as never);

    const result = await controller.add(reqOf('user-1'), 'B000210', '2025타경755', '1');

    expect(result).toEqual({ success: true });
    expect(repository.add).toHaveBeenCalledWith('user-1', 'B000210', '2025타경755', '1');
  });

  it('add를 같은 값으로 두 번 호출해도 (멱등) 성공을 반환한다', async () => {
    const repository = { add: jest.fn().mockResolvedValue(undefined) };
    const controller = new FavoritesController(repository as never);

    await controller.add(reqOf('user-1'), 'B000210', '2025타경755', '1');
    const second = await controller.add(reqOf('user-1'), 'B000210', '2025타경755', '1');

    expect(second).toEqual({ success: true });
    expect(repository.add).toHaveBeenCalledTimes(2);
  });

  it('add는 빈 문자열 파라미터를 거부한다', async () => {
    const repository = { add: jest.fn() };
    const controller = new FavoritesController(repository as never);

    await expect(controller.add(reqOf('user-1'), '', '2025타경755', '1')).rejects.toThrow(BadRequestException);
    expect(repository.add).not.toHaveBeenCalled();
  });

  it('remove는 리포지토리에 위임한다', async () => {
    const repository = { remove: jest.fn().mockResolvedValue(undefined) };
    const controller = new FavoritesController(repository as never);

    const result = await controller.remove(reqOf('user-1'), 'B000210', '2025타경755', '1');

    expect(result).toEqual({ success: true });
    expect(repository.remove).toHaveBeenCalledWith('user-1', 'B000210', '2025타경755', '1');
  });

  it('req.user가 없으면(가드를 우회한 경우) UnauthorizedException을 던진다', async () => {
    const repository = { findByUser: jest.fn() };
    const controller = new FavoritesController(repository as never);

    await expect(controller.list(reqOf(undefined))).rejects.toThrow(UnauthorizedException);
  });
});
