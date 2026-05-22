import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { CELL_SIZE, GRID_SIZE, SVG_ART } from '../lib/svgArt';
import type { CellData, PieceType, Rotation } from '../types/game';

interface DragSource {
  type: 'palette' | 'grid' | 'inventory';
  pieceType: PieceType;
  fromRow?: number;
  fromCol?: number;
  inventoryKey?: string;
  rotation: Rotation;
  canRotate: boolean;
  canMove: boolean;
}

export function useGridDragDrop(gridRef: React.RefObject<HTMLDivElement | null>) {
  const dragSourceRef = useRef<DragSource | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);

  const { setCell, swapCells, isEditorMode, setSelectedTool, saveUndoSnapshot } = useGameStore.getState();

  function getCell(row: number, col: number): CellData | null {
    return useGameStore.getState().mapData[row][col];
  }

  function createGhost(type: PieceType, x: number, y: number): HTMLDivElement {
    const ghost = document.createElement('div');
    ghost.innerHTML = SVG_ART[type];
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
    if (['mirror_45', 'half_mirror_45'].includes(type)) return 45;
    return 90;
  }

  function executeRotation(row: number, col: number): void {
    const cell = getCell(row, col);
    if (!cell || cell.type === 'block' || !cell.canRotate) return;
    const step = getRotationStep(cell.type);
    const newRotation = ((cell.rotation + step) % 360) as Rotation;
    saveUndoSnapshot();
    setCell(row, col, { ...cell, rotation: newRotation });
    const { isLaserOn } = useGameStore.getState();
    if (isLaserOn) {
      // 레이저 갱신은 useEffect가 mapData 변경을 감지해 처리
    }
  }

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    function onMouseDown(e: MouseEvent): void {
      if (e.button === 2) return; // 우클릭은 contextmenu에서 처리

      const target = e.target as HTMLElement;
      const cellEl = target.closest('[data-row]') as HTMLElement | null;

      if (cellEl) {
        const row = parseInt(cellEl.dataset['row']!);
        const col = parseInt(cellEl.dataset['col']!);
        const cell = getCell(row, col);

        if (cell && isEditorMode) {
          saveUndoSnapshot();
          dragSourceRef.current = {
            type: 'grid',
            pieceType: cell.type,
            fromRow: row,
            fromCol: col,
            rotation: cell.rotation,
            canRotate: cell.canRotate,
            canMove: cell.canMove,
          };
          ghostRef.current = createGhost(cell.type, e.clientX, e.clientY);
        } else if (!cell) {
          const st = useGameStore.getState().selectedTool;
          if (st) {
            dragSourceRef.current = {
              type: 'palette',
              pieceType: st.type,
              rotation: 0 as Rotation,
              canRotate: useGameStore.getState().isModRotatableActive,
              canMove: !useGameStore.getState().isModLockActive,
            };
            ghostRef.current = createGhost(st.type, e.clientX, e.clientY);
          }
        }
        return;
      }

      // 팔레트 아이템 클릭
      const toolEl = target.closest('[data-tool]') as HTMLElement | null;
      if (toolEl) {
        const pieceType = toolEl.dataset['tool'] as PieceType;
        setSelectedTool({ type: pieceType, source: 'palette' });
      }
    }

    function onMouseMove(e: MouseEvent): void {
      moveGhost(e.clientX, e.clientY);
    }

    function onMouseUp(e: MouseEvent): void {
      const src = dragSourceRef.current;
      if (!src) return;
      dragSourceRef.current = null;
      removeGhost();

      const target = getCellFromPoint(e.clientX, e.clientY);

      if (!target) {
        // 그리드 밖 드롭 → 에디터 모드면 제거
        if (src.type === 'grid' && src.fromRow !== undefined && src.fromCol !== undefined) {
          if (isEditorMode) setCell(src.fromRow, src.fromCol, null);
        }
        return;
      }

      const { row, col } = target;
      const existing = getCell(row, col);

      if (src.type === 'grid' && src.fromRow !== undefined && src.fromCol !== undefined) {
        if (src.fromRow === row && src.fromCol === col) {
          // 같은 셀 드롭 → 회전
          executeRotation(row, col);
          return;
        }
        if (existing) {
          swapCells(src.fromRow, src.fromCol, row, col);
        } else {
          const cell = getCell(src.fromRow, src.fromCol);
          setCell(row, col, cell);
          setCell(src.fromRow, src.fromCol, null);
        }
        return;
      }

      if (src.type === 'palette') {
        const st = useGameStore.getState().selectedTool;
        if (!st) return;
        const { isModRotatableActive: rotatable, isModLockActive: locked, isModInvActive: inv } = useGameStore.getState();
        const newCell: CellData = {
          type: st.type,
          rotation: 0 as Rotation,
          canMove: !locked,
          canRotate: rotatable,
          isInventory: inv,
        };
        saveUndoSnapshot();
        setCell(row, col, newCell);
      }
    }

    function onContextMenu(e: MouseEvent): void {
      e.preventDefault();
      dragSourceRef.current = null;
      removeGhost();
    }

    grid.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    grid.addEventListener('contextmenu', onContextMenu);

    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        useGameStore.getState().undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      grid.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      grid.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridRef, isEditorMode]);
}
