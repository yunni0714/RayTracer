import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSearchParams } from 'react-router-dom';
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
  const {
    allLibraryMaps, setAllLibraryMaps, setCurrentLoadedMap, setLibraryMode,
    setMapData, setInventory, toggleMode, isEditorMode, resetEditorState,
    setLaserOn, showNotification,
  } = useGameStore(useShallow(s => ({
    allLibraryMaps: s.allLibraryMaps,
    setAllLibraryMaps: s.setAllLibraryMaps,
    setCurrentLoadedMap: s.setCurrentLoadedMap,
    setLibraryMode: s.setLibraryMode,
    setMapData: s.setMapData,
    setInventory: s.setInventory,
    toggleMode: s.toggleMode,
    isEditorMode: s.isEditorMode,
    resetEditorState: s.resetEditorState,
    setLaserOn: s.setLaserOn,
    showNotification: s.showNotification,
  })));

  const [, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'reactionGod'>('createdAt');

  useEffect(() => {
    setLoading(true);
    fetchLibraryList(sortBy)
      .then(setAllLibraryMaps)
      .finally(() => setLoading(false));
  }, [sortBy, setAllLibraryMaps]);

  function playMap(map: MapDocument) {
    const grid = mapDocToGrid(map);
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
    if (!isEditorMode) toggleMode();
    setLibraryMode(false);
    setTimeout(() => {
      if (useGameStore.getState().isEditorMode) useGameStore.getState().toggleMode();
      setLaserOn(true);
    }, 0);
    showNotification(`[${map.title}] 플레이를 시작합니다!`, '#27ae60');
  }

  function createNewMap() {
    if (!window.confirm('진행 중인 맵이 모두 초기화되고 빈 에디터로 돌아갑니다. 새로 만드시겠습니까?')) return;
    resetEditorState();
    setLibraryMode(false);
    setSearchParams({});
    showNotification('새로운 맵이 생성되었습니다!', '#e67e22');
  }

  const isSearching = search.trim() !== '';
  const filtered = isSearching
    ? allLibraryMaps.filter(m =>
        m.title.toLowerCase().includes(search.toLowerCase()) ||
        m.author.toLowerCase().includes(search.toLowerCase())
      )
    : allLibraryMaps;

  const featured = isSearching ? [] : [...allLibraryMaps]
    .filter(m => (m.reactionGod ?? 0) >= 3)
    .sort((a, b) => (b.reactionGod ?? 0) - (a.reactionGod ?? 0))
    .slice(0, 10);

  const original = isSearching ? [] : [...allLibraryMaps]
    .filter(m => m.author === 'RayOriginal')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto" style={{ background: '#f8fafc' }}>

      {/* ── Featured 섹션 ──────────────────────────── */}
      {featured.length > 0 && (
        <div style={{ marginBottom: 45 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 16px', letterSpacing: '-0.5px', textTransform: 'capitalize', paddingLeft: 4 }}>
            featured
          </h2>
          <div className="horizontal-scroll-section">
            {featured.map(map => (
              <MapCard key={map.id} map={map} onClick={playMap} />
            ))}
          </div>
        </div>
      )}

      {/* ── Original 섹션 ──────────────────────────── */}
      {original.length > 0 && (
        <div style={{ marginBottom: 45 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 16px', letterSpacing: '-0.5px', textTransform: 'capitalize', paddingLeft: 4 }}>
            original
          </h2>
          <div className="horizontal-scroll-section">
            {original.map(map => (
              <MapCard key={map.id} map={map} onClick={playMap} />
            ))}
          </div>
        </div>
      )}

      {/* ── Recent Maps 헤더 ───────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        margin: '0 0 20px', padding: '16px 20px',
        background: 'white', borderRadius: 10,
        boxShadow: '0 2px 5px rgba(0,0,0,0.05)', flexWrap: 'wrap',
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, flexShrink: 0, letterSpacing: '-0.5px', textTransform: 'capitalize' }}>
          recent maps
        </h2>
        <input
          type="text"
          placeholder="맵 제목, 제작자 이름으로 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: '10px 14px', fontSize: 14, border: '2px solid #e2e8f0', borderRadius: 8, outline: 'none', fontFamily: 'inherit' }}
          onFocus={e => (e.target.style.borderColor = '#2980b9')}
          onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
        />
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          style={{ padding: '10px 14px', fontSize: 14, border: '2px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', background: 'white', fontFamily: 'inherit' }}
        >
          <option value="createdAt">최신 등록순</option>
          <option value="reactionGod">갓맵(👍)순</option>
        </select>
        <button
          onClick={createNewMap}
          style={{ padding: '10px 18px', background: '#e67e22', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 14, fontFamily: 'inherit' }}
        >
          ✨ 새 맵 만들기
        </button>
      </div>

      {/* ── Recent Maps 그리드 ─────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-12 text-gray-400">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="flex justify-center py-12 text-gray-400">맵이 없습니다.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 24, marginBottom: 60 }}>
          {filtered.map(map => (
            <MapCard key={map.id} map={map} onClick={playMap} />
          ))}
        </div>
      )}
    </div>
  );
}
