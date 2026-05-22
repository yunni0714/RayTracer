import { create } from 'zustand';
import type {
  CellData, InventoryItem, MapDocument, GameSnapshot, SelectedTool,
} from '../types/game';
import { GRID_SIZE } from '../lib/svgArt';

function emptyGrid(): (CellData | null)[][] {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
}

const MAX_UNDO = 50;

interface NotificationState {
  message: string;
  color: string;
}

export type ActiveModal = 'upload' | 'suggestion' | 'nickname' | 'changeNickname' | null;

interface GameStore {
  // ── 게임 그리드 ──────────────────────────────
  mapData: (CellData | null)[][];
  playerInventory: Record<string, InventoryItem>;
  undoStack: GameSnapshot[];

  // ── 에디터 상태 ──────────────────────────────
  isEditorMode: boolean;
  isMapEditMode: boolean;
  selectedTool: SelectedTool | null;
  editorMapDataBackup: (CellData | null)[][] | null;
  editorInventoryBackup: Record<string, InventoryItem> | null;

  // ── 수정자 ───────────────────────────────────
  isModRotatableActive: boolean;
  isModLockActive: boolean;
  isModInvActive: boolean;

  // ── 레이저 ───────────────────────────────────
  isLaserOn: boolean;

  // ── 라이브러리 ───────────────────────────────
  isLibraryMode: boolean;
  allLibraryMaps: MapDocument[];
  currentLoadedMapObj: MapDocument | null;
  currentLoadedMapAuthorUid: string | null;

  // ── 인증 ─────────────────────────────────────
  currentUserUid: string | null;
  currentUserNickname: string | null;

  // ── UI ───────────────────────────────────────
  notification: NotificationState | null;
  activeModal: ActiveModal;
  isUnlocked: boolean; // 이스터에그 상급 기물 해금

  // ── 액션: 그리드 ─────────────────────────────
  setMapData: (data: (CellData | null)[][]) => void;
  setCell: (row: number, col: number, item: CellData | null) => void;
  swapCells: (fromRow: number, fromCol: number, toRow: number, toCol: number) => void;

  // ── 액션: 인벤토리 ───────────────────────────
  setInventory: (inv: Record<string, InventoryItem>) => void;
  adjustInventoryCount: (key: string, delta: number) => void;

  // ── 액션: Undo ───────────────────────────────
  saveUndoSnapshot: () => void;
  undo: () => void;
  clearUndoStack: () => void;

  // ── 액션: 모드 ───────────────────────────────
  toggleMode: () => void;
  enterMapEditMode: () => void;
  exitMapEditMode: () => void;
  resetEditorState: () => void;

  // ── 액션: 도구 선택 ──────────────────────────
  setSelectedTool: (tool: SelectedTool | null) => void;
  setModRotatable: (v: boolean) => void;
  setModLock: (v: boolean) => void;
  setModInv: (v: boolean) => void;

  // ── 액션: 레이저 ─────────────────────────────
  toggleLaser: () => void;
  setLaserOn: (on: boolean) => void;

  // ── 액션: 라이브러리 ─────────────────────────
  setLibraryMode: (on: boolean) => void;
  setAllLibraryMaps: (maps: MapDocument[]) => void;
  setCurrentLoadedMap: (map: MapDocument | null) => void;

  // ── 액션: 인증 ───────────────────────────────
  setUser: (user: { uid: string; nickname: string | null } | null) => void;
  setNickname: (nickname: string) => void;

  // ── 액션: UI ─────────────────────────────────
  showNotification: (message: string, color?: string) => void;
  clearNotification: () => void;
  openModal: (modal: ActiveModal) => void;
  closeModal: () => void;
  setUnlocked: (v: boolean) => void;

  // ── 액션: 맵 데이터 변환 ─────────────────────
  clearGrid: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // ── 초기값 ───────────────────────────────────
  mapData: emptyGrid(),
  playerInventory: {},
  undoStack: [],
  isEditorMode: true,
  isMapEditMode: false,
  selectedTool: null,
  editorMapDataBackup: null,
  editorInventoryBackup: null,
  isModRotatableActive: false,
  isModLockActive: false,
  isModInvActive: false,
  isLaserOn: false,
  isLibraryMode: false,
  allLibraryMaps: [],
  currentLoadedMapObj: null,
  currentLoadedMapAuthorUid: null,
  currentUserUid: null,
  currentUserNickname: null,
  notification: null,
  activeModal: null,
  isUnlocked: false,

  // ── 그리드 ───────────────────────────────────
  setMapData: (data) => set({ mapData: data }),

  setCell: (row, col, item) => set((s) => {
    const next = s.mapData.map(r => [...r]);
    next[row][col] = item;
    return { mapData: next };
  }),

  swapCells: (fromRow, fromCol, toRow, toCol) => set((s) => {
    const next = s.mapData.map(r => [...r]);
    const tmp = next[fromRow][fromCol];
    next[fromRow][fromCol] = next[toRow][toCol];
    next[toRow][toCol] = tmp;
    return { mapData: next };
  }),

  // ── 인벤토리 ─────────────────────────────────
  setInventory: (inv) => set({ playerInventory: inv }),

  adjustInventoryCount: (key, delta) => set((s) => {
    const inv = { ...s.playerInventory };
    if (!inv[key]) return {};
    inv[key] = { ...inv[key], count: inv[key].count + delta };
    return { playerInventory: inv };
  }),

  // ── Undo ─────────────────────────────────────
  saveUndoSnapshot: () => set((s) => {
    const snapshot: GameSnapshot = {
      mapData: s.mapData.map(r => r.map(c => c ? { ...c } : null)),
      playerInventory: JSON.parse(JSON.stringify(s.playerInventory)),
    };
    const stack = [...s.undoStack, snapshot].slice(-MAX_UNDO);
    return { undoStack: stack };
  }),

  undo: () => set((s) => {
    if (s.undoStack.length === 0) return {};
    const stack = [...s.undoStack];
    const prev = stack.pop()!;
    return { undoStack: stack, mapData: prev.mapData, playerInventory: prev.playerInventory };
  }),

  clearUndoStack: () => set({ undoStack: [] }),

  // ── 모드 ─────────────────────────────────────
  toggleMode: () => set((s) => {
    if (s.isEditorMode) {
      // 에디터 → 테스트
      const backup = s.mapData.map(r => r.map(c => c ? { ...c } : null));
      const invBackup = JSON.parse(JSON.stringify(s.playerInventory));

      // 인벤토리 기물을 그리드에서 분리해 인벤토리로 구성
      const newMapData = s.mapData.map(r => r.map(c => {
        if (c?.isInventory) return null;
        return c;
      }));

      const newInv: Record<string, InventoryItem> = {};
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const cell = s.mapData[r][c];
          if (cell?.isInventory) {
            const key = `${cell.type}_${cell.canRotate ? 'r' : 'f'}`;
            if (!newInv[key]) {
              newInv[key] = { count: 0, type: cell.type, canRotate: cell.canRotate, rotation: cell.rotation };
            }
            newInv[key].count++;
          }
        }
      }

      return {
        isEditorMode: false,
        editorMapDataBackup: backup,
        editorInventoryBackup: invBackup,
        mapData: newMapData,
        playerInventory: newInv,
        undoStack: [],
      };
    } else {
      // 테스트 → 에디터
      return {
        isEditorMode: true,
        mapData: s.editorMapDataBackup ?? emptyGrid(),
        playerInventory: s.editorInventoryBackup ?? {},
        editorMapDataBackup: null,
        editorInventoryBackup: null,
        undoStack: [],
        isLaserOn: false,
      };
    }
  }),

  enterMapEditMode: () => set({ isMapEditMode: true }),
  exitMapEditMode: () => set({ isMapEditMode: false }),

  resetEditorState: () => set({
    mapData: emptyGrid(),
    playerInventory: {},
    undoStack: [],
    isEditorMode: true,
    isMapEditMode: false,
    editorMapDataBackup: null,
    editorInventoryBackup: null,
    isLaserOn: false,
    selectedTool: null,
    currentLoadedMapObj: null,
    currentLoadedMapAuthorUid: null,
  }),

  // ── 도구 선택 ─────────────────────────────────
  setSelectedTool: (tool) => set({ selectedTool: tool }),
  setModRotatable: (v) => set({ isModRotatableActive: v }),
  setModLock: (v) => set({ isModLockActive: v }),
  setModInv: (v) => set({ isModInvActive: v }),

  // ── 레이저 ───────────────────────────────────
  toggleLaser: () => set((s) => ({ isLaserOn: !s.isLaserOn })),
  setLaserOn: (on) => set({ isLaserOn: on }),

  // ── 라이브러리 ───────────────────────────────
  setLibraryMode: (on) => set({ isLibraryMode: on }),
  setAllLibraryMaps: (maps) => set({ allLibraryMaps: maps }),
  setCurrentLoadedMap: (map) => set({
    currentLoadedMapObj: map,
    currentLoadedMapAuthorUid: map?.authorUid ?? null,
  }),

  // ── 인증 ─────────────────────────────────────
  setUser: (user) => set({
    currentUserUid: user?.uid ?? null,
    currentUserNickname: user?.nickname ?? null,
  }),
  setNickname: (nickname) => set({ currentUserNickname: nickname }),

  // ── UI ───────────────────────────────────────
  showNotification: (message, color = '#27ae60') => set({ notification: { message, color } }),
  clearNotification: () => set({ notification: null }),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
  setUnlocked: (v) => set({ isUnlocked: v }),

  // ── 맵 초기화 ─────────────────────────────────
  clearGrid: () => {
    get().saveUndoSnapshot();
    set({ mapData: emptyGrid(), playerInventory: {} });
  },
}));
