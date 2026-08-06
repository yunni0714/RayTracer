import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NotificationDocument } from '../src/types/game';

// Firebase 는 실제로 부르지 않는다 — firebaseService 를 통째로 대체.
// (src/lib/firebase.ts 가 import.meta.env 로 initializeApp 하므로 로드 자체를 피한다)
const fetchInbox = vi.fn();
vi.mock('../src/lib/firebaseService', () => ({
  fetchInbox: (...args: unknown[]) => fetchInbox(...args),
}));

const { refreshInbox, __resetInboxThrottle } = await import('../src/hooks/useInboxRefresh');
const { useGameStore } = await import('../src/store/gameStore');

function notif(id: string): NotificationDocument {
  return {
    id, type: 'suggestion', read: false, createdAt: '2026-08-01T00:00:00.000Z',
    fromUid: 'u2', fromNickname: 'lee', mapId: 'm1', mapTitle: '맵',
  };
}

describe('refreshInbox — 스로틀', () => {
  beforeEach(() => {
    fetchInbox.mockReset();
    __resetInboxThrottle();
    useGameStore.setState({ inbox: [], inboxLoaded: false });
  });

  it('첫 호출은 조회하고 스토어에 반영한다', async () => {
    fetchInbox.mockResolvedValue([notif('n1')]);
    await refreshInbox('u1');
    expect(fetchInbox).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().inbox).toHaveLength(1);
    expect(useGameStore.getState().inboxLoaded).toBe(true);
  });

  it('스로틀 구간(60초) 안의 두 번째 호출은 조회하지 않는다', async () => {
    fetchInbox.mockResolvedValue([]);
    await refreshInbox('u1');
    await refreshInbox('u1');
    await refreshInbox('u1');
    expect(fetchInbox).toHaveBeenCalledTimes(1);
  });

  it('force=true 는 스로틀을 무시한다 (모달 열림 · 로그인 직후)', async () => {
    fetchInbox.mockResolvedValue([]);
    await refreshInbox('u1');
    await refreshInbox('u1', true);
    expect(fetchInbox).toHaveBeenCalledTimes(2);
  });

  it('스로틀이 지나면 다시 조회한다', async () => {
    fetchInbox.mockResolvedValue([]);
    await refreshInbox('u1');
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);
    await refreshInbox('u1');
    expect(fetchInbox).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });
});

describe('refreshInbox — 실패 처리', () => {
  beforeEach(() => {
    fetchInbox.mockReset();
    __resetInboxThrottle();
    useGameStore.setState({ inbox: [notif('keep')], inboxLoaded: true });
  });

  it('조회가 거부돼도 throw 하지 않고 기존 알림함을 유지한다', async () => {
    // firestore.rules 미배포 상태에서 실제로 나는 에러
    fetchInbox.mockRejectedValue(new Error('permission-denied'));
    await expect(refreshInbox('u1')).resolves.toBeUndefined();
    expect(useGameStore.getState().inbox).toHaveLength(1);
    expect(useGameStore.getState().inbox[0].id).toBe('keep');
  });

  it('실패해도 스로틀 타임스탬프는 소비된다 (재시도 폭주 방지)', async () => {
    fetchInbox.mockRejectedValue(new Error('permission-denied'));
    await refreshInbox('u1');
    await refreshInbox('u1');
    expect(fetchInbox).toHaveBeenCalledTimes(1);
  });
});
