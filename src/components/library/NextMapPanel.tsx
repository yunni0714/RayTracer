import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { MiniGrid } from './MiniGrid';
import { MapCategoryBadge } from './MapCategoryBadge';
import { computeMapCategory } from '../../lib/mapCategory';
import { mapDocToGrid } from '../../lib/mapGrid';
import { fetchLibraryPage } from '../../lib/firebaseService';
import type { MapDocument, Difficulty } from '../../types/game';

const LS_KEY = 'ray_map_states';

// 추천 표본. 라이브러리를 거쳐 왔으면 누적본(1페이지 = 24개)으로 충분하고,
// ?mapId= 딥링크로 바로 들어온 경우에만 따로 한 번 받아온다.
const NEXT_POOL_MIN = 12;
const NEXT_POOL_SIZE = 30;

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

export function NextMapPanel() {
  const {
    allLibraryMaps, currentLoadedMapObj, setLibraryMode,
  } = useGameStore(useShallow(s => ({
    allLibraryMaps: s.allLibraryMaps,
    currentLoadedMapObj: s.currentLoadedMapObj,
    setLibraryMode: s.setLibraryMode,
  })));
  useGameStore(s => s.pieceConfigRev); // 폴더 오버레이 갱신 시 카테고리 재계산

  // 딥링크로 바로 들어오면 라이브러리 누적본이 비어 있어 추천이 통째로 안 뜬다.
  // 그 경우에만 표본을 한 번 받아온다 — 라이브러리를 거쳤으면 추가 조회 0회.
  const [fallbackPool, setFallbackPool] = useState<MapDocument[]>([]);
  const fetched = useRef(false);
  useEffect(() => {
    if (fetched.current || allLibraryMaps.length >= NEXT_POOL_MIN) return;
    fetched.current = true;
    fetchLibraryPage({ sortBy: 'createdAt', pageSize: NEXT_POOL_SIZE })
      .then(page => setFallbackPool(page.maps))
      .catch(err => console.error('[nextmap] 추천 표본 조회 실패:', err));
  }, [allLibraryMaps.length]);

  const pool = allLibraryMaps.length >= NEXT_POOL_MIN ? allLibraryMaps : fallbackPool;

  const nextMaps = useMemo(
    () => currentLoadedMapObj ? pickNextMaps(pool, currentLoadedMapObj.id) : [],
    // currentLoadedMapObj.id 변경 시마다 새로 섞음
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pool, currentLoadedMapObj?.id]
  );

  function playMap(map: MapDocument) {
    const s = useGameStore.getState();
    if (s.isAnswerShown) s.hideAnswer();
    if (s.isMapEditMode) s.exitMapEditMode({ restore: false });

    s.loadMapForPlay(mapDocToGrid(map), map);
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
    <div className="flex flex-col gap-2">
      {nextMaps.map(map => {
        const userDiff = calculateUserDifficulty(map.diffVotes);
        const evalLabel = userDiff ?? 'None';

        return (
          <div
            key={map.id}
            className="next-map-card"
            data-category={computeMapCategory(map.mapData)}
            onClick={() => playMap(map)}
          >
            {/* 썸네일 + 제목/작성자 */}
            <div className="flex items-center gap-2">
              <div className="w-14 shrink-0">
                <MiniGrid mapData={map.mapData} hideInventory variant="v2" gridSize={map.gridSize ?? 5} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[13px] font-extrabold text-ink truncate" title={map.title}>
                  {map.title}
                </h4>
                <p className="text-[11px] text-ink-muted truncate">
                  {map.author} · {formatDate(map.createdAt)}
                </p>
              </div>
            </div>

            {/* 배지 + 반응 */}
            <div className="flex items-center gap-1 flex-wrap">
              <MapCategoryBadge mapData={map.mapData} className="!text-[10px] !px-1.5" />
              <span className={`diff-pill diff-${map.difficulty}`}>공식: {map.difficulty}</span>
              <span className={`diff-pill diff-${evalLabel}`}>평가: {evalLabel}</span>
              <span className="ml-auto flex gap-2 text-xs font-bold">
                <span className="text-success">✅ {map.reactionOk}</span>
                <span className="text-danger">🔥 {map.reactionGod}</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
