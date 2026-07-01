import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { useLaserCanvas } from '../../hooks/useLaserCanvas';
import { GridContainer } from './GridContainer';
import { LaserCanvas } from './LaserCanvas';
import { PiecePopover } from './PiecePopover';
import { PenLayer } from './PenLayer';

// 셀 1칸의 기준 픽셀 크기. 그리드가 커질수록 셀을 한 단계당 CELL_SHRINK_PX씩
// 줄여서, 보드 전체는 완만하게만 커지고 셀은 식별 가능한 크기를 유지한다.
// (5x5: 100px 셀 → 보드 500px, 9x9: 72px 셀 → 보드 648px)
const BASE_CELL_PX = 100;
const CELL_SHRINK_PX = 7;

export function GameBoard() {
  const { isEditorMode, gridSize, penKey } = useGameStore(useShallow(s => ({
    isEditorMode: s.isEditorMode,
    gridSize: s.mapData.length,
    // 테스트 종료(언마운트) / 맵 전환(id 변화 → 리마운트) 시 필기 레이어 초기화용 키
    penKey: s.currentLoadedMapObj?.id ?? 'local',
  })));

  const canvasRef = useLaserCanvas();

  const cellPx = BASE_CELL_PX - (gridSize - 5) * CELL_SHRINK_PX;

  return (
    <div
      className="flex flex-col items-start gap-2 w-full"
      style={{ maxWidth: gridSize * cellPx }}
    >
      <div className="relative w-full aspect-square">
        <GridContainer />
        <LaserCanvas ref={canvasRef} />
        <PiecePopover />
        {/* 필기 오버레이: 테스트(플레이) 모드에서만. 종료/맵전환 시 소멸 → 레이어 초기화 */}
        {!isEditorMode && <PenLayer key={penKey} />}
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
