import { getSvgArt } from '../../lib/svgArt';
import { useGameStore } from '../../store/gameStore';
import type { MapItemDTO } from '../../types/game';

interface Props {
  mapData: MapItemDTO[];
  hideInventory?: boolean;
  variant?: 'v2' | 'v1';
  size?: number; // v1 전용
  gridSize?: number; // NxN. 없으면 5 (하위호환)
}

export function MiniGrid({ mapData, hideInventory = false, variant = 'v2', size = 120, gridSize = 5 }: Props) {
  useGameStore(s => s.pieceConfigRev); // config 오버레이 갱신 시 리렌더

  const grid: (MapItemDTO | null)[][] = Array.from({ length: gridSize }, () =>
    Array(gridSize).fill(null)
  );
  for (const item of mapData) {
    if (item.y >= 0 && item.y < gridSize && item.x >= 0 && item.x < gridSize) {
      if (!hideInventory || !item.isInventory) {
        grid[item.y][item.x] = item;
      }
    }
  }

  if (variant === 'v1') {
    const cellSize = size / gridSize;
    return (
      <div
        className="grid border border-[var(--cell-border)] bg-[var(--cell)] shrink-0"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${gridSize}, ${cellSize}px)`,
          width: size,
          height: size,
        }}
      >
        {Array.from({ length: gridSize }, (_, row) =>
          Array.from({ length: gridSize }, (_, col) => {
            const item = grid[row][col];
            return (
              <div
                key={`${row}-${col}`}
                className="border border-[var(--cell-border)] flex items-center justify-center overflow-hidden"
                style={{ width: cellSize, height: cellSize }}
              >
                {item && (
                  <div
                    style={{
                      transform: `rotate(${item.rotation}deg)`,
                      width: cellSize - 4,
                      height: cellSize - 4,
                    }}
                    dangerouslySetInnerHTML={{ __html: getSvgArt(item.type) }}
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
    <div
      className="mini-grid-v2"
      style={{
        gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
        gridTemplateRows: `repeat(${gridSize}, 1fr)`,
      }}
    >
      {Array.from({ length: gridSize }, (_, row) =>
        Array.from({ length: gridSize }, (_, col) => {
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
                  dangerouslySetInnerHTML={{ __html: getSvgArt(item.type) }}
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
