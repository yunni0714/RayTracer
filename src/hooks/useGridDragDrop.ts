import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { GRID_SIZE, SVG_ART } from '../lib/svgArt';
import { rotatePiece } from '../lib/pieceActions';
import type { CellData, PieceType, Rotation, SelectedTool } from '../types/game';

interface DragSource {
  origin: 'palette' | 'grid';
  pieceType: PieceType;
  fromRow?: number;
  fromCol?: number;
  rotation: Rotation;
  justPlaced?: boolean;
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
    const cellSize = rect.width / GRID_SIZE; // 보드가 유동 크기이므로 실측 기반
    const col = Math.floor((x - rect.left) / cellSize);
    const row = Math.floor((y - rect.top) / cellSize);
    if (col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE) return { row, col };
    return null;
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

    function onPointerDown(e: PointerEvent): void {
      if (!e.isPrimary) return; // 멀티터치 보조 포인터 무시
      if (e.button !== 0) return; // 주 버튼(좌클릭/터치)만

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

    function onPointerMove(e: PointerEvent): void {
      if (!e.isPrimary) return;
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

    function onPointerUp(e: PointerEvent): void {
      if (!e.isPrimary) return;
      if (e.button !== 0 && e.button !== -1) return; // -1: 일부 브라우저의 touch pointerup

      // 수정자 덧칠 처리 (에디터)
      const pt = paintTargetRef.current;
      if (pt) {
        paintTargetRef.current = null;
        const state = useGameStore.getState();
        const existing = state.mapData[pt.row][pt.col];
        if (existing) {
          const patched: CellData = { ...existing };
          // 인벤 축과 회전 축을 독립 적용한다 (유저지급 + 회전불가 중첩 지원)
          if (state.isModInvActive) {
            patched.isInventory = !existing.isInventory; // 재덧칠 시 인벤 토글
            patched.canMove = patched.isInventory;
            patched.canRotate = patched.isInventory ? !state.isModLockActive : state.isModRotatableActive;
          } else if (state.isModRotatableActive) {
            patched.canRotate = true;
          } else if (state.isModLockActive) {
            patched.canRotate = false;
          }
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
            state.setSelectedCell(null);
          } else if (sourceItem?.isInventory) {
            state.saveUndoSnapshot();
            state.refundToInventory(sourceItem);
            state.setCell(src.fromRow, src.fromCol!, null);
            state.setSelectedCell(null);
          }
        }
        restoreLastActiveTool();
        return;
      }

      const { row, col } = target;
      const existing = state.mapData[row][col];

      if (src.origin === 'grid' && src.fromRow !== undefined && src.fromCol !== undefined) {
        if (src.fromRow === row && src.fromCol === col) {
          // 같은 셀 클릭
          if (!src.justPlaced && existing) {
            if (lastActiveToolRef.current) {
              // 도구 해제 우선: 도구만 내려놓고 기물은 건드리지 않는다 (덮어쓰기/회전 없음)
              lastActiveToolRef.current = null;
              return;
            }
            // 빈손 클릭: 기물 선택 → 팝오버(데스크탑)/인스펙터(모바일)
            state.setSelectedCell({ row, col });
          } else if (src.justPlaced) {
            // 배치 직후 자동 표시
            state.setSelectedCell({ row, col });
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
          state.setSelectedCell(null);
        }
        restoreLastActiveTool();
        return;
      }

      if (src.origin === 'palette' && isEditor) {
        state.saveUndoSnapshot();
        state.setCell(row, col, {
          type: src.pieceType, rotation: 0,
          isInventory: state.isModInvActive, canMove: state.isModInvActive,
          canRotate: state.isModInvActive ? !state.isModLockActive : state.isModRotatableActive,
        });
        state.setSelectedCell({ row, col }); // 배치 직후 자동 표시
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
      // 우클릭 = 회전 (삭제/회수는 팝오버·인스펙터로 이동)
      rotatePiece(row, col);
    }

    function onKeyDown(e: KeyboardEvent): void {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        useGameStore.getState().undo();
      }
    }

    // 드래그 중단(시스템 제스처·포커스 이탈 등) 시 취소 처리
    function onPointerCancel(): void {
      paintTargetRef.current = null;
      if (dragSourceRef.current) {
        dragSourceRef.current = null;
        removeGhost();
        restoreLastActiveTool();
      }
    }

    grid.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    grid.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      grid.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      grid.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
    };
  // 핸들러는 getState()/ref만 사용하므로 외부 헬퍼를 의존성에 넣지 않는다
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridRef]);
}
