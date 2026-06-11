import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import {
  NON_ROTATABLE, rotatePiece, deletePiece, refundPiece,
  toggleRotateLock, toggleUserSupply, clearTraits,
} from '../../lib/pieceActions';
import { IconButton } from '../ui';

// 선택 기물 위에 뜨는 플로팅 미니 메뉴 (데스크탑 전용 — lg 미만에선 인스펙터가 메인).
// 보드 래퍼(relative) 안에서 셀 위치 기준 절대 배치, 상/좌/우 경계에서 flip/클램프.
export function PiecePopover() {
  const { selectedCell, mapData, isEditorMode } = useGameStore(useShallow(s => ({
    selectedCell: s.selectedCell,
    mapData: s.mapData,
    isEditorMode: s.isEditorMode,
  })));

  const popoverRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 / Esc 로 닫기
  useEffect(() => {
    if (!selectedCell) return;
    function onPointerDown(e: PointerEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        useGameStore.getState().setSelectedCell(null);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') useGameStore.getState().setSelectedCell(null);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedCell]);

  const cell = selectedCell ? mapData[selectedCell.row][selectedCell.col] : null;
  if (!selectedCell || !cell) return null;

  const { row, col } = selectedCell;
  const gridSize = mapData.length;
  const canRotateHere = isEditorMode
    ? !NON_ROTATABLE.includes(cell.type)
    : cell.canRotate && !NON_ROTATABLE.includes(cell.type);

  // 위치: 기물 위, 첫 행은 아래로 flip. 좌우 경계는 정렬 클램프.
  const flipDown = row === 0;
  const top = flipDown ? `${((row + 1) / gridSize) * 100}%` : `${(row / gridSize) * 100}%`;
  const left = `${((col + 0.5) / gridSize) * 100}%`;
  const tx = col === 0 ? '-15%' : col === gridSize - 1 ? '-85%' : '-50%';
  const ty = flipDown ? '6px' : 'calc(-100% - 6px)';

  return (
    <div
      ref={popoverRef}
      data-testid="piece-popover"
      className="hidden lg:flex absolute z-10 items-center gap-0.5 p-1 bg-surface border border-line rounded-tile shadow-cardhover"
      style={{ top, left, transform: `translate(${tx}, ${ty})` }}
    >
      {canRotateHere && (
        <IconButton aria-label="90도 회전" title="90° 회전" onClick={() => rotatePiece(row, col)}>
          ↻
        </IconButton>
      )}
      {isEditorMode ? (
        <>
          {/* 회전 트레잇 토글(canRotate). 인벤=회전불가 / 고정=회전가능 맥락. 일탈 상태일 때 강조. */}
          <IconButton
            aria-label="회전 특성 토글"
            title={cell.isInventory
              ? (cell.canRotate ? '회전 불가 지정' : '회전 불가 해제')
              : (cell.canRotate ? '회전 가능 해제' : '회전 가능 부여')}
            className={(cell.isInventory ? !cell.canRotate : cell.canRotate) ? '!bg-warning-soft' : ''}
            onClick={() => toggleRotateLock(row, col)}
          >
            {cell.isInventory ? '🔒' : '🔄'}
          </IconButton>
          <IconButton
            aria-label="유저지급 토글"
            title={cell.isInventory ? '유저지급 해제' : '유저지급 지정'}
            className={cell.isInventory ? '!bg-danger-soft' : ''}
            onClick={() => toggleUserSupply(row, col)}
          >
            🎒
          </IconButton>
          <IconButton aria-label="특성 삭제" title="특성 삭제(초기화)" onClick={() => clearTraits(row, col)}>
            ✨
          </IconButton>
          <IconButton
            aria-label="기물 삭제"
            title="기물 삭제"
            className="!text-danger"
            onClick={() => deletePiece(row, col)}
          >
            🗑
          </IconButton>
        </>
      ) : (
        cell.isInventory && (
          <IconButton aria-label="인벤토리로 회수" title="인벤토리로 회수" onClick={() => refundPiece(row, col)}>
            ♻
          </IconButton>
        )
      )}
    </div>
  );
}
