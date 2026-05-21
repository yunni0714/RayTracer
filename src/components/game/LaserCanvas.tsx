import { forwardRef } from 'react';
import { CELL_SIZE, GRID_SIZE } from '../../lib/svgArt';

const size = CELL_SIZE * GRID_SIZE;

export const LaserCanvas = forwardRef<HTMLCanvasElement>((_, ref) => (
  <canvas
    ref={ref}
    style={{ width: size, height: size }}
    className="absolute top-0 left-0 z-[2] pointer-events-none"
  />
));
LaserCanvas.displayName = 'LaserCanvas';
