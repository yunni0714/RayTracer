import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { useLaserCanvas } from '../../hooks/useLaserCanvas';
import { GridContainer } from './GridContainer';
import { LaserCanvas } from './LaserCanvas';
import { CELL_SIZE, GRID_SIZE } from '../../lib/svgArt';

const size = CELL_SIZE * GRID_SIZE;

export function GameBoard() {
  const { isEditorMode } = useGameStore(useShallow(s => ({ isEditorMode: s.isEditorMode })));

  const canvasRef = useLaserCanvas();

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <GridContainer />
        <LaserCanvas ref={canvasRef} />
      </div>

      {isEditorMode && (
        <div className="text-xs text-ink-muted leading-5">
          🖱️ <strong>기물 잡고 이동:</strong> 드래그 후 도구 자동 재선택<br />
          🖱️ <strong>기물 든 상태 클릭:</strong> 같은 기물이면 <span className="text-danger font-semibold">회전</span>, 다른 기물이면 <span className="text-danger font-semibold">덮어쓰기</span><br />
          🖱️ <strong>빈손 상태 클릭:</strong> 특성 덧칠 및 회전
        </div>
      )}
    </div>
  );
}
