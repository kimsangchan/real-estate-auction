import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { RisksScreen } from './RisksScreen';

type Navigation = NativeStackScreenProps<
  RootStackParamList,
  'Risks'
>['navigation'];

function createNavigation() {
  return { navigate: jest.fn() } as unknown as Navigation;
}

function renderScreen(navigation: Navigation) {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(<RisksScreen navigation={navigation} />);
  });
  if (!renderer) throw new Error('renderer not created');
  return renderer;
}

describe('RisksScreen', () => {
  it('renders detected risk source text and next action without recommendation copy', () => {
    const renderer = renderScreen(createNavigation());

    const serialized = JSON.stringify(renderer.toJSON());

    expect(serialized).toContain('유치권 신고 기재');
    expect(serialized).toContain('매각물건명세서');
    expect(serialized).toContain('원문');
    expect(serialized).toContain('다음 행동');
    expect(serialized).toContain('현장에서 점유자에게 유치권 주장 여부');
    expect(serialized).not.toContain('입찰 추천');
    expect(serialized).not.toContain('안전한 물건');
    expect(serialized).not.toContain('위험한 물건');
  });

  it('navigates to the checklist when the link is pressed', () => {
    const navigation = createNavigation();
    const renderer = renderScreen(navigation);

    const link = renderer.root
      .findAll(node => node.props.accessibilityRole === 'button')
      .find(node =>
        String(node.props.accessibilityLabel).includes('임장 체크리스트'),
      );
    expect(link).toBeDefined();

    act(() => {
      link?.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('Checklist');
  });
});
