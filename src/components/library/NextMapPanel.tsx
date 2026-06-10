import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { MiniGrid } from './MiniGrid';
import type { MapDocument, Difficulty } from '../../types/game';
import type { CellData, Rotation } from '../../types/game';

const LS_KEY = 'ray_map_states';

function getPlayedIds(): Set<string> {
  try {
    return new Set(Object.keys(JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')));
  } catch {
    return new Set();
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickNextMaps(allMaps: MapDocument[], currentId: string): MapDocument[] {
  const playedIds = getPlayedIds();
  const candidates = allMaps.filter(m => m.id !== currentId);
  const unplayed = shuffle(candidates.filter(m => !playedIds.has(m.id)));
  const played = shuffle(candidates.filter(m => playedIds.has(m.id)));
  return [...unplayed, ...played].slice(0, 3);
}

function calculateUserDifficulty(diffVotes: Partial<Record<Difficulty, number>>): Difficulty | null {
  const entries = Object.entries(diffVotes) as [Difficulty, number][];
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
  } catch {
    return '';
  }
}

function mapDocToGrid(map: MapDocument): (CellData | null)[][] {
  const size = map.gridSize ?? 5;
  const grid: (CellData | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  for (const item of map.mapData) {
    if (item.y >= 0 && item.y < size && item.x >= 0 && item.x < size && !item.isInventory) {
      grid[item.y][item.x] = { type: item.type, rotation: item.rotation as Rotation, canMove: item.canMove, canRotate: item.canRotate, isInventory: false };
    }
  }
  return grid;
}

export function NextMapPanel() {
  const {
    allLibraryMaps, currentLoadedMapObj, setLibraryMode,
  } = useGameStore(useShallow(s => ({
    allLibraryMaps: s.allLibraryMaps,
    currentLoadedMapObj: s.currentLoadedMapObj,
    setLibraryMode: s.setLibraryMode,
  })));

  const nextMaps = useMemo(
    () => currentLoadedMapObj ? pickNextMaps(allLibraryMaps, currentLoadedMapObj.id) : [],
    // currentLoadedMapObj.id 변경 시마다 새로 섞음
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allLibraryMaps, currentLoadedMapObj?.id]
  );

  function playMap(map: MapDocument) {
    const s = useGameStore.getState();
    if (s.isAnswerShown) s.hideAnswer();
    if (s.isMapEditMode) s.exitMapEditMode({ restore: false });

    const size = map.gridSize ?? 5;
    const grid: (CellData | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
    for (const item of map.mapData) {
      if (item.y >= 0 && item.y < size && item.x >= 0 && item.x < size) {
        grid[item.y][item.x] = {
          type: item.type,
          rotation: item.rotation as Rotation,
          canMove: item.canMove,
          canRotate: item.canRotate,
          isInventory: item.isInventory,
        };
      }
    }
    s.loadMapForPlay(grid, map);
    setLibraryMode(false);
    s.showNotification(`[${map.title}] 플레이를 시작합니다!`, '#27ae60');
  }

  if (nextMaps.length === 0) {
    return (
      <div className="py-5 text-center">
        <p className="text-[13px] text-ink-muted">다른 맵이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="mb-1 pb-2.5 text-[13px] font-extrabold text-ink border-b-2 border-line">
        다음 문제
      </p>
      {nextMaps.map(map => {
        const userDiff = calculateUserDifficulty(map.diffVotes);
        const evalLabel = userDiff ?? 'None';
        const mapItems = map.mapData.filter(i => !i.isInventory);
        const gridData = mapDocToGrid(map);
        const gridAsDTO = gridData.flatMap((row, r) =>
          row.map((cell, c) => cell ? { x: c, y: r, ...cell } : null).filter(Boolean) as typeof map.mapData
        );

        return (
          <div key={map.id} className="next-map-card" onClick={() => playMap(map)}>
            {/* 좌측: 미니 그리드 44% */}
            <div className="w-[44%] shrink-0">
              <MiniGrid mapData={mapItems.length > 0 ? map.mapData : gridAsDTO} hideInventory variant="v2" gridSize={map.gridSize ?? 5} />
            </div>

            {/* 우측: 정보 */}
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <h4 className="text-[15px] font-extrabold text-ink whitespace-nowrap overflow-hidden text-ellipsis" title={map.title}>
                {map.title}
              </h4>
              <p className="text-[11px] text-ink-muted">
                {map.author} · {formatDate(map.createdAt)}
              </p>
              {map.description && (
                <p className="text-xs text-ink-muted flex-1 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {map.description}
                </p>
              )}
              <div className="flex gap-1 flex-wrap">
                <span className={`diff-pill diff-${map.difficulty}`}>공식: {map.difficulty}</span>
                <span className={`diff-pill diff-${evalLabel}`}>평가: {evalLabel}</span>
              </div>
              <div className="flex justify-end gap-2.5 text-[13px] font-bold">
                <span className="text-success">✅ {map.reactionOk}</span>
                <span className="text-danger">🔥 {map.reactionGod}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
