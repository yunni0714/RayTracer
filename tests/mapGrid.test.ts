import { describe, it, expect } from 'vitest';
import { itemsToGrid, mapDocToGrid } from '../src/lib/mapGrid';
import type { MapDocument, MapItemDTO } from '../src/types/game';

function item(partial: Partial<MapItemDTO> & { x: number; y: number }): MapItemDTO {
  return {
    type: 'mirror', rotation: 0, canMove: false, canRotate: false, isInventory: false,
    ...partial,
  };
}

function doc(partial: Partial<MapDocument>): MapDocument {
  return {
    id: 'm1', title: '테스트', author: 'kim', authorUid: 'u1', difficulty: 'Easy',
    mapData: [], reactionOk: 0, reactionGod: 0, diffVotes: {},
    createdAt: '2026-08-01T00:00:00.000Z', version: 1,
    ...partial,
  };
}

describe('itemsToGrid', () => {
  it('빈 목록은 전부 null 인 NxN', () => {
    const g = itemsToGrid([], 5);
    expect(g).toHaveLength(5);
    expect(g.every(row => row.length === 5 && row.every(c => c === null))).toBe(true);
  });

  it('DTO 를 [y][x] 위치에 꽂는다 (행=y, 열=x)', () => {
    const g = itemsToGrid([item({ x: 1, y: 3, type: 'ray' })], 5);
    expect(g[3][1]?.type).toBe('ray');
    expect(g[1][3]).toBeNull(); // 좌표가 뒤집히지 않았는지
  });

  it('CellData 필드를 그대로 보존한다', () => {
    const g = itemsToGrid([item({
      x: 0, y: 0, type: 'target', rotation: 270,
      canMove: true, canRotate: true, isInventory: true,
    })], 5);
    expect(g[0][0]).toEqual({
      type: 'target', rotation: 270, canMove: true, canRotate: true, isInventory: true,
    });
  });

  it('범위 밖 아이템은 버린다 (큰 맵을 줄여 저장한 경우 방어)', () => {
    const g = itemsToGrid([
      item({ x: 8, y: 0 }), item({ x: 0, y: 8 }),
      item({ x: -1, y: 0 }), item({ x: 0, y: -1 }),
      item({ x: 4, y: 4, type: 'ray' }),
    ], 5);
    const placed = g.flat().filter(Boolean);
    expect(placed).toHaveLength(1);
    expect(g[4][4]?.type).toBe('ray');
  });

  it('각 행이 독립 배열이다 (행 공유로 인한 오염 방지)', () => {
    const g = itemsToGrid([], 3);
    g[0][0] = { type: 'ray', rotation: 0, canMove: false, canRotate: false, isInventory: false };
    expect(g[1][0]).toBeNull();
    expect(g[2][0]).toBeNull();
  });
});

describe('mapDocToGrid', () => {
  it('gridSize 를 따른다', () => {
    const g = mapDocToGrid(doc({ gridSize: 9, mapData: [item({ x: 8, y: 8, type: 'ray' })] }));
    expect(g).toHaveLength(9);
    expect(g[8][8]?.type).toBe('ray');
  });

  it('gridSize 가 없으면 5 (구 스키마 하위호환)', () => {
    const g = mapDocToGrid(doc({ mapData: [item({ x: 4, y: 4 })] }));
    expect(g).toHaveLength(5);
    expect(g[4][4]).not.toBeNull();
  });

  it('gridSize 가 없는 문서의 5×5 범위 밖 기물은 버려진다', () => {
    const g = mapDocToGrid(doc({ mapData: [item({ x: 7, y: 7 })] }));
    expect(g.flat().filter(Boolean)).toHaveLength(0);
  });
});
