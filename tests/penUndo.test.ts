import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, emptyGrid } from '../src/store/gameStore';
import type { CellData, PenStroke } from '../src/types/game';

function stroke(tool: PenStroke['tool'] = 'blue'): PenStroke {
  return { tool, width: 3, pts: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }] };
}

function cell(over: Partial<CellData> = {}): CellData {
  return { type: 'mirror', rotation: 0, canMove: true, canRotate: false, isInventory: true, ...over };
}

describe('undo 필기(pen) 통합', () => {
  beforeEach(() => {
    useGameStore.setState({
      mapData: emptyGrid(),
      gridSize: 5,
      isEditorMode: false,
      isMapEditMode: false,
      playerInventory: {},
      undoStack: [],
      penStrokes: [],
      editorMapDataBackup: null,
      editorInventoryBackup: null,
      mapEditOriginalBackup: null,
    });
  });

  it('획 커밋(스냅샷→setPenStrokes) 후 undo 하면 획이 하나씩 되돌아간다', () => {
    const st = () => useGameStore.getState();
    st().saveUndoSnapshot();
    st().setPenStrokes([stroke('blue')]);
    st().saveUndoSnapshot();
    st().setPenStrokes([stroke('blue'), stroke('red')]);
    expect(st().penStrokes).toHaveLength(2);

    st().undo();
    expect(st().penStrokes).toHaveLength(1);
    expect(st().penStrokes[0].tool).toBe('blue');

    st().undo();
    expect(st().penStrokes).toHaveLength(0);
  });

  it('기물 스냅샷도 펜 상태를 포함한다 — 혼합 순서 undo', () => {
    const st = () => useGameStore.getState();
    // 1) 획 하나 커밋
    st().saveUndoSnapshot();
    st().setPenStrokes([stroke('green')]);
    // 2) 기물 배치 (배치 전 스냅샷 — useGridDragDrop 과 동일 순서)
    st().saveUndoSnapshot();
    st().setCell(2, 2, cell());
    expect(st().mapData[2][2]).not.toBeNull();
    expect(st().penStrokes).toHaveLength(1);

    // undo 1: 기물 배치 취소, 펜은 유지
    st().undo();
    expect(st().mapData[2][2]).toBeNull();
    expect(st().penStrokes).toHaveLength(1);

    // undo 2: 획도 되돌아간다
    st().undo();
    expect(st().penStrokes).toHaveLength(0);
  });

  it('전체 지우기(빈 배열 커밋)도 undo 로 복원된다', () => {
    const st = () => useGameStore.getState();
    st().saveUndoSnapshot();
    st().setPenStrokes([stroke('red'), stroke('blue')]);
    st().saveUndoSnapshot();
    st().setPenStrokes([]); // 전체 지우기

    st().undo();
    expect(st().penStrokes).toHaveLength(2);
  });

  it('맵 로드/모드 전환 시 penStrokes 가 초기화된다', () => {
    const st = () => useGameStore.getState();
    st().setPenStrokes([stroke()]);
    st().loadMapForPlay(emptyGrid(), null);
    expect(st().penStrokes).toHaveLength(0);

    st().setPenStrokes([stroke()]);
    useGameStore.setState({ isEditorMode: false });
    st().toggleMode(); // 테스트 → 에디터
    expect(st().penStrokes).toHaveLength(0);
  });
});
