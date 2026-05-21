import { useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useGridDragDrop } from '../../hooks/useGridDragDrop';
import { GridCell } from './GridCell';
import { GRID_SIZE } from '../../lib/svgArt';

export function GridContainer() {
  const mapData = useGameStore(s => s.mapData);
  const gridRef = useRef<HTMLDivElement>(null);

  useGridDragDrop(gridRef);

  return (
    <div
      ref={gridRef}
      className="grid border-2 border-gray-400 bg-gray-100"
      style={{
        gridTemplateColumns: `repeat(${GRID_SIZE}, 100px)`,
        gridTemplateRows: `repeat(${GRID_SIZE}, 100px)`,
        width: GRID_SIZE * 100,
        height: GRID_SIZE * 100,
      }}
    >
      {Array.from({ length: GRID_SIZE }, (_, row) =>
        Array.from({ length: GRID_SIZE }, (_, col) => (
          <GridCell
            key={`${row}-${col}`}
            row={row}
            col={col}
            cell={mapData[row][col]}
          />
        ))
      )}
    </div>
  );
}
