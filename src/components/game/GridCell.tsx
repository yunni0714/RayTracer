import { SVG_ART, CELL_SIZE } from '../../lib/svgArt';
import type { CellData } from '../../types/game';

interface Props {
  row: number;
  col: number;
  cell: CellData | null;
}

export function GridCell({ row, col, cell }: Props) {
  return (
    <div
      data-row={row}
      data-col={col}
      className="grid-cell relative border border-gray-300 bg-white cursor-pointer select-none overflow-hidden hover:bg-gray-50"
      style={{ width: CELL_SIZE, height: CELL_SIZE }}
    >
      {cell && (
        <div
          className="absolute inset-0 flex items-center justify-center p-2"
          style={{ transform: `rotate(${cell.rotation}deg)` }}
          dangerouslySetInnerHTML={{ __html: SVG_ART[cell.type] }}
        />
      )}
      {cell?.isInventory && (
        <div className="absolute top-0.5 right-0.5 text-xs leading-none select-none">🎒</div>
      )}
      {cell?.isInventory && !cell.canRotate && (
        <div className="absolute top-0.5 left-0.5 text-xs leading-none select-none">🔒</div>
      )}
      {cell && !cell.isInventory && cell.canRotate && (
        <div className="absolute top-0.5 right-0.5 text-xs leading-none select-none">🔄</div>
      )}
    </div>
  );
}
