import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { computeLaser } from '../../lib/laserEngine';
import { countInventoryTargets } from '../../lib/targets';
import { Button } from '../ui';

export function StatusBar() {
  const { mapData, playerInventory, undoStack, undo, isLaserOn, toggleLaser } =
    useGameStore(useShallow(s => ({
      mapData: s.mapData,
      playerInventory: s.playerInventory,
      undoStack: s.undoStack,
      undo: s.undo,
      isLaserOn: s.isLaserOn,
      toggleLaser: s.toggleLaser,
    })));

  const pieceCount = mapData.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  const gridSize = mapData.length;
  const laser = useMemo(() => computeLaser(mapData), [mapData]);

  // 인벤토리에 남은 표적도 총계에 넣는다. 안 그러면 표적을 안 꺼낸 채로
  // "✓ 해결!" 이 떠 버린다 (에디터 모드는 인벤 기물이 그리드에 있어 0).
  const invTargets = countInventoryTargets(playerInventory);
  const targetsTotal = laser.targetsTotal + invTargets;
  const solved = invTargets === 0 && laser.solved;

  return (
    <footer className="flex items-center gap-4 px-4 py-1.5 bg-surface border-t border-line text-xs text-ink-muted">
      <span>기물 <strong className="text-ink">{pieceCount}</strong></span>
      <span>그리드 <strong className="text-ink">{gridSize}×{gridSize}</strong></span>
      {targetsTotal > 0 && (
        <span>
          타겟 <strong className={solved ? 'text-success' : 'text-ink'}>
            {laser.targetsHit}/{targetsTotal}
          </strong>
          {solved && <strong className="text-success"> ✓ 해결!</strong>}
        </span>
      )}
      <span className="ml-auto" />
      <Button variant="ghost" onClick={undo} disabled={undoStack.length === 0}>
        ↩️ 실행취소
      </Button>
      <Button variant={isLaserOn ? 'success' : 'danger'} onClick={toggleLaser}>
        {isLaserOn ? '🟢 레이저 ON' : '🔴 레이저 OFF'}
      </Button>
    </footer>
  );
}
