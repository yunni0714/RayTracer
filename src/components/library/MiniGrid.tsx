import { SVG_ART, GRID_SIZE } from '../../lib/svgArt';
import type { MapItemDTO } from '../../types/game';

interface Props {
  mapData: MapItemDTO[];
  hideInventory?: boolean;
  variant?: 'v2' | 'v1';
  size?: number; // v1 전용
}

export function MiniGrid({ mapData, hideInventory = false, variant = 'v2', size = 120 }: Props) {
  const grid: (MapItemDTO | null)[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(null)
  );
  for (const item of mapData) {
    if (item.y >= 0 && item.y < GRID_SIZE && item.x >= 0 && item.x < GRID_SIZE) {
      if (!hideInventory || !item.isInventory) {
        grid[item.y][item.x] = item;
      }
    }
  }

  if (variant === 'v1') {
    const cellSize = size / GRID_SIZE;
    return (
      <div
        className="grid border border-gray-300 bg-white shrink-0"
        style={{
          gridTemplateColumns: `repeat(${GRID_SIZE}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${GRID_SIZE}, ${cellSize}px)`,
          width: size,
          height: size,
        }}
      >
        {Array.from({ length: GRID_SIZE }, (_, row) =>
          Array.from({ length: GRID_SIZE }, (_, col) => {
            const item = grid[row][col];
            return (
              <div
                key={`${row}-${col}`}
                className="border border-gray-200 flex items-center justify-center overflow-hidden"
                style={{ width: cellSize, height: cellSize }}
              >
                {item && (
                  <div
                    style={{
                      transform: `rotate(${item.rotation}deg)`,
                      width: cellSize - 4,
                      height: cellSize - 4,
                    }}
                    dangerouslySetInnerHTML={{ __html: SVG_ART[item.type] }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    );
  }

  // v2: aspect-ratio 1/1, percentage layout
  return (
    <div className="mini-grid-v2">
      {Array.from({ length: GRID_SIZE }, (_, row) =>
        Array.from({ length: GRID_SIZE }, (_, col) => {
          const item = grid[row][col];
          return (
            <div key={`${row}-${col}`} className="mini-cell-v2">
              {item && (
                <div
                  style={{
                    transform: `rotate(${item.rotation}deg)`,
                    width: '75%',
                    height: '75%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  dangerouslySetInnerHTML={{ __html: SVG_ART[item.type] }}
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
