import type { CellData, MapDocument, MapItemDTO, Rotation } from '../types/game';

// Firestore 는 맵을 희소 배열(기물 있는 칸만 좌표를 단 평평한 목록)로 저장하고,
// 런타임(스토어·보드·엔진)은 NxN 2차원 배열을 쓴다. 그 사이를 잇는 단일 소스.
//
// 규칙 3가지가 여기 한 곳에만 있어야 한다:
//   ① gridSize 없으면 5 (하위호환)  ② 범위 밖 아이템 폐기  ③ CellData 필드 목록
// 예전에는 이 루프가 4벌로 복사돼 있어서, CellData 에 필드를 추가하면 네 곳을
// 다 고쳐야 하고 빠진 경로에서만 기물이 사라지는 식의 버그가 날 수 있었다.

/** 희소 DTO 목록 + 명시 크기 → NxN 그리드. 범위 밖 아이템은 버린다. */
export function itemsToGrid(items: MapItemDTO[], size: number): (CellData | null)[][] {
  const grid: (CellData | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  for (const item of items) {
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

/** MapDocument → NxN 그리드. gridSize 가 없으면 5 (하위호환). */
export function mapDocToGrid(mapObj: MapDocument): (CellData | null)[][] {
  return itemsToGrid(mapObj.mapData, mapObj.gridSize ?? 5);
}
