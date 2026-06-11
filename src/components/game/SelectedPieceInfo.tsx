import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { getSvgArt } from '../../lib/svgArt';
import {
  getPieceLabel, NON_ROTATABLE, rotatePiece, deletePiece, refundPiece,
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
  useGameStore(s => s.pieceConfigRev); // config 오버레이 갱신 시 리렌더

  const cell = selectedCell ? mapData[selectedCell.row][selectedCell.col] : null;

  if (!selectedCell || !cell) {
    return <p className="text-xs text-ink-muted">기물을 클릭하면 정보가 표시됩니다.</p>;
  }

  const { row, col } = selectedCell;
  const canRotateHere = isEditorMode
    ? !NON_ROTATABLE.includes(cell.type)
    : cell.canRotate && !NON_ROTATABLE.includes(cell.type);

  return (
    <div className="flex flex-col gap-2" data-testid="selected-piece-info">
      {/* 미리보기 + 이름 */}
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 shrink-0 border border-line rounded-tile bg-[var(--cell)] p-1">
          <div style={{ transform: `rotate(${cell.rotation}deg)` }} dangerouslySetInnerHTML={{ __html: getSvgArt(cell.type) }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-ink truncate">{getPieceLabel(cell.type)}</p>
          <p className="text-[11px] text-ink-muted">({row}, {col}) · {cell.rotation}°</p>
        </div>
      </div>

      {/* 특성 배지 — 맥락별 기본값은 무표시, 일탈만 표시 */}
      <div className="flex gap-1 flex-wrap">
        {cell.isInventory && <Pill tone="danger">🎒 유저지급</Pill>}
        {!cell.isInventory && cell.canRotate && <Pill tone="info">🔄 회전 가능</Pill>}
        {cell.isInventory && !cell.canRotate && <Pill tone="normal">🔒 회전 불가</Pill>}
      </div>

      {/* 액션 */}
      <div className="flex flex-col gap-1.5">
        {canRotateHere && (
          <Button variant="secondary" block className="!text-xs" onClick={() => rotatePiece(row, col)}>
            ↻ 90° 회전
          </Button>
        )}
        {isEditorMode ? (
          <>
            {/* 회전 트레잇 토글(canRotate). 맥락별 라벨 + 일탈 상태일 때 솔리드 강조. */}
            <Button
              variant="secondary"
              block
              className={`!text-xs !border ${(cell.isInventory ? !cell.canRotate : cell.canRotate)
                ? '!bg-warning !text-white !border-warning'
                : '!bg-warning-soft !text-warning !border-warning'}`}
              onClick={() => toggleRotateLock(row, col)}
            >
              {cell.isInventory
                ? (cell.canRotate ? '🔒 회전 불가 지정' : '🔒 회전 불가 해제')
                : (cell.canRotate ? '🔄 회전 가능 해제' : '🔄 회전 가능 부여')}
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
