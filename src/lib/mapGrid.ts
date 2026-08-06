import type { CellData, MapDocument, Rotation } from '../types/game';

// MapDocument 의 희소 DTO 배열 → NxN 그리드.
// gridSize 없으면 5 (하위호환), 범위를 벗어난 아이템은 버린다.
export function mapDocToGrid(mapObj: MapDocument): (CellData | null)[][] {
  const size = mapObj.gridSize ?? 5;
  const grid: (CellData | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  for (const item of mapObj.mapData) {
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
  return grid;
}
