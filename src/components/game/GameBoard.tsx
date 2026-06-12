import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { useLaserCanvas } from '../../hooks/useLaserCanvas';
import { GridContainer } from './GridContainer';
import { LaserCanvas } from './LaserCanvas';
import { PiecePopover } from './PiecePopover';

// 셀 1칸의 기준 픽셀 크기 — 보드 최대 폭이 그리드 크기에 비례하도록 한다
// (5x5=500px, 9x9=900px). 화면이 좁으면 w-full로 자동 축소된다.
const BASE_CELL_PX = 100;

export function GameBoard() {
  const { isEditorMode, gridSize } = useGameStore(useShallow(s => ({
    isEditorMode: s.isEditorMode,
    gridSize: s.mapData.length,
  })));

  const canvasRef = useLaserCanvas();

  return (
    <div
      className="flex flex-col items-start gap-2 w-full"
      style={{ maxWidth: gridSize * BASE_CELL_PX }}
    >
      <div className="relative w-full aspect-square">
        <GridContainer />
        <LaserCanvas ref={canvasRef} />
        <PiecePopover />
      </div>

      {isEditorMode && (
        <div className="text-xs text-ink-muted leading-5">
          🖱️ <strong>좌클릭(기물):</strong> 옵션 메뉴 — 특성·삭제 <span className="text-ink-muted">(도구를 들고 있으면 <span className="text-danger font-semibold">도구 해제</span>부터)</span><br />
          🖱️ <strong>우클릭(기물):</strong> <span className="text-danger font-semibold">회전</span><br />
          🖱️ <strong>드래그:</strong> 이동/스왑
        </div>
      )}
    </div>
  );
}
