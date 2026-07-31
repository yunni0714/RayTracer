import { describe, it, expect } from 'vitest';
import {
  filterMaps, sortMaps, computeMapStats, rotateMapItem, setMapItemRotation,
  findItemIndexAt, formatDateTime,
} from '../src/lib/adminMaps';
import type { Difficulty, MapDocument, MapItemDTO, Rotation } from '../src/types/game';

function map(p: Partial<MapDocument> & { id: string }): MapDocument {
  return {
    title: '제목', author: '작성자', authorUid: 'uid', difficulty: 'Normal' as Difficulty,
    mapData: [], reactionOk: 0, reactionGod: 0, diffVotes: {},
    createdAt: '2026-01-01T00:00:00.000Z', version: 1,
    ...p,
  };
}

function item(x: number, y: number, rotation: Rotation = 0): MapItemDTO {
  return { x, y, type: 'mirror', rotation, canMove: false, canRotate: true, isInventory: false };
}

describe('filterMaps', () => {
  const maps = [
    map({ id: 'a', title: 'Laser Puzzle', author: 'Kim' }),
    map({ id: 'b', title: '거울의 방', author: 'RayOriginal' }),
    map({ id: 'c', title: 'MIRROR', author: '이순신' }),
  ];

  it('빈 쿼리/공백은 전체를 반환한다', () => {
    expect(filterMaps(maps, '').map(m => m.id)).toEqual(['a', 'b', 'c']);
    expect(filterMaps(maps, '   ').map(m => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('제목 부분일치 (대소문자 무시)', () => {
    expect(filterMaps(maps, 'mirror').map(m => m.id)).toEqual(['c']);
    expect(filterMaps(maps, '거울').map(m => m.id)).toEqual(['b']);
  });

  it('작성자도 매치한다', () => {
    expect(filterMaps(maps, 'rayoriginal').map(m => m.id)).toEqual(['b']);
    expect(filterMaps(maps, '이순').map(m => m.id)).toEqual(['c']);
  });

  it('원본 배열을 변형하지 않는다', () => {
    const copy = [...maps];
    filterMaps(maps, 'mirror');
    expect(maps).toEqual(copy);
  });
});

describe('sortMaps', () => {
  const maps = [
    map({ id: 'old', createdAt: '2025-01-01T00:00:00.000Z', reactionGod: 5, reactionOk: 1 }),
    map({ id: 'new', createdAt: '2026-06-01T00:00:00.000Z', reactionGod: 1, reactionOk: 9 }),
    map({ id: 'mid', createdAt: '2026-01-01T00:00:00.000Z', reactionGod: 3, reactionOk: 4 }),
  ];

  it('createdAt 내림차순 (최신 먼저)', () => {
    expect(sortMaps(maps, 'createdAt').map(m => m.id)).toEqual(['new', 'mid', 'old']);
  });

  it('reactionGod / reactionOk 내림차순', () => {
    expect(sortMaps(maps, 'reactionGod').map(m => m.id)).toEqual(['old', 'mid', 'new']);
    expect(sortMaps(maps, 'reactionOk').map(m => m.id)).toEqual(['new', 'mid', 'old']);
  });

  it('누락 필드는 0/빈문자로 취급하고 throw 하지 않는다', () => {
    const partial = [
      map({ id: 'x', reactionGod: undefined as unknown as number, createdAt: undefined as unknown as string }),
      map({ id: 'y', reactionGod: 2 }),
    ];
    expect(sortMaps(partial, 'reactionGod').map(m => m.id)).toEqual(['y', 'x']);
    expect(() => sortMaps(partial, 'createdAt')).not.toThrow();
  });

  it('원본 배열을 변형하지 않는다', () => {
    const order = maps.map(m => m.id);
    sortMaps(maps, 'reactionGod');
    expect(maps.map(m => m.id)).toEqual(order);
  });
});

describe('computeMapStats', () => {
  const maps = [
    map({ id: '1', difficulty: 'Easy', reactionOk: 2, reactionGod: 1 }),
    map({ id: '2', difficulty: 'Easy', reactionOk: 3, reactionGod: 7 }),
    map({ id: '3', difficulty: 'Insane', reactionOk: 0, reactionGod: 4 }),
  ];

  it('합계와 난이도 분포', () => {
    const s = computeMapStats(maps);
    expect(s.total).toBe(3);
    expect(s.totalOk).toBe(5);
    expect(s.totalGod).toBe(12);
    expect(s.byDifficulty).toEqual({ Tutor: 0, Easy: 2, Normal: 0, Hard: 0, Insane: 1 });
  });

  it('Top 5 는 각 반응 기준 내림차순, 5개 미만이면 있는 만큼', () => {
    const s = computeMapStats(maps);
    expect(s.topGod.map(m => m.id)).toEqual(['2', '3', '1']);
    expect(s.topOk.map(m => m.id)).toEqual(['2', '1', '3']);
  });

  it('6개 이상이면 5개로 자른다', () => {
    const many = Array.from({ length: 8 }, (_, i) => map({ id: `m${i}`, reactionGod: i }));
    const s = computeMapStats(many);
    expect(s.topGod.map(m => m.id)).toEqual(['m7', 'm6', 'm5', 'm4', 'm3']);
  });

  it('빈 목록', () => {
    const s = computeMapStats([]);
    expect(s).toMatchObject({ total: 0, totalOk: 0, totalGod: 0 });
    expect(s.topGod).toEqual([]);
    expect(s.byDifficulty.Normal).toBe(0);
  });

  it('알 수 없는 난이도는 분포에 넣지 않는다 (throw 없음)', () => {
    const s = computeMapStats([map({ id: 'z', difficulty: 'Weird' as Difficulty })]);
    expect(s.total).toBe(1);
    expect(Object.values(s.byDifficulty).reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe('회전 편집', () => {
  const items = [item(0, 0, 90), item(2, 3, 315)];

  it('rotateMapItem — 델타 적용, 원본 불변', () => {
    const next = rotateMapItem(items, 0, 90);
    expect(next[0].rotation).toBe(180);
    expect(items[0].rotation).toBe(90);
    expect(next).not.toBe(items);
  });

  it('rotateMapItem — 360 랩어라운드 (양·음 방향)', () => {
    expect(rotateMapItem(items, 1, 45)[1].rotation).toBe(0);   // 315 + 45
    expect(rotateMapItem(items, 0, -135)[0].rotation).toBe(315); // 90 - 135
    expect(rotateMapItem(items, 0, -450)[0].rotation).toBe(0);   // 두 바퀴 이상
  });

  it('rotateMapItem — 다른 기물은 그대로 (참조 유지)', () => {
    const next = rotateMapItem(items, 0, 45);
    expect(next[1]).toBe(items[1]);
  });

  it('setMapItemRotation — 절대값 지정, 범위 밖 인덱스는 무시', () => {
    expect(setMapItemRotation(items, 1, 135)[1].rotation).toBe(135);
    expect(setMapItemRotation(items, 5, 90)).toBe(items);
    expect(setMapItemRotation(items, -1, 90)).toBe(items);
  });

  it('회전 외 필드는 보존한다 (인벤토리/특성 유실 방지)', () => {
    const inv: MapItemDTO[] = [{ x: 1, y: 1, type: 'tunnel', rotation: 0, canMove: true, canRotate: true, isInventory: true }];
    const next = rotateMapItem(inv, 0, 90);
    expect(next[0]).toEqual({ ...inv[0], rotation: 90 });
  });
});

describe('findItemIndexAt / formatDateTime', () => {
  it('좌표로 인덱스를 찾고, 없으면 -1', () => {
    const items = [item(0, 0), item(2, 3)];
    expect(findItemIndexAt(items, 2, 3)).toBe(1);
    expect(findItemIndexAt(items, 4, 4)).toBe(-1);
  });

  it('잘못된 날짜와 누락은 안내 문구', () => {
    expect(formatDateTime(undefined)).toBe('날짜 없음');
    expect(formatDateTime('쓰레기값')).toBe('날짜 없음');
    expect(formatDateTime('2026-01-01T00:00:00.000Z')).not.toBe('날짜 없음');
  });
});
