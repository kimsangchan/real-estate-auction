import { FavoritesRepository } from './favorites.repository';

function createMockPool(rows: unknown[] = []) {
  return { query: jest.fn().mockResolvedValue({ rows }) };
}

describe('FavoritesRepository', () => {
  it('findByUser는 해당 유저의 관심 물건만 최신순으로 조회한다', async () => {
    const rows = [{ courtOfficeCode: 'B000210', caseNo: '2025타경755', itemNo: '1', createdAt: new Date() }];
    const pool = createMockPool(rows);
    const repository = new FavoritesRepository(pool as never);

    const result = await repository.findByUser('user-1');

    expect(result).toBe(rows);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = $1'), ['user-1']);
  });

  it('add는 ON CONFLICT DO NOTHING으로 중복 등록을 멱등하게 만든다', async () => {
    const pool = createMockPool();
    const repository = new FavoritesRepository(pool as never);

    await repository.add('user-1', 'B000210', '2025타경755', '1');

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (user_id, court_office_code, case_no, item_no) DO NOTHING'), [
      'user-1',
      'B000210',
      '2025타경755',
      '1',
    ]);
  });

  it('remove는 해당 유저·물건 조합만 지운다', async () => {
    const pool = createMockPool();
    const repository = new FavoritesRepository(pool as never);

    await repository.remove('user-1', 'B000210', '2025타경755', '1');

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM favorite'), [
      'user-1',
      'B000210',
      '2025타경755',
      '1',
    ]);
  });
});
