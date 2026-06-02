import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { CELL_SIZE, GRID_SIZE, SVG_ART } from '../lib/svgArt';
import type { CellData, PieceType, Rotation, SelectedTool } from '../types/game';

interface DragSource {
  origin: 'palette' | 'grid';
  pieceType: PieceType;
  fromRow?: number;
  fromCol?: number;
  rotation: Rotation;
  justPlaced?: boolean;
}

const ADVANCED_TYPES: PieceType[] = [
  'mirror_45', 'half_mirror_45', 'diag_single_mirror_a', 'v_target_mirror_a',
  'diag_single_mirror_b', 'v_target_mirror_b', 'v_mirror', 'v_half_mirror', 'v_single_mirror',
];

function isAdvancedMap(
  mapData: (CellData | null)[][],
  inventory: Record<string, { type: PieceType; count: number }>,
): boolean {
  for (const row of mapData) {
    for (const cell of row) {
      if (cell && ADVANCED_TYPES.includes(cell.type)) return true;
    }
  }
  for (const key in inventory) {
    if (ADVANCED_TYPES.includes(inventory[key].type) && inventory[key].count > 0) return true;
  }
  return false;
}

export function useGridDragDrop(gridRef: React.RefObject<HTMLDivElement | null>) {
  const dragSourceRef = useRef<DragSource | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const paintTargetRef = useRef<{ row: number; col: number } | null>(null);
  const lastActiveToolRef = useRef<SelectedTool | null>(null);

  function createGhost(type: PieceType, x: number, y: number, rotation: Rotation): HTMLDivElement {
    const ghost = document.createElement('div');
    ghost.innerHTML = `<div style="transform:rotate(${rotation}deg);width:100%;height:100%;">${SVG_ART[type]}</div>`;
    ghost.style.cssText = [
      'position:fixed', 'width:60px', 'height:60px', 'opacity:0.7',
      'pointer-events:none', 'z-index:9999', 'transform:translate(-50%,-50%)',
      `left:${x}px`, `top:${y}px`,
    ].join(';');
    document.body.appendChild(ghost);
    return ghost;
  }

  function moveGhost(x: number, y: number): void {
    if (ghostRef.current) {
      ghostRef.current.style.left = `${x}px`;
      ghostRef.current.style.top = `${y}px`;
    }
  }

  function removeGhost(): void {
    ghostRef.current?.remove();
    ghostRef.current = null;
  }

  function getCellFromPoint(x: number, y: number): { row: number; col: number } | null {
    const grid = gridRef.current;
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    const col = Math.floor((x - rect.left) / CELL_SIZE);
    const row = Math.floor((y - rect.top) / CELL_SIZE);
    if (col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE) return { row, col };
    return null;
  }

  function getRotationStep(type: PieceType): 45 | 90 {
    if (type === 'mirror_45' || type === 'half_mirror_45') return 45;
    if (type === 'ray' || type === 'target') {
      const { mapData, playerInventory } = useGameStore.getState();
      return isAdvancedMap(mapData, playerInventory) ? 45 : 90;
    }
    return 90;
  }

  function executeRotation(row: number, col: number): boolean {
    const state = useGameStore.getState();
    const cell = state.mapData[row][col];
    if (!cell || cell.type === 'block') return false;
    if (!state.isEditorMode && !cell.canRotate) return false;
    state.saveUndoSnapshot();
    const step = getRotationStep(cell.type);
    let newRotation: number;
    if (step === 90 && cell.rotation % 90 !== 0) {
      newRotation = (Math.floor(cell.rotation / 90) * 90 + 90) % 360;
    } else {
      newRotation = (cell.rotation + step) % 360;
    }
    state.setCell(row, col, { ...cell, rotation: newRotation as Rotation });
    return true;
  }

  function restoreLastActiveTool(): void {
    const last = lastActiveToolRef.current;
    lastActiveToolRef.current = null;
    if (!last) return;
    const state = useGameStore.getState();
    // 테스트 모드에서 팔레트 도구를 되살리지 않는다 (모드 전환 race 방지)
    if (!state.isEditorMode && last.source !== 'inventory') return;
    const stillAvailable = !last.isInvTool
      || (last.inventoryKey != null && (state.playerInventory[last.inventoryKey]?.count ?? 0) > 0);
    if (stillAvailable) state.setSelectedTool(last);
  }

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    function onMouseDown(e: MouseEvent): void {
      if (e.button !== 0) return; // 좌클릭만

      const target = e.target as HTMLElement;
      const cellEl = target.closest('[data-row]') as HTMLElement | null;
      if (!cellEl) return;

      const row = parseInt(cellEl.dataset['row']!);
      const col = parseInt(cellEl.dataset['col']!);
      const state = useGameStore.getState();
      const isEditor = state.isEditorMode;
      const cell = state.mapData[row][col];

      if (cell) {
        // 테스트 모드 고정 기물(이동/회전 불가)은 상호작용 없음
        if (!isEditor && !cell.canMove && !cell.canRotate) return;

        // 에디터 + 수정자 활성: 덧칠 모드 (mouseUp에서 처리)
        if (isEditor) {
          const hasMod = state.isModRotatableActive || state.isModLockActive || state.isModInvActive;
          if (hasMod) {
            paintTargetRef.current = { row, col };
            return;
          }
        }

        // 든 도구가 있으면 보관 후 해제 (mouseUp에서 덮어쓰기/회전 판정에 사용)
        // 테스트 모드에서는 인벤토리 도구만 의미가 있으므로 팔레트 도구는 보관하지 않는다
        if (state.selectedTool) {
          if (isEditor || state.selectedTool.source === 'inventory') {
            lastActiveToolRef.current = { ...state.selectedTool };
          }
          state.setSelectedTool(null);
        }
        dragSourceRef.current = {
          origin: 'grid', pieceType: cell.type, fromRow: row, fromCol: col,
          rotation: cell.rotation,
        };
        return;
      }

      // 빈 셀
      const st = state.selectedTool;
      if (!st) return;

      if (!isEditor) {
        // 테스트 모드: 인벤토리 기물 즉시 배치
        if (st.isInvTool && st.inventoryKey && (state.playerInventory[st.inventoryKey]?.count ?? 0) > 0) {
          state.saveUndoSnapshot();
          state.setCell(row, col, {
            type: st.type, rotation: st.rotation ?? 0,
            canMove: true, canRotate: st.canRotate ?? false, isInventory: true,
          });
          state.adjustInventoryCount(st.inventoryKey, -1);
          const remaining = (state.playerInventory[st.inventoryKey]?.count ?? 0) - 1;
          if (remaining <= 0) state.setSelectedTool(null);
          dragSourceRef.current = {
            origin: 'grid', pieceType: st.type, fromRow: row, fromCol: col,
            rotation: st.rotation ?? 0, justPlaced: true,
          };
        }
      } else {
        // 에디터 모드: 팔레트 드래그 시작 (mouseUp에서 배치)
        dragSourceRef.current = {
          origin: 'palette', pieceType: st.type, rotation: 0,
        };
      }
    }

    function onMouseMove(e: MouseEvent): void {
      const src = dragSourceRef.current;
      if (!src) return;
      const state = useGameStore.getState();
      // 테스트 모드에서 이동 불가 기물은 고스트를 만들지 않음 (제자리 회전용)
      if (src.origin === 'grid' && !state.isEditorMode && src.fromRow !== undefined) {
        const c = state.mapData[src.fromRow][src.fromCol!];
        if (c && !c.canMove) return;
      }
      if (!ghostRef.current) {
        ghostRef.current = createGhost(src.pieceType, e.clientX, e.clientY, src.rotation);
      }
      moveGhost(e.clientX, e.clientY);
    }

    function onMouseUp(e: MouseEvent): void {
      if (e.button !== 0) return;

      // 수정자 덧칠 처리 (에디터)
      const pt = paintTargetRef.current;
      if (pt) {
        paintTargetRef.current = null;
        const state = useGameStore.getState();
        const existing = state.mapData[pt.row][pt.col];
        if (existing) {
          const patched: CellData = { ...existing };
          let toggledOff = false;
          if (state.isModInvActive) {
            if (existing.isInventory) toggledOff = true;
            else { patched.isInventory = true; patched.canMove = true; patched.canRotate = false; }
          } else if (state.isModLockActive) {
            if (!existing.isInventory && !existing.canRotate) toggledOff = true;
            else { patched.isInventory = false; patched.canMove = false; patched.canRotate = false; }
          } else if (state.isModRotatableActive) {
            if (!existing.isInventory && existing.canRotate) toggledOff = true;
            else { patched.isInventory = false; patched.canMove = false; patched.canRotate = true; }
          }
          if (toggledOff) { patched.isInventory = false; patched.canMove = false; patched.canRotate = false; }
          state.saveUndoSnapshot();
          state.setCell(pt.row, pt.col, patched);
        }
        return;
      }

      const src = dragSourceRef.current;
      dragSourceRef.current = null;
      removeGhost();
      if (!src) return;

      const state = useGameStore.getState();
      const isEditor = state.isEditorMode;
      const target = getCellFromPoint(e.clientX, e.clientY);

      if (!target) {
        // 그리드 밖 드롭
        if (src.origin === 'grid' && src.fromRow !== undefined) {
          const sourceItem = state.mapData[src.fromRow][src.fromCol!];
          if (isEditor) {
            state.saveUndoSnapshot();
            state.setCell(src.fromRow, src.fromCol!, null);
          } else if (sourceItem?.isInventory) {
            state.saveUndoSnapshot();
            state.refundToInventory(sourceItem);
            state.setCell(src.fromRow, src.fromCol!, null);
          }
        }
        restoreLastActiveTool();
        return;
      }

      const { row, col } = target;
      const existing = state.mapData[row][col];

      if (src.origin === 'grid' && src.fromRow !== undefined && src.fromCol !== undefined) {
        if (src.fromRow === row && src.fromCol === col) {
          // 같은 셀
          if (!src.justPlaced && existing) {
            const last = lastActiveToolRef.current;
            if (last) {
              if (last.type === existing.type) {
                if (isEditor || existing.canRotate) {
                  executeRotation(row, col);
                }
              } else if (isEditor) {
                // 다른 타입 덮어쓰기 (에디터)
                state.saveUndoSnapshot();
                state.setCell(row, col, {
                  type: last.type, rotation: 0,
                  isInventory: state.isModInvActive, canMove: state.isModInvActive,
                  canRotate: state.isModInvActive ? false : state.isModRotatableActive,
                });
              } else if (
                existing.isInventory && last.isInvTool && last.inventoryKey
                && (state.playerInventory[last.inventoryKey]?.count ?? 0) > 0
              ) {
                // 테스트 모드: 인벤토리 기물 위에 다른 인벤토리 기물 덮어쓰기 (기존 환수)
                state.saveUndoSnapshot();
                state.refundToInventory(existing);
                state.setCell(row, col, {
                  type: last.type, rotation: last.rotation ?? 0,
                  canMove: true, canRotate: last.canRotate ?? false, isInventory: true,
                });
                state.adjustInventoryCount(last.inventoryKey, -1);
              }
            } else if (isEditor || existing.canRotate) {
              // 빈손 클릭 회전
              executeRotation(row, col);
            }
          }
        } else {
          // 다른 셀로 이동/스왑
          const sourceItem = state.mapData[src.fromRow][src.fromCol];
          const blockedSource = !isEditor && sourceItem != null && !sourceItem.canMove;
          const blockedTarget = !isEditor && existing != null && !existing.canMove;
          if (!blockedSource && !blockedTarget) {
            state.saveUndoSnapshot();
            state.swapCells(src.fromRow, src.fromCol, row, col);
          }
        }
        restoreLastActiveTool();
        return;
      }

      if (src.origin === 'palette' && isEditor) {
        state.saveUndoSnapshot();
        state.setCell(row, col, {
          type: src.pieceType, rotation: 0,
          isInventory: state.isModInvActive, canMove: state.isModInvActive,
          canRotate: state.isModInvActive ? false : state.isModRotatableActive,
        });
        restoreLastActiveTool();
        return;
      }

      restoreLastActiveTool();
    }

    function onContextMenu(e: MouseEvent): void {
      e.preventDefault();
      paintTargetRef.current = null;
      // 드래그 중이면 취소
      if (dragSourceRef.current) {
        dragSourceRef.current = null;
        removeGhost();
        restoreLastActiveTool();
        return;
      }
      const cellEl = (e.target as HTMLElement).closest('[data-row]') as HTMLElement | null;
      if (!cellEl) return;
      const row = parseInt(cellEl.dataset['row']!);
      const col = parseInt(cellEl.dataset['col']!);
      const state = useGameStore.getState();
      const cell = state.mapData[row][col];
      if (!cell) return;
      if (state.isEditorMode) {
        state.saveUndoSnapshot();
        state.setCell(row, col, null);
      } else if (cell.isInventory) {
        state.saveUndoSnapshot();
        state.refundToInventory(cell);
        state.setCell(row, col, null);
      }
    }

    function onKeyDown(e: KeyboardEvent): void {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        useGameStore.getState().undo();
      }
    }

    grid.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    grid.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      grid.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      grid.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
    };
  // 핸들러는 getState()/ref만 사용하므로 외부 헬퍼를 의존성에 넣지 않는다
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridRef]);
}
