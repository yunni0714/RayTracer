import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../src/store/gameStore';
import type { LibraryPage } from '../src/lib/firebaseService';
import type { MapDocument } from '../src/types/game';

/* 라이브러리 목록이 limit(50) 한 방에서 커서 페이지네이션으로 바뀌면서 생긴
   스토어 계약의 회귀 방지.

   원래 버그: 조회가 "최신 50개" 로 잘려 있어서 그 밖의 오래된 맵은 클라이언트에
   도달조차 못 했다 (카탈로그·검색·필터가 전부 이 누적 배열 위에서만 돌기 때문에
   사실상 존재하지 않는 맵이 됐다). 이제 페이지를 이어 받으므로,
   ① 이어붙이기가 앞 페이지를 보존하고 ② 중복이 새어들지 않아야 한다. */

function mapDoc(id: string): MapDocument {
  return {
    id,
    title: `map-${id}`,
    author: 'tester',
    authorUid: 'uid',
    difficulty: 'Normal',
    mapData: [],
    reactionOk: 0,
    reactionGod: 0,
    diffVotes: {},
    createdAt: '2026-05-01T00:00:00.000Z',
    version: 1,
  };
}

// 커서는 Firestore 스냅샷이지만 스토어는 불투명하게 들고만 있는다 — 테스트에선 표식으로 충분.
function page(ids: string[], cursor: string | null, hasMore: boolean): LibraryPage {
  return {
    maps: ids.map(mapDoc),
    cursor: cursor as unknown as LibraryPage['cursor'],
    hasMore,
  };
}

describe('라이브러리 커서 페이지네이션 — 스토어', () => {
  beforeEach(() => {
    useGameStore.setState({
      allLibraryMaps: [],
      libraryCursor: null,
      libraryHasMore: true,
      libraryQueryKey: '',
    });
  });

  it('페이지를 이어 붙이고 커서·hasMore 를 갱신한다', () => {
    const s = useGameStore.getState();

    s.appendLibraryMaps(page(['a', 'b'], 'c-b', true));
    expect(useGameStore.getState().allLibraryMaps.map(m => m.id)).toEqual(['a', 'b']);
    expect(useGameStore.getState().libraryCursor).toBe('c-b');
    expect(useGameStore.getState().libraryHasMore).toBe(true);

    s.appendLibraryMaps(page(['c', 'd'], 'c-d', false));
    expect(useGameStore.getState().allLibraryMaps.map(m => m.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(useGameStore.getState().libraryCursor).toBe('c-d');
    expect(useGameStore.getState().libraryHasMore).toBe(false);
  });

  it('페이지 경계가 밀려 같은 맵이 다시 와도 중복으로 쌓지 않는다', () => {
    // 로드 도중 새 맵이 등록되면 커서 기준이 밀려 직전 페이지의 꼬리가 다시 올 수 있다
    const s = useGameStore.getState();
    s.appendLibraryMaps(page(['a', 'b', 'c'], 'c-c', true));
    s.appendLibraryMaps(page(['c', 'd'], 'c-d', true));

    expect(useGameStore.getState().allLibraryMaps.map(m => m.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('전부 중복인 페이지는 배열 참조를 바꾸지 않는다 (불필요한 리렌더 방지)', () => {
    const s = useGameStore.getState();
    s.appendLibraryMaps(page(['a', 'b'], 'c-b', true));
    const before = useGameStore.getState().allLibraryMaps;

    s.appendLibraryMaps(page(['a', 'b'], 'c-b2', true));
    expect(useGameStore.getState().allLibraryMaps).toBe(before);
    // 커서는 그래도 전진해야 한다 — 아니면 같은 페이지를 무한히 다시 받는다
    expect(useGameStore.getState().libraryCursor).toBe('c-b2');
  });

  it('쿼리 키가 바뀌면 누적본·커서를 버리고 처음부터 받는다', () => {
    const s = useGameStore.getState();
    s.appendLibraryMaps(page(['a', 'b'], 'c-b', false));

    s.resetLibraryPage('reactionGod|Insane');

    const next = useGameStore.getState();
    expect(next.allLibraryMaps).toEqual([]);
    expect(next.libraryCursor).toBeNull();
    expect(next.libraryHasMore).toBe(true); // 새 쿼리는 아직 끝을 모른다
    expect(next.libraryQueryKey).toBe('reactionGod|Insane');
  });
});
