import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { addFavorite, fetchFavorites, removeFavorite } from '../api/favorites';
import { useAuth } from '../auth/AuthContext';
import { FavoriteButton } from './FavoriteButton';

jest.mock('../api/favorites', () => ({
  addFavorite: jest.fn(),
  fetchFavorites: jest.fn(),
  removeFavorite: jest.fn(),
}));
jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockedAddFavorite = addFavorite as jest.Mock;
const mockedFetchFavorites = fetchFavorites as jest.Mock;
const mockedRemoveFavorite = removeFavorite as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;

const KEY = { courtOfficeCode: 'B000210', caseNo: '2025타경755', itemNo: '1' };
const onRequireLogin = jest.fn();

function setAuth(status: 'loading' | 'authenticated' | 'anonymous') {
  mockedUseAuth.mockReturnValue({ status });
}

async function renderButton() {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    // 호출부(ItemDetailScreen)와 같이 사건키를 인라인 객체로 넘긴다.
    renderer = TestRenderer.create(
      <FavoriteButton item={{ ...KEY }} onRequireLogin={onRequireLogin} />,
    );
  });
  if (!renderer) throw new Error('renderer not created');
  return renderer;
}

const labelOf = (renderer: TestRenderer.ReactTestRenderer): string =>
  String(
    renderer.root.findAll(node => node.props.accessibilityRole === 'button')[0]
      ?.props.accessibilityLabel,
  );

const press = async (renderer: TestRenderer.ReactTestRenderer) => {
  await act(async () => {
    renderer.root
      .findAll(node => node.props.accessibilityRole === 'button')[0]
      ?.props.onPress();
  });
};

describe('FavoriteButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('비로그인이면 목록을 부르지 않고, 누르면 로그인 화면을 요청한다', async () => {
    setAuth('anonymous');

    const renderer = await renderButton();
    await press(renderer);

    expect(mockedFetchFavorites).not.toHaveBeenCalled();
    expect(onRequireLogin).toHaveBeenCalled();
  });

  it('이미 등록된 물건이면 관심 해제 버튼으로 보인다', async () => {
    setAuth('authenticated');
    mockedFetchFavorites.mockResolvedValue([KEY]);

    const renderer = await renderButton();

    expect(labelOf(renderer)).toBe('관심 해제');
  });

  it('등록되지 않은 물건을 누르면 등록하고 상태가 바뀐다', async () => {
    setAuth('authenticated');
    mockedFetchFavorites.mockResolvedValue([]);
    mockedAddFavorite.mockResolvedValue(true);

    const renderer = await renderButton();
    expect(labelOf(renderer)).toBe('관심 등록');

    await press(renderer);

    expect(mockedAddFavorite).toHaveBeenCalledWith(KEY);
    expect(labelOf(renderer)).toBe('관심 해제');
  });

  it('등록된 물건을 누르면 해제한다', async () => {
    setAuth('authenticated');
    mockedFetchFavorites.mockResolvedValue([KEY]);
    mockedRemoveFavorite.mockResolvedValue(true);

    const renderer = await renderButton();
    await press(renderer);

    expect(mockedRemoveFavorite).toHaveBeenCalledWith(KEY);
    expect(labelOf(renderer)).toBe('관심 등록');
  });

  it('사건키를 새 객체로 다시 넘겨도 목록을 다시 조회하지 않는다 (무한 조회 방지)', async () => {
    setAuth('authenticated');
    mockedFetchFavorites.mockResolvedValue([]);

    const renderer = await renderButton();
    await act(async () => {
      renderer.update(
        <FavoriteButton item={{ ...KEY }} onRequireLogin={onRequireLogin} />,
      );
    });

    expect(mockedFetchFavorites).toHaveBeenCalledTimes(1);
  });

  it('목록 조회가 실패하면 미등록으로 두고 다시 누를 수 있게 한다', async () => {
    setAuth('authenticated');
    mockedFetchFavorites.mockRejectedValue(new Error('network'));
    mockedAddFavorite.mockResolvedValue(true);

    const renderer = await renderButton();
    expect(labelOf(renderer)).toBe('관심 등록');

    await press(renderer);

    expect(mockedAddFavorite).toHaveBeenCalled();
  });
});
