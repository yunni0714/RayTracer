import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, emptyGrid, getAuthoredGrid, invKey } from '../src/store/gameStore';
import type { CellData } from '../src/types/game';

function cell(over: Partial<CellData> = {}): CellData {
  return { type: 'mirror', rotation: 0, canMove: false, canRotate: false, isInventory: false, ...over };
}

// 맵 수정 중 테스트(플레이) 상태로 전환한 뒤 저장하면, 인벤토리에 남아 있는
// (그리드에 배치하지 않은) 기물이 유실되던 버그의 회귀 방지.
// 저장 경로(UploadModal·exitMapEditMode restore:false)는 getAuthoredGrid 를 공유한다.
describe('맵 수정 저장 — 테스트 상태 인벤토리 기물 보존', () => {
  beforeEach(() => {
    useGameStore.setState({
      mapData: emptyGrid(),
      gridSize: 5,
      isEditorMode: true,
      isMapEditMode: false,
      playerInventory: {},
      undoStack: [],
      penStrokes: [],
      editorMapDataBackup: null,
      editorInventoryBackup: null,
      mapEditOriginalBackup: null,
      currentLoadedMapObj: null,
    });
  });

  function setupMapEditWithInventory() {
    const g = emptyGrid();
    g[0][0] = cell(); // 고정 기물
    g[1][1] = cell({ isInventory: true, canMove: true }); // 인벤토리 기물
    useGameStore.setState({
      mapData: g,
      isEditorMode: true,
      isMapEditMode: true,
      mapEditOriginalBackup: g.map(r => r.map(c => c ? { ...c } : null)),
    });
  }

  it('에디터 상태: getAuthoredGrid 는 현재 mapData 를 그대로 반환한다', () => {
    setupMapEditWithInventory();
    const authored = getAuthoredGrid(useGameStore.getState());
    expect(authored[0][0]?.type).toBe('mirror');
    expect(authored[1][1]?.isInventory).toBe(true);
  });

  it('테스트 상태: mapData 에서 빠진 인벤토리 기물이 작성 원본에는 남아 있다', () => {
    setupMapEditWithInventory();
    useGameStore.getState().toggleMode(); // 에디터 → 테스트

    const s = useGameStore.getState();
    expect(s.isEditorMode).toBe(false);
    expect(s.mapData[1][1]).toBeNull(); // 그리드에선 인벤토리로 분리됨
    expect(s.playerInventory[invKey('mirror', false, 0)]?.count).toBe(1);

    // 저장 원본에는 인벤토리 기물이 위치·플래그 그대로 존재
    const authored = getAuthoredGrid(s);
    expect(authored[1][1]?.isInventory).toBe(true);
    expect(authored[0][0]?.type).toBe('mirror');
  });

  it('테스트 상태에서 exitMapEditMode(restore:false) 해도 인벤토리 기물이 보존된다', () => {
    setupMapEditWithInventory();
    useGameStore.getState().toggleMode(); // 에디터 → 테스트 (인벤토리에 기물 남긴 채)
    useGameStore.getState().exitMapEditMode({ restore: false }); // 저장 후 플레이 복귀

    const s = useGameStore.getState();
    expect(s.isMapEditMode).toBe(false);
    // 확정 원본(editorMapDataBackup)에 인벤토리 기물 유지
    expect(s.editorMapDataBackup?.[1][1]?.isInventory).toBe(true);
    // 플레이 인벤토리로 재구성됨 (유실 없음)
    expect(s.playerInventory[invKey('mirror', false, 0)]?.count).toBe(1);
    expect(s.mapData[0][0]?.type).toBe('mirror');
  });

  it('에디터 상태에서 exitMapEditMode(restore:false) 는 편집 중 mapData 를 확정한다', () => {
    setupMapEditWithInventory();
    // 편집: 기물 하나 추가
    useGameStore.getState().setCell(3, 3, cell());
    useGameStore.getState().exitMapEditMode({ restore: false });

    const s = useGameStore.getState();
    expect(s.editorMapDataBackup?.[3][3]?.type).toBe('mirror');
    expect(s.playerInventory[invKey('mirror', false, 0)]?.count).toBe(1);
  });

  it('restore:true 는 수정 전 원본(mapEditOriginalBackup)으로 되돌린다', () => {
    setupMapEditWithInventory();
    useGameStore.getState().setCell(4, 4, cell());
    useGameStore.getState().exitMapEditMode({ restore: true });

    const s = useGameStore.getState();
    expect(s.editorMapDataBackup?.[4][4] ?? null).toBeNull();
    expect(s.editorMapDataBackup?.[1][1]?.isInventory).toBe(true);
  });
});
