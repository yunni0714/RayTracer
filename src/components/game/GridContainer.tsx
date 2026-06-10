import { useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useGridDragDrop } from '../../hooks/useGridDragDrop';
import { GridCell } from './GridCell';

export function GridContainer() {
  const mapData = useGameStore(s => s.mapData);
  const gridRef = useRef<HTMLDivElement>(null);
  const gridSize = mapData.length;

  useGridDragDrop(gridRef);

  return (
    <div
      ref={gridRef}
      className="grid w-full h-full border-2 border-[var(--cell-border)] bg-[var(--grid-bg)] touch-none"
      style={{
        gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
        gridTemplateRows: `repeat(${gridSize}, 1fr)`,
      }}
    >
      {Array.from({ length: gridSize }, (_, row) =>
        Array.from({ length: gridSize }, (_, col) => (
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
