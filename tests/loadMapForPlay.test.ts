import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, emptyGrid, invKey } from '../src/store/gameStore';
import type { CellData, MapDocument, MapItemDTO, Rotation } from '../src/types/game';

function cell(over: Partial<CellData> = {}): CellData {
  return { type: 'mirror', rotation: 0, canMove: false, canRotate: false, isInventory: false, ...over };
}

function mapDoc(mapData: MapItemDTO[], gridSize = 5): MapDocument {
  return {
    id: 'test-map', title: 't', author: 'a', authorUid: 'uid', difficulty: 'Normal',
    mapData, gridSize, reactionOk: 0, reactionGod: 0, diffVotes: {},
    createdAt: new Date().toISOString(), version: 1,
  };
}

describe('loadMapForPlay 회전 정규화', () => {
  beforeEach(() => {
    useGameStore.setState({
      mapData: emptyGrid(),
      gridSize: 5,
      isEditorMode: true,
      playerInventory: {},
      editorMapDataBackup: null,
      currentLoadedMapObj: null,
      undoStack: [],
      selectedCell: null,
      isAnswerShown: false,
      answerMapBackup: null,
      answerInventoryBackup: null,
    });
  });

  it('보드 고정 회전형 기물(canRotate && !isInventory)은 rotation 0으로 시작한다', () => {
    const g = emptyGrid();
    g[2][2] = cell({ canRotate: true, rotation: 135 });
    useGameStore.getState().loadMapForPlay(g, null);

    expect(useGameStore.getState().mapData[2][2]?.rotation).toBe(0);
  });

  it('회전 불가 기물(canRotate: false)은 저장된 회전을 유지한다', () => {
    const g = emptyGrid();
    g[1][1] = cell({ canRotate: false, rotation: 45 });
    useGameStore.getState().loadMapForPlay(g, null);

    expect(useGameStore.getState().mapData[1][1]?.rotation).toBe(45);
  });

  it('인벤토리 기물은 그리드에서 제거되고 rot 0 키로 인벤토리에 등록된다', () => {
    const g = emptyGrid();
    g[3][3] = cell({ canRotate: true, rotation: 90, isInventory: true });
    useGameStore.getState().loadMapForPlay(g, null);

    const s = useGameStore.getState();
    expect(s.mapData[3][3]).toBeNull();
    const key = invKey('mirror', true, 90);
    expect(key).toBe('mirror_true_0');
    expect(s.playerInventory[key]?.count).toBe(1);
    expect(s.playerInventory[key]?.rotation).toBe(0);
  });

  it('editorMapDataBackup 은 원본 회전을 보존한다 (맵 수정 저장 경로의 불변식)', () => {
    const g = emptyGrid();
    g[2][2] = cell({ canRotate: true, rotation: 135 });
    useGameStore.getState().loadMapForPlay(g, null);

    expect(useGameStore.getState().editorMapDataBackup?.[2][2]?.rotation).toBe(135);
  });

  it('enterMapEditMode 는 원본 회전을 복원한다', () => {
    const g = emptyGrid();
    g[2][2] = cell({ canRotate: true, rotation: 270 });
    useGameStore.getState().loadMapForPlay(g, null);
    useGameStore.getState().enterMapEditMode();

    expect(useGameStore.getState().mapData[2][2]?.rotation).toBe(270);
  });

  it('showAnswer 는 정답 회전을 표시하고 hideAnswer 는 플레이 상태로 복원한다', () => {
    const items: MapItemDTO[] = [
      { x: 2, y: 2, type: 'mirror', rotation: 135, canMove: false, canRotate: true, isInventory: false },
    ];
    const doc = mapDoc(items);
    const g = emptyGrid();
    g[2][2] = cell({ canRotate: true, rotation: 135 });
    useGameStore.getState().loadMapForPlay(g, doc);

    expect(useGameStore.getState().mapData[2][2]?.rotation).toBe(0);

    useGameStore.getState().showAnswer();
    expect(useGameStore.getState().mapData[2][2]?.rotation).toBe(135);

    useGameStore.getState().hideAnswer();
    expect(useGameStore.getState().mapData[2][2]?.rotation).toBe(0);
  });

  it('canRotate 필드가 없는 레거시 셀은 회전을 유지한다', () => {
    const g = emptyGrid();
    g[4][4] = {
      type: 'mirror', rotation: 90 as Rotation, canMove: false, isInventory: false,
    } as CellData; // 구 Firestore 문서: canRotate 누락
    useGameStore.getState().loadMapForPlay(g, null);

    expect(useGameStore.getState().mapData[4][4]?.rotation).toBe(90);
  });
});
