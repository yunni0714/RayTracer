import type { CellData, PieceType } from '../types/game';

/* ════════════════════════════════════════════════════════
   레이저 엔진 — 계산(순수)과 렌더(캔버스)의 분리

   computeLaser(mapData)        : 순수 계산. BeamSegment 누적 + 셀별
                                  incidence(입사 방향/충족) 기록 + 승리 판정.
   drawSegments(ctx, segs, px)  : 세그먼트를 캔버스에 그리기만 한다.
   simulateLaser(ctx, canvas, m): 둘을 잇는 얇은 래퍼(기존 시그니처 유지).

   기물 동작은 데이터드리븐 레지스트리(REGISTRY)로 정의한다.
   그리드 크기는 mapData.length에서 유도한다(NxN).
   ════════════════════════════════════════════════════════ */

const DIRS: Record<number, { dx: number; dy: number }> = {
  0: { dx: 1, dy: 0 }, 45: { dx: 1, dy: 1 }, 90: { dx: 0, dy: 1 }, 135: { dx: -1, dy: 1 },
  180: { dx: -1, dy: 0 }, 225: { dx: -1, dy: -1 }, 270: { dx: 0, dy: -1 }, 315: { dx: 1, dy: -1 },
};

export function calculateReflection(inDir: number, surfaceAngle: number): number {
  return (2 * surfaceAngle - inDir + 720) % 360;
}

/* ── 결과 타입 ─────────────────────────────────────────── */

// 셀 인덱스 좌표계 세그먼트. partial=true 면 목적지 셀 경계(중간점)에서 멈춘다.
export interface BeamSegment {
  x1: number; y1: number;
  x2: number; y2: number;
  partial: boolean;
}

export interface CellIncidence {
  dirs: Set<number>;   // 이 셀로 들어온 빔 방향들
  satisfied: boolean;  // 표적 충족 여부
}

export interface LaserResult {
  segments: BeamSegment[];
  incidence: Map<string, CellIncidence>; // key: "x,y"
  targetsTotal: number;
  targetsHit: number;
  solved: boolean;
}

/* ── 기물 동작 레지스트리 ──────────────────────────────── */

interface BeamOutcome {
  partial?: boolean;    // 표면에서 차단(절반 길이만 그림)
  outDirs?: number[];   // 셀에서 이어 나가는 빔 방향들
  satisfied?: boolean;  // 표적 충족
}

interface PieceBehavior {
  isTarget?: boolean; // 승리 판정에 포함되는 필수 표적
  interact: (inDir: number, cell: CellData) => BeamOutcome;
}

const fullMirror = (saBase: number): PieceBehavior['interact'] =>
  (inDir, cell) => ({ outDirs: [calculateReflection(inDir, (saBase + cell.rotation) % 360)] });

const halfMirror = (saBase: number): PieceBehavior['interact'] =>
  (inDir, cell) => ({
    outDirs: [inDir, calculateReflection(inDir, (saBase + cell.rotation) % 360)],
  });

const oneSidedMirror = (normalBase: number, saBase: number): PieceBehavior['interact'] =>
  (inDir, cell) => {
    const normal = (normalBase + cell.rotation) % 360;
    const rel = (inDir - normal + 360) % 360;
    if (rel > 90 && rel < 270) {
      return { outDirs: [calculateReflection(inDir, (saBase + cell.rotation) % 360)] };
    }
    return { partial: true }; // 뒷면: 차단
  };

const absorb: PieceBehavior['interact'] = () => ({});

// 미지 타입(구버전 클라이언트 보호): 통과
const PASSIVE: PieceBehavior = { interact: (inDir) => ({ outDirs: [inDir] }) };

export const REGISTRY: Partial<Record<PieceType, PieceBehavior>> = {
  ray:    { interact: absorb },
  target: { isTarget: true, interact: () => ({ satisfied: true }) },
  block:  { interact: (inDir) => ({ outDirs: [inDir] }) }, // 기존 block은 통과
  tunnel: {
    interact: (inDir, cell) => {
      const tunnelRot = cell.rotation % 180;
      const passH = tunnelRot === 0 && (inDir === 90 || inDir === 270);
      const passV = tunnelRot === 90 && (inDir === 180 || inDir === 0);
      return passH || passV ? { outDirs: [inDir] } : { partial: true };
    },
  },
  mirror:          { interact: fullMirror(135) },
  half_mirror:     { interact: halfMirror(135) },
  mirror_45:       { interact: fullMirror(337.5) },
  half_mirror_45:  { interact: halfMirror(337.5) },
  single_mirror:   { interact: oneSidedMirror(225, 135) },
  target_mirror_a: { interact: oneSidedMirror(225, 135) },
  target_mirror_b: { interact: oneSidedMirror(225, 135) },
  diag_single_mirror_a: { interact: oneSidedMirror(112.5, 202.5) },
  diag_single_mirror_b: { interact: oneSidedMirror(67.5, 157.5) },
  v_mirror:        { interact: fullMirror(0) },
  v_half_mirror:   { interact: halfMirror(0) },
  v_single_mirror: { interact: oneSidedMirror(90, 0) },
  v_target_mirror_a: { interact: oneSidedMirror(270, 0) },
  v_target_mirror_b: { interact: oneSidedMirror(270, 0) },

  /* ── Group A: 무상태 기믹 기물 ──────────────────────── */

  // 일방터널: 화살표 방향(= ray 와 동일 규약, rotation+270)으로 진행하는 빔만 통과
  diode: {
    interact: (inDir, cell) =>
      inDir === (cell.rotation + 270) % 360 ? { outDirs: [inDir] } : { partial: true },
  },
  // 수직 양면거울: 정면 축 빔 180° 되돌림, 대각 빔은 v_mirror 와 같은 면각 반사, 평행 축은 차단
  v_mirror_double: {
    interact: (inDir, cell) => {
      const rel = (inDir - cell.rotation + 360) % 360;
      if (rel === 0 || rel === 180) return { outDirs: [(inDir + 180) % 360] };
      if (rel === 90 || rel === 270) return { partial: true };
      return { outDirs: [calculateReflection(inDir, cell.rotation % 360)] };
    },
  },
  // 수직 양면 반거울: 양면거울 + 통과 분기
  v_half_mirror_double: {
    interact: (inDir, cell) => {
      const rel = (inDir - cell.rotation + 360) % 360;
      if (rel === 0 || rel === 180) return { outDirs: [inDir, (inDir + 180) % 360] };
      if (rel === 90 || rel === 270) return { outDirs: [inDir] };
      return { outDirs: [inDir, calculateReflection(inDir, cell.rotation % 360)] };
    },
  },
  // 소형 표적: 정면 피격만 충족, 수직 축·대각은 통과, 뒷면은 차단
  small_target: {
    isTarget: true,
    interact: (inDir, cell) => {
      const rel = (inDir - cell.rotation + 360) % 360;
      if (rel === 90) return { satisfied: true };          // 정면 흡수+충족
      if (rel === 270) return { partial: true };           // 뒷면 차단
      if (rel === 0 || rel === 180) return { outDirs: [inDir] }; // 수직축 통과
      return { outDirs: [inDir] };                         // 대각 통과 (상급)
    },
  },
  // 전방위 표적: 어느 방향이든 흡수+충족
  omni_target: {
    isTarget: true,
    interact: () => ({ satisfied: true }),
  },
  // 높은 블럭: 빔 완전 차단 (기존 block 은 통과 — 별개 타입)
  high_block: { interact: () => ({ partial: true }) },
};

/* ── 순수 계산 ─────────────────────────────────────────── */

export function computeLaser(mapData: (CellData | null)[][]): LaserResult {
  const gridSize = mapData.length;
  const segments: BeamSegment[] = [];
  const incidence = new Map<string, CellIncidence>();

  function record(x: number, y: number, dir: number, satisfied: boolean): void {
    const key = `${x},${y}`;
    let inc = incidence.get(key);
    if (!inc) {
      inc = { dirs: new Set(), satisfied: false };
      incidence.set(key, inc);
    }
    inc.dirs.add(dir);
    if (satisfied) inc.satisfied = true;
  }

  const beams: { x: number; y: number; dir: number }[] = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cell = mapData[r][c];
      if (cell?.type === 'ray') {
        beams.push({ x: c, y: r, dir: (cell.rotation + 270) % 360 });
      }
    }
  }

  const visited = new Set<string>();

  while (beams.length > 0) {
    const { x: cx, y: cy, dir: cDir } = beams.shift()!;
    const dirVec = DIRS[cDir];
    const nextX = cx + dirVec.dx;
    const nextY = cy + dirVec.dy;

    if (nextX < 0 || nextX >= gridSize || nextY < 0 || nextY >= gridSize) {
      segments.push({ x1: cx, y1: cy, x2: nextX, y2: nextY, partial: true });
      continue;
    }

    const stateKey = `${nextX},${nextY},${cDir}`;
    if (visited.has(stateKey)) continue;
    visited.add(stateKey);

    const item = mapData[nextY][nextX];
    const outcome: BeamOutcome = item
      ? (REGISTRY[item.type] ?? PASSIVE).interact(cDir, item)
      : { outDirs: [cDir] };

    record(nextX, nextY, cDir, !!outcome.satisfied);
    segments.push({ x1: cx, y1: cy, x2: nextX, y2: nextY, partial: !!outcome.partial });

    for (const d of outcome.outDirs ?? []) {
      beams.push({ x: nextX, y: nextY, dir: d });
    }
  }

  // 승리 판정: 필수 표적 전부 충족
  let targetsTotal = 0;
  let targetsHit = 0;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cell = mapData[r][c];
      if (cell && REGISTRY[cell.type]?.isTarget) {
        targetsTotal++;
        if (incidence.get(`${c},${r}`)?.satisfied) targetsHit++;
      }
    }
  }

  return {
    segments,
    incidence,
    targetsTotal,
    targetsHit,
    solved: targetsTotal > 0 && targetsHit === targetsTotal,
  };
}

/* ── 렌더 ─────────────────────────────────────────────── */

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

export function drawSegments(
  ctx: CanvasRenderingContext2D,
  segments: BeamSegment[],
  cellSize: number,
): void {
  if (segments.length === 0) return;

  const laserColor =
    getComputedStyle(document.documentElement).getPropertyValue('--laser').trim() || '#ff3333';
  ctx.lineWidth = 4;
  ctx.strokeStyle = laserColor;
  ctx.lineCap = 'round';
  ctx.shadowBlur = 10;
  ctx.shadowColor = laserColor;

  const offset = cellSize / 2;
  for (const seg of segments) {
    const x1 = seg.x1 * cellSize + offset;
    const y1 = seg.y1 * cellSize + offset;
    let x2 = seg.x2 * cellSize + offset;
    let y2 = seg.y2 * cellSize + offset;
    if (seg.partial) {
      x2 = ((seg.x1 + seg.x2) / 2) * cellSize + offset;
      y2 = ((seg.y1 + seg.y2) / 2) * cellSize + offset;
    }
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

/* ── 래퍼 (기존 시그니처 유지) ─────────────────────────── */

export function simulateLaser(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  mapData: (CellData | null)[][],
): LaserResult {
  clearLaser(ctx, canvas);
  const result = computeLaser(mapData);
  const cellSize = (canvas.clientWidth || canvas.width) / mapData.length;
  drawSegments(ctx, result.segments, cellSize);
  return result;
}
