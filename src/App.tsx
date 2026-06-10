import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { useGameStore, emptyGrid } from './store/gameStore';
import { fetchFromDB } from './lib/firebaseService';
import { EditorPage } from './pages/EditorPage';
import type { CellData, Rotation } from './types/game';

function useUrlMapLoader() {
  const [searchParams] = useSearchParams();
  const currentUserUid = useGameStore(s => s.currentUserUid);
  const { loadMapForPlay, setLibraryMode } = useGameStore(useShallow(s => ({
    loadMapForPlay: s.loadMapForPlay,
    setLibraryMode: s.setLibraryMode,
  })));

  useEffect(() => {
    const mapId = searchParams.get('mapId');
    if (!mapId) return;

    fetchFromDB(mapId).then(map => {
      if (!map) return;

      const size = map.gridSize ?? 5;
      const grid = emptyGrid(size);
      for (const item of map.mapData) {
        if (item.y >= 0 && item.y < size && item.x >= 0 && item.x < size) {
          grid[item.y][item.x] = {
            type: item.type,
            rotation: item.rotation as Rotation,
            canMove: item.canMove,
            canRotate: item.canRotate,
            isInventory: item.isInventory,
          } as CellData;
        }
      }

      loadMapForPlay(grid, map);
      setLibraryMode(false);
    });
  // URL이 처음 로드될 때만 1회 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserUid]);
}

export function App() {
  useTheme();
  useAuth();
  useUrlMapLoader();

  return <EditorPage />;
}
