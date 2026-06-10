import type { CellData } from '../types/game';
import { GRID_SIZE } from './svgArt';

const DIRS: Record<number, { dx: number; dy: number }> = {
  0: { dx: 1, dy: 0 }, 45: { dx: 1, dy: 1 }, 90: { dx: 0, dy: 1 }, 135: { dx: -1, dy: 1 },
  180: { dx: -1, dy: 0 }, 225: { dx: -1, dy: -1 }, 270: { dx: 0, dy: -1 }, 315: { dx: 1, dy: -1 },
};

export function calculateReflection(inDir: number, surfaceAngle: number): number {
  return (2 * surfaceAngle - inDir + 720) % 360;
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  cellSize: number,
  startX: number, startY: number,
  endX: number, endY: number,
  stopAtEdge = false,
): void {
  const offset = cellSize / 2;
  const x1 = startX * cellSize + offset;
  const y1 = startY * cellSize + offset;
  let x2 = endX * cellSize + offset;
  let y2 = endY * cellSize + offset;

  if (stopAtEdge) {
    x2 = (startX + endX) / 2 * cellSize + offset;
    y2 = (startY + endY) / 2 * cellSize + offset;
  }
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function clearLaser(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

// 컨테이너가 CSS 크기를 결정한다. 백킹스토어만 dpr 배율로 맞춘다.
export function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  const cssSize = canvas.clientWidth || 1;
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function simulateLaser(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  mapData: (CellData | null)[][],
): void {
  clearLaser(ctx, canvas);

  const cellSize = (canvas.clientWidth || canvas.width) / GRID_SIZE;
  const beams: { x: number; y: number; dir: number }[] = [];
  const visited = new Set<string>();

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = mapData[r][c];
      if (cell?.type === 'ray') {
        beams.push({ x: c, y: r, dir: (cell.rotation + 270) % 360 });
      }
    }
  }
  if (beams.length === 0) return;

  const laserColor =
    getComputedStyle(document.documentElement).getPropertyValue('--laser').trim() || '#ff3333';
  ctx.lineWidth = 4;
  ctx.strokeStyle = laserColor;
  ctx.lineCap = 'round';
  ctx.shadowBlur = 10;
  ctx.shadowColor = laserColor;

  while (beams.length > 0) {
    const beam = beams.shift()!;
    const { x: cx, y: cy, dir: cDir } = beam;
    const dirVec = DIRS[cDir];
    const nextX = cx + dirVec.dx;
    const nextY = cy + dirVec.dy;

    if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) {
      drawLine(ctx, cellSize, cx, cy, nextX, nextY, true);
      continue;
    }

    const stateKey = `${nextX},${nextY},${cDir}`;
    if (visited.has(stateKey)) continue;
    visited.add(stateKey);

    const item = mapData[nextY][nextX];

    if (!item || item.type === 'block') {
      drawLine(ctx, cellSize, cx, cy, nextX, nextY, false);
      beams.push({ x: nextX, y: nextY, dir: cDir });
    } else if (item.type === 'ray' || item.type === 'target') {
      drawLine(ctx, cellSize, cx, cy, nextX, nextY, false);
    } else if (item.type === 'mirror_45') {
      drawLine(ctx, cellSize, cx, cy, nextX, nextY, false);
      const sa = (337.5 + item.rotation) % 360;
      beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, sa) });
    } else if (item.type === 'half_mirror_45') {
      drawLine(ctx, cellSize, cx, cy, nextX, nextY, false);
      const sa = (337.5 + item.rotation) % 360;
      beams.push({ x: nextX, y: nextY, dir: cDir });
      beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, sa) });
    } else if (['single_mirror', 'target_mirror_a', 'target_mirror_b'].includes(item.type)) {
      const normal = (225 + item.rotation) % 360;
      const sa = (135 + item.rotation) % 360;
      const rel = (cDir - normal + 360) % 360;
      if (rel > 90 && rel < 270) {
        drawLine(ctx, cellSize, cx, cy, nextX, nextY, false);
        beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, sa) });
      } else {
        drawLine(ctx, cellSize, cx, cy, nextX, nextY, true);
      }
    } else if (item.type === 'diag_single_mirror_a') {
      const normal = (112.5 + item.rotation) % 360;
      const sa = (202.5 + item.rotation) % 360;
      const rel = (cDir - normal + 360) % 360;
      if (rel > 90 && rel < 270) {
        drawLine(ctx, cellSize, cx, cy, nextX, nextY, false);
        beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, sa) });
      } else {
        drawLine(ctx, cellSize, cx, cy, nextX, nextY, true);
      }
    } else if (item.type === 'diag_single_mirror_b') {
      const normal = (67.5 + item.rotation) % 360;
      const sa = (157.5 + item.rotation) % 360;
      const rel = (cDir - normal + 360) % 360;
      if (rel > 90 && rel < 270) {
        drawLine(ctx, cellSize, cx, cy, nextX, nextY, false);
        beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, sa) });
      } else {
        drawLine(ctx, cellSize, cx, cy, nextX, nextY, true);
      }
    } else if (['v_target_mirror_a', 'v_target_mirror_b'].includes(item.type)) {
      const normal = (270 + item.rotation) % 360;
      const sa = item.rotation % 360;
      const rel = (cDir - normal + 360) % 360;
      if (rel > 90 && rel < 270) {
        drawLine(ctx, cellSize, cx, cy, nextX, nextY, false);
        beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, sa) });
      } else {
        drawLine(ctx, cellSize, cx, cy, nextX, nextY, true);
      }
    } else if (item.type === 'v_single_mirror') {
      const normal = (90 + item.rotation) % 360;
      const sa = item.rotation % 360;
      const rel = (cDir - normal + 360) % 360;
      if (rel > 90 && rel < 270) {
        drawLine(ctx, cellSize, cx, cy, nextX, nextY, false);
        beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, sa) });
      } else {
        drawLine(ctx, cellSize, cx, cy, nextX, nextY, true);
      }
    } else if (item.type === 'mirror') {
      drawLine(ctx, cellSize, cx, cy, nextX, nextY, false);
      const sa = (135 + item.rotation) % 360;
      beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, sa) });
    } else if (item.type === 'half_mirror') {
      drawLine(ctx, cellSize, cx, cy, nextX, nextY, false);
      const sa = (135 + item.rotation) % 360;
      beams.push({ x: nextX, y: nextY, dir: cDir });
      beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, sa) });
    } else if (item.type === 'v_mirror') {
      drawLine(ctx, cellSize, cx, cy, nextX, nextY, false);
      const sa = item.rotation % 360;
      beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, sa) });
    } else if (item.type === 'v_half_mirror') {
      drawLine(ctx, cellSize, cx, cy, nextX, nextY, false);
      const sa = item.rotation % 360;
      beams.push({ x: nextX, y: nextY, dir: cDir });
      beams.push({ x: nextX, y: nextY, dir: calculateReflection(cDir, sa) });
    } else if (item.type === 'tunnel') {
      const tunnelRot = item.rotation % 180;
      const passH = tunnelRot % 180 === 0 && (cDir === 90 || cDir === 270);
      const passV = tunnelRot % 180 === 90 && (cDir === 180 || cDir === 0);
      if (passH || passV) {
        drawLine(ctx, cellSize, cx, cy, nextX, nextY, false);
        beams.push({ x: nextX, y: nextY, dir: cDir });
      } else {
        drawLine(ctx, cellSize, cx, cy, nextX, nextY, true);
      }
    }
  }
}
