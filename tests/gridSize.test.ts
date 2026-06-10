import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, emptyGrid } from '../src/store/gameStore';
import type { CellData } from '../src/types/game';

function piece(): CellData {
  return { type: 'mirror', rotation: 0, canMove: false, canRotate: false, isInventory: false };
}

describe('store gridSize', () => {
  beforeEach(() => {
    useGameStore.setState({
      mapData: emptyGrid(),
      gridSize: 5,
      isEditorMode: true,
      undoStack: [],
      selectedCell: null,
    });
  });

  it('emptyGrid(size) 는 NxN 그리드를 만든다', () => {
    expect(emptyGrid(7)).toHaveLength(7);
    expect(emptyGrid(7)[0]).toHaveLength(7);
    expect(emptyGrid()).toHaveLength(5);
  });

  it('setGridSize 확대: 기존 기물 보존', () => {
    const g = emptyGrid();
    g[2][2] = piece();
    useGameStore.setState({ mapData: g });

    useGameStore.getState().setGridSize(7);
    const s = useGameStore.getState();
    expect(s.gridSize).toBe(7);
    expect(s.mapData).toHaveLength(7);
    expect(s.mapData[2][2]?.type).toBe('mirror');
  });

  it('setGridSize 축소: 범위 밖 기물 삭제, 안쪽 보존', () => {
    const g = emptyGrid(7);
    g[1][1] = piece();
    g[6][6] = piece();
    useGameStore.setState({ mapData: g, gridSize: 7 });

    useGameStore.getState().setGridSize(5);
    const s = useGameStore.getState();
    expect(s.mapData).toHaveLength(5);
    expect(s.mapData[1][1]?.type).toBe('mirror');
    // (6,6) 은 잘려나감 — 전체 기물 수 1
    const count = s.mapData.flat().filter(Boolean).length;
    expect(count).toBe(1);
  });

  it('테스트 모드에서는 리사이즈 불가', () => {
    useGameStore.setState({ isEditorMode: false });
    useGameStore.getState().setGridSize(9);
    expect(useGameStore.getState().mapData).toHaveLength(5);
  });

  it('setMapData 는 gridSize 를 데이터 크기와 동기화한다', () => {
    useGameStore.getState().setMapData(emptyGrid(8));
    expect(useGameStore.getState().gridSize).toBe(8);
  });
});
