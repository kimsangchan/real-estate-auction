import { AuthRepository } from './auth.repository';

function createMockPool(rows: unknown[] = []) {
  const client = { query: jest.fn().mockResolvedValue({ rows }), release: jest.fn() };
  return {
    query: jest.fn().mockResolvedValue({ rows }),
    connect: jest.fn().mockResolvedValue(client),
    __client: client,
  };
}

describe('AuthRepository', () => {
  it('upsertUser는 provider·providerUserId 충돌 시 nickname을 갱신한다', async () => {
    const pool = createMockPool([
      { id: 'u1', provider: 'kakao', providerUserId: 'k1', nickname: '새닉네임', createdAt: new Date() },
    ]);
    const repository = new AuthRepository(pool as never);

    const user = await repository.upsertUser('kakao', 'k1', '새닉네임');

    expect(user.nickname).toBe('새닉네임');
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (provider, provider_user_id)'), [
      'kakao',
      'k1',
      '새닉네임',
    ]);
  });

  it('findUserById는 없으면 null을 반환한다', async () => {
    const pool = createMockPool([]);
    const repository = new AuthRepository(pool as never);

    expect(await repository.findUserById('missing')).toBeNull();
  });

  it('withTransaction은 성공 시 BEGIN·COMMIT을 실행하고 클라이언트를 반환한다', async () => {
    const pool = createMockPool();
    const repository = new AuthRepository(pool as never);

    const result = await repository.withTransaction(async (client) => {
      await client.query('SELECT 1');
      return 'ok';
    });

    expect(result).toBe('ok');
    const queries = pool.__client.query.mock.calls.map((call: unknown[]) => call[0]);
    expect(queries[0]).toBe('BEGIN');
    expect(queries.at(-1)).toBe('COMMIT');
    expect(pool.__client.release).toHaveBeenCalled();
  });

  it('withTransaction은 실패 시 ROLLBACK 후 클라이언트를 해제하고 에러를 던진다', async () => {
    const pool = createMockPool();
    const repository = new AuthRepository(pool as never);

    await expect(
      repository.withTransaction(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const queries = pool.__client.query.mock.calls.map((call: unknown[]) => call[0]);
    expect(queries).toContain('ROLLBACK');
    expect(pool.__client.release).toHaveBeenCalled();
  });

  it('findRefreshTokenByHashForUpdate는 FOR UPDATE로 조회한다', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const repository = new AuthRepository({ query: jest.fn(), connect: jest.fn() } as never);

    await repository.findRefreshTokenByHashForUpdate(client, 'hash-1');

    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), ['hash-1']);
  });

  it('revokeFamily는 family_id의 미폐기 토큰만 갱신한다', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const repository = new AuthRepository({ query: jest.fn(), connect: jest.fn() } as never);

    await repository.revokeFamily(client, 'family-1');

    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('revoked_at IS NULL'), ['family-1']);
  });
});
