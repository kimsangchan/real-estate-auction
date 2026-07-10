import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import {
  CHECKLIST_STORAGE_DB,
  CHECKLIST_STORAGE_KEY,
  ChecklistScreen,
} from './ChecklistScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

const storage = createAsyncStorage(CHECKLIST_STORAGE_DB);

async function renderScreen() {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    renderer = TestRenderer.create(<ChecklistScreen />);
  });
  if (!renderer) throw new Error('renderer not created');
  return renderer;
}

describe('ChecklistScreen', () => {
  beforeEach(async () => {
    await storage.removeItem(CHECKLIST_STORAGE_KEY);
  });

  it('renders all checklist items grouped by category without judgment copy', async () => {
    const renderer = await renderScreen();
    const serialized = JSON.stringify(renderer.toJSON());

    expect(serialized).toContain('현장 확인');
    expect(serialized).toContain('서류 확인');
    expect(serialized).toContain('점유자에게 유치권 주장 여부 확인');
    expect(serialized).toContain('전입세대확인서 열람');
    expect(serialized).toContain('점유자 확인');
    expect(serialized).toContain('관리비 체납 확인');
    expect(serialized).toContain('0/4 확인함');
    expect(serialized).toContain('위험 감지');
    expect(serialized).toContain('서버로 전송되지 않아요');
    expect(serialized).not.toContain('입찰 추천');
    expect(serialized).not.toContain('안전한 물건');
    expect(serialized).not.toContain('위험한 물건');
  });

  it('toggles an item on tap, updates progress, and persists to storage', async () => {
    const renderer = await renderScreen();

    const target = renderer.root
      .findAll(node => node.props.accessibilityRole === 'checkbox')
      .find(node =>
        JSON.stringify(node.props.accessibilityLabel).includes('유치권'),
      );
    expect(target).toBeDefined();

    await act(async () => {
      target?.props.onPress();
    });

    expect(JSON.stringify(renderer.toJSON())).toContain('1/4 확인함');

    const saved = await storage.getItem(CHECKLIST_STORAGE_KEY);
    expect(saved).not.toBeNull();
    expect(JSON.parse(saved as string)).toEqual({ 'check-lien': true });
  });

  it('restores checked state saved in storage on mount', async () => {
    await storage.setItem(
      CHECKLIST_STORAGE_KEY,
      JSON.stringify({ 'check-lien': true, 'check-occupant': true }),
    );

    const renderer = await renderScreen();

    expect(JSON.stringify(renderer.toJSON())).toContain('2/4 확인함');
  });

  it('falls back to empty state when saved payload is corrupted', async () => {
    await storage.setItem(CHECKLIST_STORAGE_KEY, 'not-json{');

    const renderer = await renderScreen();

    expect(JSON.stringify(renderer.toJSON())).toContain('0/4 확인함');
  });
});
