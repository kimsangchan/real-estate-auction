import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { RisksScreen } from './RisksScreen';

describe('RisksScreen', () => {
  it('renders detected risk source text and next action without recommendation copy', () => {
    let renderer: TestRenderer.ReactTestRenderer | undefined;

    act(() => {
      renderer = TestRenderer.create(<RisksScreen />);
    });

    const tree = renderer?.toJSON();
    const serialized = JSON.stringify(tree);

    expect(serialized).toContain('유치권 신고 기재');
    expect(serialized).toContain('매각물건명세서');
    expect(serialized).toContain('원문');
    expect(serialized).toContain('다음 행동');
    expect(serialized).toContain('현장에서 점유자에게 유치권 주장 여부');
    expect(serialized).not.toContain('입찰 추천');
    expect(serialized).not.toContain('안전한 물건');
    expect(serialized).not.toContain('위험한 물건');
  });
});
