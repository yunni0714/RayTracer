import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { GRID_SIZE } from '../../lib/svgArt';
import {
  rotatePiece, deletePiece, refundPiece,
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
  const canRotateHere = isEditorMode ? cell.type !== 'block' : cell.canRotate;

  // 위치: 기물 위, 첫 행은 아래로 flip. 좌우 경계는 정렬 클램프.
  const flipDown = row === 0;
  const top = flipDown ? `${((row + 1) / GRID_SIZE) * 100}%` : `${(row / GRID_SIZE) * 100}%`;
  const left = `${((col + 0.5) / GRID_SIZE) * 100}%`;
  const tx = col === 0 ? '-15%' : col === GRID_SIZE - 1 ? '-85%' : '-50%';
  const ty = flipDown ? '6px' : 'calc(-100% - 6px)';

  return (
    <div
      ref={popoverRef}
      data-testid="piece-popover"
      className="hidden lg:flex absolute z-10 items-center gap-0.5 p-1 bg-surface border border-line rounded-tile shadow-cardhover"
      style={{ top, left, transform: `translate(${tx}, ${ty})` }}
    >
      {canRotateHere && (
        <IconButton aria-label="회전" title="회전" onClick={() => rotatePiece(row, col)}>
          🔄
        </IconButton>
      )}
      {isEditorMode ? (
        <>
          <IconButton
            aria-label="회전잠금 토글"
            title={cell.canRotate ? '회전잠금 걸기' : '회전잠금 풀기'}
            className={cell.canRotate ? '' : '!bg-warning-soft'}
            onClick={() => toggleRotateLock(row, col)}
          >
            🔒
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
