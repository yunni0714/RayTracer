import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { SVG_ART } from '../../lib/svgArt';
import {
  PIECE_LABELS, rotatePiece, deletePiece, refundPiece,
  toggleRotateLock, toggleUserSupply, clearTraits,
} from '../../lib/pieceActions';
import { Button, Pill } from '../ui';

// 선택 기물 정보 + 편집. 우측 인스펙터(데스크탑)와 하단 시트(모바일) 공용.
// 플로팅 팝오버(PiecePopover)와 같은 스토어 상태를 편집하므로 자동 동기화된다.
export function SelectedPieceInfo() {
  const { selectedCell, mapData, isEditorMode } = useGameStore(useShallow(s => ({
    selectedCell: s.selectedCell,
    mapData: s.mapData,
    isEditorMode: s.isEditorMode,
  })));

  const cell = selectedCell ? mapData[selectedCell.row][selectedCell.col] : null;

  if (!selectedCell || !cell) {
    return <p className="text-xs text-ink-muted">기물을 클릭하면 정보가 표시됩니다.</p>;
  }

  const { row, col } = selectedCell;
  const canRotateHere = isEditorMode ? cell.type !== 'block' : cell.canRotate;

  return (
    <div className="flex flex-col gap-2" data-testid="selected-piece-info">
      {/* 미리보기 + 이름 */}
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 shrink-0 border border-line rounded-tile bg-[var(--cell)] p-1">
          <div style={{ transform: `rotate(${cell.rotation}deg)` }} dangerouslySetInnerHTML={{ __html: SVG_ART[cell.type] }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-ink truncate">{PIECE_LABELS[cell.type]}</p>
          <p className="text-[11px] text-ink-muted">({row}, {col}) · {cell.rotation}°</p>
        </div>
      </div>

      {/* 특성 배지 */}
      <div className="flex gap-1 flex-wrap">
        {cell.isInventory && <Pill tone="danger">🎒 유저지급</Pill>}
        {!cell.canRotate && <Pill tone="normal">🔒 회전잠금</Pill>}
        {cell.canRotate && <Pill tone="info">🔄 회전가능</Pill>}
      </div>

      {/* 액션 */}
      <div className="flex flex-col gap-1.5">
        {canRotateHere && (
          <Button variant="secondary" block className="!text-xs" onClick={() => rotatePiece(row, col)}>
            🔄 회전
          </Button>
        )}
        {isEditorMode ? (
          <>
            <Button
              variant="secondary"
              block
              className={`!text-xs !border ${cell.canRotate
                ? '!bg-warning-soft !text-warning !border-warning'
                : '!bg-warning !text-white !border-warning'}`}
              onClick={() => toggleRotateLock(row, col)}
            >
              🔒 회전잠금 {cell.canRotate ? 'OFF' : 'ON'}
            </Button>
            <Button
              variant="secondary"
              block
              className={`!text-xs !border ${cell.isInventory
                ? '!bg-danger !text-white !border-danger'
                : '!bg-danger-soft !text-danger !border-danger'}`}
              onClick={() => toggleUserSupply(row, col)}
            >
              🎒 유저지급 {cell.isInventory ? 'ON' : 'OFF'}
            </Button>
            <Button variant="secondary" block className="!text-xs" onClick={() => clearTraits(row, col)}>
              ✨ 특성 삭제
            </Button>
            <Button variant="danger" block className="!text-xs" onClick={() => deletePiece(row, col)}>
              🗑 기물 삭제
            </Button>
          </>
        ) : (
          cell.isInventory && (
            <Button variant="secondary" block className="!text-xs" onClick={() => refundPiece(row, col)}>
              ♻ 인벤토리로 회수
            </Button>
          )
        )}
      </div>
    </div>
  );
}
