import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useAuth } from './hooks/useAuth';
import { useGameStore } from './store/gameStore';
import { fetchFromDB } from './lib/firebaseService';
import { EditorPage } from './pages/EditorPage';
import type { CellData, Rotation } from './types/game';
import { GRID_SIZE } from './lib/svgArt';

function useUrlMapLoader() {
  const [searchParams] = useSearchParams();
  const currentUserUid = useGameStore(s => s.currentUserUid);
  const { setMapData, setInventory, setCurrentLoadedMap, setLibraryMode, toggleMode, isEditorMode, setLaserOn } = useGameStore(useShallow(s => ({
    setMapData: s.setMapData,
    setInventory: s.setInventory,
    setCurrentLoadedMap: s.setCurrentLoadedMap,
    setLibraryMode: s.setLibraryMode,
    toggleMode: s.toggleMode,
    isEditorMode: s.isEditorMode,
    setLaserOn: s.setLaserOn,
  })));

  useEffect(() => {
    const mapId = searchParams.get('mapId');
    if (!mapId) return;

    fetchFromDB(mapId).then(map => {
      if (!map) return;

      const grid: (CellData | null)[][] = Array.from({ length: GRID_SIZE }, () =>
        Array(GRID_SIZE).fill(null)
      );
      const inv: ReturnType<typeof useGameStore.getState>['playerInventory'] = {};

      for (const item of map.mapData) {
        if (item.y >= 0 && item.y < GRID_SIZE && item.x >= 0 && item.x < GRID_SIZE) {
          const cell: CellData = {
            type: item.type,
            rotation: item.rotation as Rotation,
            canMove: item.canMove,
            canRotate: item.canRotate,
            isInventory: item.isInventory,
          };
          if (item.isInventory) {
            const key = `${item.type}_${item.canRotate ? 'r' : 'f'}`;
            if (!inv[key]) inv[key] = { count: 0, type: item.type, canRotate: item.canRotate, rotation: item.rotation as Rotation };
            inv[key].count++;
          } else {
            grid[item.y][item.x] = cell;
          }
        }
      }

      setMapData(grid);
      setInventory(inv);
      setCurrentLoadedMap(map);
      setLibraryMode(false);
      if (!isEditorMode) toggleMode();
      setTimeout(() => {
        if (useGameStore.getState().isEditorMode) toggleMode();
        setLaserOn(true);
      }, 50);
    });
  // URL이 처음 로드될 때만 1회 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserUid]);
}

export function App() {
  useAuth();
  useUrlMapLoader();

  return <EditorPage />;
}
