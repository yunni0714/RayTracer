import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { useLaserCanvas } from '../../hooks/useLaserCanvas';
import { GridContainer } from './GridContainer';
import { LaserCanvas } from './LaserCanvas';
import { PiecePopover } from './PiecePopover';

export function GameBoard() {
  const { isEditorMode } = useGameStore(useShallow(s => ({ isEditorMode: s.isEditorMode })));

  const canvasRef = useLaserCanvas();

  return (
    <div className="flex flex-col items-start gap-2 w-full max-w-[500px]">
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
