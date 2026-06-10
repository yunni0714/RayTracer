import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { GRID_SIZE } from '../../lib/svgArt';
import { Button } from '../ui';

export function StatusBar() {
  const { mapData, undoStack, undo, isLaserOn, toggleLaser } = useGameStore(useShallow(s => ({
    mapData: s.mapData,
    undoStack: s.undoStack,
    undo: s.undo,
    isLaserOn: s.isLaserOn,
    toggleLaser: s.toggleLaser,
  })));

  const pieceCount = mapData.reduce((sum, row) => sum + row.filter(Boolean).length, 0);

  return (
    <footer className="flex items-center gap-4 px-4 py-1.5 bg-surface border-t border-line text-xs text-ink-muted">
      <span>기물 <strong className="text-ink">{pieceCount}</strong></span>
      <span>그리드 <strong className="text-ink">{GRID_SIZE}×{GRID_SIZE}</strong></span>
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
