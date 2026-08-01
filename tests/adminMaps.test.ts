import { describe, it, expect } from 'vitest';
import {
  filterMaps, sortMaps, computeMapStats, rotateMapItem, setMapItemRotation,
  findItemIndexAt, formatDateTime,
  collectPieceTypeCounts, applyBulkRotationToItems, planBulkRotation,
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

/* ── 일괄 회전 ────────────────────────────────────────── */

function piece(p: Partial<MapItemDTO> & { type: string }): MapItemDTO {
  return {
    x: 0, y: 0, rotation: 0, canMove: false, canRotate: true, isInventory: false,
    ...p,
  } as MapItemDTO;
}

const bulkMaps: MapDocument[] = [
  map({
    id: 'm1', title: '맵1',
    mapData: [
      piece({ type: 'mirror', x: 0, y: 0, rotation: 0 }),
      piece({ type: 'mirror', x: 1, y: 0, rotation: 90 }),
      piece({ type: 'block', x: 2, y: 0, rotation: 0, canRotate: false }),
      piece({ type: 'mirror', x: 3, y: 0, rotation: 45, isInventory: true }),
    ],
  }),
  map({
    id: 'm2', title: '맵2',
    mapData: [
      piece({ type: 'target', x: 0, y: 1, rotation: 180 }),
      piece({ type: 'mirror', x: 1, y: 1, rotation: 270 }),
    ],
  }),
  map({ id: 'm3', title: '맵3', mapData: [piece({ type: 'target', x: 0, y: 0, rotation: 0 })] }),
];

describe('collectPieceTypeCounts', () => {
  it('기물 수 내림차순으로 타입·기물수·맵수를 센다', () => {
    const counts = collectPieceTypeCounts(bulkMaps, { includeInventory: true, rotatableOnly: false });
    expect(counts.map(c => c.type)).toEqual(['mirror', 'target', 'block']);
    expect(counts[0]).toEqual({ type: 'mirror', pieces: 4, maps: 2 });
    expect(counts[1]).toEqual({ type: 'target', pieces: 2, maps: 2 });
  });

  it('인벤토리 제외 / 회전 가능만 필터가 집계에 반영된다', () => {
    const noInv = collectPieceTypeCounts(bulkMaps, { includeInventory: false, rotatableOnly: false });
    expect(noInv.find(c => c.type === 'mirror')).toEqual({ type: 'mirror', pieces: 3, maps: 2 });

    const rotOnly = collectPieceTypeCounts(bulkMaps, { includeInventory: true, rotatableOnly: true });
    expect(rotOnly.some(c => c.type === 'block')).toBe(false);
  });
});

describe('applyBulkRotationToItems', () => {
  const filter = { types: ['mirror'], includeInventory: false, rotatableOnly: false };

  it('선택 타입만 상대 회전하고 나머지는 참조까지 보존한다', () => {
    const items = bulkMaps[0].mapData;
    const { items: next, changed } = applyBulkRotationToItems(items, filter, { mode: 'delta', delta: 90 });
    expect(changed).toBe(2);
    expect(next[0].rotation).toBe(90);
    expect(next[1].rotation).toBe(180);
    expect(next[2]).toBe(items[2]);          // block — 대상 아님
    expect(next[3]).toBe(items[3]);          // 인벤토리 제외
  });

  it('절대 지정은 이미 그 각도인 기물을 변경으로 세지 않는다', () => {
    const items = bulkMaps[0].mapData;
    const { items: next, changed } = applyBulkRotationToItems(items, filter, { mode: 'set', rotation: 0 });
    expect(changed).toBe(1);                 // rotation 90 짜리 하나만
    expect(next[1].rotation).toBe(0);
  });

  it('변경이 없으면 원본 배열을 그대로 돌려준다', () => {
    const items = bulkMaps[0].mapData;
    const res = applyBulkRotationToItems(items, { ...filter, types: [] }, { mode: 'delta', delta: 90 });
    expect(res.items).toBe(items);
    expect(res.changed).toBe(0);
  });

  it('음수/360 초과 회전을 정규화한다', () => {
    const items = [piece({ type: 'mirror', rotation: 45 })];
    expect(applyBulkRotationToItems(items, filter, { mode: 'delta', delta: -90 }).items[0].rotation).toBe(315);
    expect(applyBulkRotationToItems(items, filter, { mode: 'delta', delta: 360 }).changed).toBe(0);
  });

  it('회전 외 필드는 보존한다', () => {
    const items = [piece({ type: 'mirror', x: 2, y: 3, rotation: 0, canMove: true })];
    const next = applyBulkRotationToItems(items, filter, { mode: 'set', rotation: 90 }).items;
    expect(next[0]).toEqual({ ...items[0], rotation: 90 });
  });
});

describe('planBulkRotation', () => {
  it('실제로 바뀌는 맵만 계획에 담는다', () => {
    const plan = planBulkRotation(
      bulkMaps,
      { types: ['mirror'], includeInventory: false, rotatableOnly: false },
      { mode: 'delta', delta: 45 },
    );
    expect(plan.map(p => p.id)).toEqual(['m1', 'm2']); // m3 에는 mirror 가 없다
    expect(plan[0].changed).toBe(2);
    expect(plan[1].changed).toBe(1);
    expect(plan[0].items).toHaveLength(4);             // 전체 mapData 를 저장한다
  });

  it('대상 타입이 없으면 빈 계획', () => {
    expect(planBulkRotation(bulkMaps, { types: [], includeInventory: true, rotatableOnly: false }, { mode: 'set', rotation: 0 })).toEqual([]);
  });

  it('원본 맵의 mapData 는 변형되지 않는다', () => {
    const before = JSON.stringify(bulkMaps);
    planBulkRotation(bulkMaps, { types: ['mirror', 'target'], includeInventory: true, rotatableOnly: false }, { mode: 'delta', delta: 90 });
    expect(JSON.stringify(bulkMaps)).toBe(before);
  });
});
