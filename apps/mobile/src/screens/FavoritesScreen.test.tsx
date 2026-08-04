import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import type { AuctionItem } from '../api/auctionItems';
import { fetchFavorites, removeFavorite } from '../api/favorites';
import { useAuth } from '../auth/AuthContext';
import { FavoritesScreen } from './FavoritesScreen';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) => {
    // 포커스 대신 마운트 시 1회 실행 — 목록 로딩 경로는 그대로 탄다.
    require('react').useEffect(effect, [effect]);
  },
}));
jest.mock('../api/favorites', () => ({
  fetchFavorites: jest.fn(),
  removeFavorite: jest.fn(),
}));
jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockedFetchFavorites = fetchFavorites as jest.Mock;
const mockedRemoveFavorite = removeFavorite as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;

const navigation = { navigate: jest.fn() };
const signOut = jest.fn();
const removeAccount = jest.fn();

const ITEM: AuctionItem = {
  courtOfficeCode: 'B000210',
  caseNo: '2025타경755',
  itemNo: '1',
  courtName: '서울중앙지방법원',
  deptName: '경매1계',
  usageName: '아파트',
  areaM2: 84.99,
  address: '서울 관악구 신림동 1-1',
  appraisalAmount: 500000000,
  minimumSalePrice: 400000000,
  failedBidCount: 1,
  bidDatetime: null,
  assumedRightsKind: null,
  riskFlags: [],
  tenantCount: null,
  lng: null,
  lat: null,
};

function setAuth(status: 'loading' | 'authenticated' | 'anonymous') {
  mockedUseAuth.mockReturnValue({
    status,
    user: status === 'authenticated' ? { nickname: '홍길동' } : null,
    signIn: jest.fn(),
    signOut,
    removeAccount,
  });
}

let mounted: TestRenderer.ReactTestRenderer | undefined;

async function renderScreen() {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    renderer = TestRenderer.create(
      <FavoritesScreen navigation={navigation as any} route={{} as any} />,
    );
  });
  if (!renderer) throw new Error('renderer not created');
  mounted = renderer;
  return renderer;
}

// FlatList가 렌더 트리에 순환 참조를 남겨 JSON.stringify를 쓸 수 없다 — 화면의 글자만 모은다.
function screenText(renderer: TestRenderer.ReactTestRenderer): string {
  const parts: string[] = [];
  const visit = (node: TestRenderer.ReactTestInstance) => {
    for (const child of node.children) {
      if (typeof child === 'string') parts.push(child);
      else visit(child);
    }
  };
  visit(renderer.root);
  return parts.join(' ');
}

describe('FavoritesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // FlatList는 언마운트 전까지 타이머로 셀 렌더를 갱신한다 — 테스트 종료 후 경고를 남기지 않도록 정리한다.
  afterEach(async () => {
    await act(async () => {
      mounted?.unmount();
    });
    mounted = undefined;
  });

  it('비로그인이면 목록을 부르지 않고 로그인 안내를 보여준다 (T-04)', async () => {
    setAuth('anonymous');

    const renderer = await renderScreen();

    expect(screenText(renderer)).toContain(
      '로그인하면 관심 물건을 모아볼 수 있어요.',
    );
    expect(mockedFetchFavorites).not.toHaveBeenCalled();
  });

  it('로그인 안내의 로그인 버튼은 Login 화면으로 보낸다', async () => {
    setAuth('anonymous');
    const renderer = await renderScreen();

    const button = renderer.root
      .findAll(node => node.props.accessibilityRole === 'button')
      .at(0);
    await act(async () => {
      button?.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('Login');
  });

  it('로그인 상태면 닉네임과 관심 목록을 보여준다', async () => {
    setAuth('authenticated');
    mockedFetchFavorites.mockResolvedValue([ITEM]);

    const renderer = await renderScreen();
    const rendered = screenText(renderer);

    expect(rendered).toContain('홍길동');
    expect(rendered).toContain('서울 관악구 신림동 1-1');
    expect(rendered).toContain('회원 탈퇴');
  });

  it('관심 물건이 없으면 빈 상태 문구를 보여준다', async () => {
    setAuth('authenticated');
    mockedFetchFavorites.mockResolvedValue([]);

    const renderer = await renderScreen();

    expect(screenText(renderer)).toContain('등록한 관심 물건이 없어요.');
  });

  it('관심 해제를 누르면 목록에서 사라진다', async () => {
    setAuth('authenticated');
    mockedFetchFavorites.mockResolvedValue([ITEM]);
    mockedRemoveFavorite.mockResolvedValue('ok');

    const renderer = await renderScreen();
    const removeButton = renderer.root
      .findAll(node => node.props.accessibilityRole === 'button')
      .find(node =>
        String(node.props.accessibilityLabel ?? '').includes('관심 해제'),
      );
    expect(removeButton).toBeDefined();

    await act(async () => {
      removeButton?.props.onPress();
    });

    expect(mockedRemoveFavorite).toHaveBeenCalledWith(ITEM);
    expect(screenText(renderer)).toContain('등록한 관심 물건이 없어요.');
  });

  it('목록 조회가 실패하면 다시 시도를 안내한다', async () => {
    setAuth('authenticated');
    mockedFetchFavorites.mockRejectedValue(new Error('network'));

    const renderer = await renderScreen();

    expect(screenText(renderer)).toContain('관심 목록을 불러오지 못했어요.');
  });
});
