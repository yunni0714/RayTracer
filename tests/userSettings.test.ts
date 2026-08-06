import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  sanitizeSettings, loadLocalSettings, saveLocalSettings,
  DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY,
} from '../src/lib/userSettings';
import { useGameStore } from '../src/store/gameStore';

// vitest 환경이 node 라 localStorage 가 없다 (jsdom 미사용).
// 앱 코드는 접근 실패를 try/catch 로 흘려보내므로 왕복 검증만 스텁으로 세운다.
const memory = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => { memory.set(k, String(v)); },
  removeItem: (k: string) => { memory.delete(k); },
  clear: () => memory.clear(),
});

describe('sanitizeSettings — 손상 입력 방어', () => {
  it('정상 값을 그대로 통과시킨다', () => {
    expect(sanitizeSettings({ pastelCards: true })).toEqual({ pastelCards: true });
    expect(sanitizeSettings({ pastelCards: false })).toEqual({ pastelCards: false });
  });

  it('미지 키는 버린다', () => {
    const out = sanitizeSettings({ pastelCards: true, hackerMode: true, x: 1 });
    expect(out).toEqual({ pastelCards: true });
  });

  it('타입이 맞지 않으면 기본값으로 메운다', () => {
    expect(sanitizeSettings({ pastelCards: 'yes' })).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ pastelCards: 1 })).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ pastelCards: null })).toEqual(DEFAULT_SETTINGS);
  });

  it('어떤 쓰레기 입력에도 throw 하지 않고 기본값을 준다', () => {
    for (const raw of [null, undefined, 0, '', 'string', [], [1, 2], true, NaN]) {
      expect(() => sanitizeSettings(raw)).not.toThrow();
      expect(sanitizeSettings(raw)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('기본값 객체를 공유하지 않는다 (호출마다 새 객체)', () => {
    const a = sanitizeSettings(null);
    const b = sanitizeSettings(null);
    expect(a).not.toBe(b);
    expect(a).not.toBe(DEFAULT_SETTINGS);
  });
});

describe('localStorage 왕복', () => {
  beforeEach(() => localStorage.clear());

  it('저장한 값을 그대로 읽는다', () => {
    saveLocalSettings({ pastelCards: true });
    expect(loadLocalSettings()).toEqual({ pastelCards: true });
  });

  it('키가 없으면 기본값', () => {
    expect(loadLocalSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('JSON 이 깨져 있어도 throw 없이 기본값', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{not json');
    expect(() => loadLocalSettings()).not.toThrow();
    expect(loadLocalSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('저장된 값에 미지 키가 섞여 있어도 정제해서 읽는다', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ pastelCards: true, junk: 'x' }));
    expect(loadLocalSettings()).toEqual({ pastelCards: true });
  });
});

describe('store setSetting', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({ settings: { ...DEFAULT_SETTINGS } });
  });

  it('설정만 바꾸고 그리드 상태는 건드리지 않는다', () => {
    const before = useGameStore.getState().mapData;
    useGameStore.getState().setSetting('pastelCards', true);
    const s = useGameStore.getState();
    expect(s.settings.pastelCards).toBe(true);
    expect(s.mapData).toBe(before);
  });

  it('변경 즉시 localStorage 에 반영된다', () => {
    useGameStore.getState().setSetting('pastelCards', true);
    expect(loadLocalSettings()).toEqual({ pastelCards: true });
  });

  it('applySettings 는 서버 값으로 덮어쓰고 캐시도 갱신한다', () => {
    useGameStore.getState().setSetting('pastelCards', true);
    useGameStore.getState().applySettings({ pastelCards: false });
    expect(useGameStore.getState().settings.pastelCards).toBe(false);
    expect(loadLocalSettings()).toEqual({ pastelCards: false });
  });
});
