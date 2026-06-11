import { create } from 'zustand';
import type {
  CellData, InventoryItem, MapDocument, SuggestionDocument, GameSnapshot, SelectedTool,
} from '../types/game';
export const DEFAULT_GRID_SIZE = 5;

export function emptyGrid(size: number = DEFAULT_GRID_SIZE): (CellData | null)[][] {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

// 인벤토리 key: 원본 dragAndDrop.js와 동일하게 type + canRotate + 고정회전값으로 식별
// (회전 가능 기물은 rot 0, block은 항상 rot 0)
export function invKey(type: CellData['type'], canRotate: boolean, rotation: number): string {
  let rot = canRotate ? 0 : (rotation || 0);
  if (type === 'block') rot = 0;
  return `${type}_${canRotate}_${rot}`;
}

// 그리드에서 isInventory 기물을 모아 playerInventory를 구성
function buildInventory(grid: (CellData | null)[][]): Record<string, InventoryItem> {
  const inv: Record<string, InventoryItem> = {};
  const size = grid.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = grid[r][c];
      if (cell?.isInventory) {
        const key = invKey(cell.type, cell.canRotate, cell.rotation);
        let rot = cell.canRotate ? 0 : cell.rotation;
        if (cell.type === 'block') rot = 0;
        if (!inv[key]) inv[key] = { count: 0, type: cell.type, canRotate: cell.canRotate, rotation: rot };
        inv[key].count++;
      }
    }
  }
  return inv;
}

const MAX_UNDO = 50;

// 초기 테마: localStorage > 'light'
function initialTheme(): 'light' | 'dark' {
  try {
    const t = localStorage.getItem('ray-theme');
    if (t === 'dark' || t === 'light') return t;
  } catch { /* 비공개 모드 등 localStorage 접근 실패 무시 */ }
  return 'light';
}

// ConfirmModal 표시 옵션. resolver 는 직렬화 회피 위해 모듈 변수에 보관.
type ConfirmOpts = {
  title?: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean;
};
let confirmResolver: ((v: boolean) => void) | null = null;

interface NotificationState {
  message: string;
  color: string;
}

export type ActiveModal = 'upload' | 'suggestion' | 'nickname' | 'changeNickname' | null;

interface GameStore {
  // ── 게임 그리드 ──────────────────────────────
  mapData: (CellData | null)[][];
  gridSize: number;
  playerInventory: Record<string, InventoryItem>;
  undoStack: GameSnapshot[];

  // ── 에디터 상태 ──────────────────────────────
  isEditorMode: boolean;
  isMapEditMode: boolean;
  selectedTool: SelectedTool | null;
  selectedCell: { row: number; col: number } | null;
  editorMapDataBackup: (CellData | null)[][] | null;
  editorInventoryBackup: Record<string, InventoryItem> | null;
  mapEditOriginalBackup: (CellData | null)[][] | null;

  // ── 정답 보기 ─────────────────────────────
  isAnswerShown: boolean;
  answerMapBackup: (CellData | null)[][] | null;
  answerInventoryBackup: Record<string, InventoryItem> | null;

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
  currentMapReactions: { ok: number; god: number };
  suggestions: SuggestionDocument[];

  // ── 인증 ─────────────────────────────────────
  currentUserUid: string | null;
  currentUserNickname: string | null;

  // ── UI ───────────────────────────────────────
  notification: NotificationState | null;
  activeModal: ActiveModal;
  theme: 'light' | 'dark';
  confirmState: ConfirmOpts | null;
  pieceConfigRev: number; // 기물 config 오버레이 적용 시 증가 → SVG/라벨 리렌더 트리거

  // ── 액션: 그리드 ─────────────────────────────
  setMapData: (data: (CellData | null)[][]) => void;
  setGridSize: (size: number) => void;
  setCell: (row: number, col: number, item: CellData | null) => void;
  swapCells: (fromRow: number, fromCol: number, toRow: number, toCol: number) => void;

  // ── 액션: 인벤토리 ───────────────────────────
  setInventory: (inv: Record<string, InventoryItem>) => void;
  adjustInventoryCount: (key: string, delta: number) => void;
  refundToInventory: (cell: CellData) => void;

  // ── 액션: Undo ───────────────────────────────
  saveUndoSnapshot: () => void;
  undo: () => void;
  clearUndoStack: () => void;

  // ── 액션: 모드 ───────────────────────────────
  toggleMode: () => void;
  loadMapForPlay: (grid: (CellData | null)[][], mapDoc: MapDocument | null) => void;
  enterMapEditMode: () => void;
  exitMapEditMode: (opts?: { restore?: boolean }) => void;
  resetEditorState: () => void;
  patchCurrentLoadedMap: (patch: Partial<MapDocument>) => void;

  // ── 액션: 정답 보기 ──────────────────────────
  showAnswer: () => void;
  hideAnswer: () => void;

  // ── 액션: 도구 선택 ──────────────────────────
  setSelectedTool: (tool: SelectedTool | null) => void;
  setSelectedCell: (cell: { row: number; col: number } | null) => void;
  setModRotatable: (v: boolean) => void;
  setModLock: (v: boolean) => void;
  setModInv: (v: boolean) => void;

  // ── 액션: 레이저 ─────────────────────────────
  toggleLaser: () => void;
  setLaserOn: (on: boolean) => void;

  // ── 액션: 라이브러리 ─────────────────────────
  setLibraryMode: (on: boolean) => void;
  setAllLibraryMaps: (maps: MapDocument[]) => void;
  setCurrentMapReactions: (counts: { ok: number; god: number }) => void;
  setSuggestions: (sugs: SuggestionDocument[]) => void;

  // ── 액션: 인증 ───────────────────────────────
  setUser: (user: { uid: string; nickname: string | null } | null) => void;
  setNickname: (nickname: string) => void;

  // ── 액션: UI ─────────────────────────────────
  showNotification: (message: string, color?: string) => void;
  clearNotification: () => void;
  openModal: (modal: ActiveModal) => void;
  closeModal: () => void;
  toggleTheme: () => void;
  setTheme: (t: 'light' | 'dark') => void;
  bumpPieceConfigRev: () => void;
  requestConfirm: (opts: ConfirmOpts) => Promise<boolean>;
  resolveConfirm: (result: boolean) => void;

  // ── 액션: 맵 데이터 변환 ─────────────────────
  clearGrid: () => Promise<void>;
}


export const useGameStore = create<GameStore>((set, get) => ({
  // ── 초기값 ───────────────────────────────────
  mapData: emptyGrid(),
  gridSize: DEFAULT_GRID_SIZE,
  playerInventory: {},
  undoStack: [],
  isEditorMode: true,
  isMapEditMode: false,
  selectedTool: null,
  selectedCell: null,
  editorMapDataBackup: null,
  editorInventoryBackup: null,
  mapEditOriginalBackup: null,
  isAnswerShown: false,
  answerMapBackup: null,
  answerInventoryBackup: null,
  isModRotatableActive: false,
  isModLockActive: false,
  isModInvActive: false,
  isLaserOn: false,
  isLibraryMode: false,
  allLibraryMaps: [],
  currentLoadedMapObj: null,
  currentLoadedMapAuthorUid: null,
  currentMapReactions: { ok: 0, god: 0 },
  suggestions: [],
  currentUserUid: null,
  currentUserNickname: null,
  notification: null,
  activeModal: null,
  theme: initialTheme(),
  confirmState: null,
  pieceConfigRev: 0,

  // ── 그리드 ───────────────────────────────────
  setMapData: (data) => set({ mapData: data, gridSize: data.length }),

  // 에디터 그리드 리사이즈: 겹치는 영역 보존, 범위 밖 기물은 버려진다.
  // mapData.length 가 곳곳의 소스 오브 트루스라 undo 스택은 비운다(크기 불일치 방지).
  setGridSize: (size) => set((s) => {
    if (!s.isEditorMode) return {};
    const next: (CellData | null)[][] = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => {
        const cell = s.mapData[r]?.[c];
        return cell ? { ...cell } : null;
      }),
    );
    return { gridSize: size, mapData: next, selectedCell: null, undoStack: [] };
  }),

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

  refundToInventory: (cell) => set((s) => {
    const inv = { ...s.playerInventory };
    const key = invKey(cell.type, cell.canRotate, cell.rotation);
    let rot = cell.canRotate ? 0 : cell.rotation;
    if (cell.type === 'block') rot = 0;
    if (!inv[key]) {
      inv[key] = { count: 0, type: cell.type, canRotate: cell.canRotate, rotation: rot };
    }
    inv[key] = { ...inv[key], count: inv[key].count + 1 };
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

      const newInv = buildInventory(s.mapData);

      return {
        isEditorMode: false,
        editorMapDataBackup: backup,
        editorInventoryBackup: invBackup,
        mapData: newMapData,
        playerInventory: newInv,
        undoStack: [],
        selectedTool: null,
        selectedCell: null,
      };
    } else {
      // 테스트 → 에디터
      return {
        isEditorMode: true,
        mapData: s.editorMapDataBackup ?? emptyGrid(s.gridSize),
        playerInventory: s.editorInventoryBackup ?? {},
        editorMapDataBackup: null,
        editorInventoryBackup: null,
        undoStack: [],
        isLaserOn: false,
        selectedTool: null,
        selectedCell: null,
      };
    }
  }),

  // 라이브러리/다음문제/URL에서 맵을 테스트 모드로 직접 로드.
  // 그리드·맵 메타데이터를 하나의 set()으로 원자적으로 설정해 중간 상태 어긋남을 방지한다.
  loadMapForPlay: (grid, mapDoc) => set(() => {
    const fullGrid = grid.map(r => r.map(c => c ? { ...c } : null));
    const newMapData = grid.map(r => r.map(c => c?.isInventory ? null : (c ? { ...c } : null)));
    const newInv = buildInventory(grid);
    return {
      isEditorMode: false,
      mapData: newMapData,
      gridSize: grid.length,
      playerInventory: newInv,
      editorMapDataBackup: fullGrid,
      editorInventoryBackup: {},
      mapEditOriginalBackup: null,
      isMapEditMode: false,
      undoStack: [],
      isLaserOn: true,
      isAnswerShown: false,
      answerMapBackup: null,
      answerInventoryBackup: null,
      selectedTool: null,
      selectedCell: null,
      currentLoadedMapObj: mapDoc,
      currentLoadedMapAuthorUid: mapDoc?.authorUid ?? null,
      currentMapReactions: mapDoc
        ? { ok: mapDoc.reactionOk ?? 0, god: mapDoc.reactionGod ?? 0 }
        : { ok: 0, god: 0 },
      suggestions: [],
    };
  }),

  enterMapEditMode: () => set((s) => {
    const fullGrid = s.editorMapDataBackup
      ? s.editorMapDataBackup.map(r => r.map(c => c ? { ...c } : null))
      : s.mapData.map(r => r.map(c => c ? { ...c } : null));
    return {
      isMapEditMode: true,
      isEditorMode: true,
      mapData: fullGrid,
      playerInventory: {},
      mapEditOriginalBackup: fullGrid.map(r => r.map(c => c ? { ...c } : null)),
      selectedTool: null,
      selectedCell: null,
      isLaserOn: false,
      isAnswerShown: false,
      answerMapBackup: null,
      answerInventoryBackup: null,
      undoStack: [],
    };
  }),

  exitMapEditMode: (opts?: { restore?: boolean }) => set((s) => {
    const finalGrid = opts?.restore && s.mapEditOriginalBackup
      ? s.mapEditOriginalBackup
      : s.mapData;
    const playGrid = finalGrid.map(r => r.map(c => c?.isInventory ? null : (c ? { ...c } : null)));
    const playerInv = buildInventory(finalGrid);
    return {
      isMapEditMode: false,
      isEditorMode: false,
      mapData: playGrid,
      playerInventory: playerInv,
      editorMapDataBackup: finalGrid.map(r => r.map(c => c ? { ...c } : null)),
      mapEditOriginalBackup: null,
      selectedTool: null,
      selectedCell: null,
      undoStack: [],
      isLaserOn: true,
      isAnswerShown: false,
      answerMapBackup: null,
      answerInventoryBackup: null,
    };
  }),

  patchCurrentLoadedMap: (patch) => set((s) => ({
    currentLoadedMapObj: s.currentLoadedMapObj ? { ...s.currentLoadedMapObj, ...patch } : null,
  })),

  resetEditorState: () => set((s) => ({
    mapData: emptyGrid(s.gridSize),
    playerInventory: {},
    undoStack: [],
    isEditorMode: true,
    isMapEditMode: false,
    editorMapDataBackup: null,
    editorInventoryBackup: null,
    mapEditOriginalBackup: null,
    isAnswerShown: false,
    answerMapBackup: null,
    answerInventoryBackup: null,
    isLaserOn: false,
    selectedTool: null,
    selectedCell: null,
    currentLoadedMapObj: null,
    currentLoadedMapAuthorUid: null,
  })),

  // ── 도구 선택 ─────────────────────────────────
  setSelectedTool: (tool) => set({ selectedTool: tool }),
  setSelectedCell: (cell) => set({ selectedCell: cell }),
  setModRotatable: (v) => set({ isModRotatableActive: v }),
  setModLock: (v) => set({ isModLockActive: v }),
  setModInv: (v) => set({ isModInvActive: v }),

  // ── 레이저 ───────────────────────────────────
  toggleLaser: () => set((s) => ({ isLaserOn: !s.isLaserOn })),
  setLaserOn: (on) => set({ isLaserOn: on }),

  // ── 라이브러리 ───────────────────────────────
  setLibraryMode: (on) => set({ isLibraryMode: on }),
  setAllLibraryMaps: (maps) => set({ allLibraryMaps: maps }),
  setCurrentMapReactions: (counts) => set({ currentMapReactions: counts }),
  setSuggestions: (sugs) => set({ suggestions: sugs }),

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
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  setTheme: (t) => set({ theme: t }),
  bumpPieceConfigRev: () => set((s) => ({ pieceConfigRev: s.pieceConfigRev + 1 })),

  // ── 확인 다이얼로그 (네이티브 confirm 대체) ──
  requestConfirm: (opts) => new Promise<boolean>((resolve) => {
    // 이전 미해결 confirm 이 있으면 false 로 정리
    confirmResolver?.(false);
    confirmResolver = resolve;
    set({ confirmState: opts });
  }),
  resolveConfirm: (result) => {
    const resolver = confirmResolver;
    confirmResolver = null;
    set({ confirmState: null });
    resolver?.(result);
  },

  // ── 맵 초기화 ─────────────────────────────────
  clearGrid: async () => {
    const { isEditorMode, mapData, playerInventory } = get();

    if (isEditorMode) {
      if (!(await get().requestConfirm({ message: '맵의 모든 기물을 삭제하시겠습니까?', danger: true }))) return;
      get().saveUndoSnapshot();
      set({ mapData: emptyGrid(get().gridSize), playerInventory: {}, selectedCell: null });
    } else {
      if (!(await get().requestConfirm({ message: '배치한 모든 기물을 인벤토리로 회수하시겠습니까?' }))) return;
      get().saveUndoSnapshot();

      const newMap = mapData.map(r => r.map(c => (!c || c.isInventory) ? null : c));

      const refunded = { ...playerInventory };
      const size = mapData.length;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const cell = mapData[r][c];
          if (cell?.isInventory) {
            const key = invKey(cell.type, cell.canRotate, cell.rotation);
            let rot = cell.canRotate ? 0 : cell.rotation;
            if (cell.type === 'block') rot = 0;
            if (refunded[key]) {
              refunded[key] = { ...refunded[key], count: refunded[key].count + 1 };
            } else {
              refunded[key] = { count: 1, type: cell.type, canRotate: cell.canRotate, rotation: rot };
            }
          }
        }
      }
      set({ mapData: newMap, playerInventory: refunded, selectedCell: null });
    }
  },

  // ── 정답 보기 ─────────────────────────────────
  showAnswer: () => {
    const { mapData, playerInventory, currentLoadedMapObj } = get();
    if (!currentLoadedMapObj) return;

    const answerMapBackup = mapData.map(r => r.map(c => c ? { ...c } : null));
    const answerInventoryBackup = JSON.parse(JSON.stringify(playerInventory));

    const answerSize = currentLoadedMapObj.gridSize ?? DEFAULT_GRID_SIZE;
    const originalGrid = emptyGrid(answerSize);
    for (const item of currentLoadedMapObj.mapData) {
      if (item.y >= 0 && item.y < answerSize && item.x >= 0 && item.x < answerSize) {
        originalGrid[item.y][item.x] = {
          type: item.type,
          rotation: item.rotation,
          canMove: item.canMove,
          canRotate: item.canRotate,
          isInventory: item.isInventory,
        };
      }
    }

    set({
      isAnswerShown: true,
      answerMapBackup,
      answerInventoryBackup,
      mapData: originalGrid,
      playerInventory: {},
      selectedCell: null,
    });
  },

  hideAnswer: () => {
    const { answerMapBackup, answerInventoryBackup } = get();
    set({
      isAnswerShown: false,
      mapData: answerMapBackup ?? emptyGrid(get().gridSize),
      playerInventory: answerInventoryBackup ?? {},
      answerMapBackup: null,
      answerInventoryBackup: null,
      selectedCell: null,
    });
  },
}));
