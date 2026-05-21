import { useGameStore } from '../../store/gameStore';
import { useLaserCanvas } from '../../hooks/useLaserCanvas';
import { GridContainer } from './GridContainer';
import { LaserCanvas } from './LaserCanvas';
import { CELL_SIZE, GRID_SIZE } from '../../lib/svgArt';

const size = CELL_SIZE * GRID_SIZE;

export function GameBoard() {
  const { isLaserOn, toggleLaser, isEditorMode } = useGameStore(s => ({
    isLaserOn: s.isLaserOn,
    toggleLaser: s.toggleLaser,
    isEditorMode: s.isEditorMode,
  }));

  const canvasRef = useLaserCanvas();

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <GridContainer />
        <LaserCanvas ref={canvasRef} />
      </div>

      {!isEditorMode && (
        <button
          onClick={toggleLaser}
          className={`px-4 py-2 rounded text-white text-sm font-medium transition-colors ${
            isLaserOn ? 'bg-ray-green' : 'bg-ray-red'
          }`}
        >
          {isLaserOn ? '🟢 레이저 끄기 (ON)' : '🔴 레이저 켜기 (OFF)'}
        </button>
      )}
    </div>
  );
}
