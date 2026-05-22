import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { fetchLibraryList } from '../../lib/firebaseService';
import { MapCard } from './MapCard';
import type { MapDocument } from '../../types/game';
import type { CellData, Rotation } from '../../types/game';
import { GRID_SIZE } from '../../lib/svgArt';

function mapDocToGrid(mapObj: MapDocument): (CellData | null)[][] {
  const grid: (CellData | null)[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(null)
  );
  for (const item of mapObj.mapData) {
    if (item.y >= 0 && item.y < GRID_SIZE && item.x >= 0 && item.x < GRID_SIZE) {
      grid[item.y][item.x] = {
        type: item.type,
        rotation: item.rotation as Rotation,
        canMove: item.canMove,
        canRotate: item.canRotate,
        isInventory: item.isInventory,
      };
    }
  }
  return grid;
}

export function LibraryScreen() {
  const { allLibraryMaps, setAllLibraryMaps, setCurrentLoadedMap, setLibraryMode,
    setMapData, setInventory, toggleMode, isEditorMode } = useGameStore(useShallow(s => ({
    allLibraryMaps: s.allLibraryMaps,
    setAllLibraryMaps: s.setAllLibraryMaps,
    setCurrentLoadedMap: s.setCurrentLoadedMap,
    setLibraryMode: s.setLibraryMode,
    setMapData: s.setMapData,
    setInventory: s.setInventory,
    toggleMode: s.toggleMode,
    isEditorMode: s.isEditorMode,
  })));

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'reactionGod'>('createdAt');

  useEffect(() => {
    setLoading(true);
    fetchLibraryList(sortBy)
      .then(setAllLibraryMaps)
      .finally(() => setLoading(false));
  }, [sortBy, setAllLibraryMaps]);

  const filtered = allLibraryMaps.filter(m =>
    search === '' ||
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.author.toLowerCase().includes(search.toLowerCase())
  );

  function playMap(map: MapDocument) {
    const grid = mapDocToGrid(map);

    // 인벤토리 기물 추출
    const inv: ReturnType<typeof useGameStore.getState>['playerInventory'] = {};
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = grid[r][c];
        if (cell?.isInventory) {
          const key = `${cell.type}_${cell.canRotate ? 'r' : 'f'}`;
          if (!inv[key]) inv[key] = { count: 0, type: cell.type, canRotate: cell.canRotate, rotation: cell.rotation };
          inv[key].count++;
          grid[r][c] = null;
        }
      }
    }

    setMapData(grid);
    setInventory(inv);
    setCurrentLoadedMap(map);
    if (!isEditorMode) toggleMode(); // 에디터로 먼저 돌아갔다가
    setLibraryMode(false);
    // 테스트 모드로 진입은 toggleMode로 처리
    setTimeout(() => {
      useGameStore.getState().toggleMode();
      useGameStore.getState().setLaserOn(true);
    }, 0);
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-gray-800">📚 라이브러리</h2>
        <div className="ml-auto flex gap-2">
          <input
            type="text"
            placeholder="제목/작성자 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-ray-purple"
          />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none"
          >
            <option value="createdAt">최신순</option>
            <option value="reactionGod">갓맵순</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-gray-400">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="flex justify-center py-12 text-gray-400">맵이 없습니다.</div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {filtered.map(map => (
            <MapCard key={map.id} map={map} onClick={playMap} />
          ))}
        </div>
      )}
    </div>
  );
}
