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
  // 조건부(상태형) 기물: 고정점 루프가 incidence 기반으로 활성 상태를 재평가한다.
  // resolve 는 직전 패스의 입사 방향(기물 기준 상대각 집합)만 본다 → 큐 순서 무관, 결정적.
  conditional?: {
    init: boolean;
    resolve: (relDirs: Set<number>) => boolean;
  };
  emits?: boolean; // 활성 상태에서 (rotation+270)% 방향으로 빔 발사
  interact: (inDir: number, cell: CellData, active?: boolean) => BeamOutcome;
}

// 기물 기준 상대각: rel = (inDir - rotation + 360) % 360
function relDir(inDir: number, rotation: number): number {
  return (inDir - rotation + 360) % 360;
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

  /* ── Group B: 조건부/상태형 기믹 기물 (고정점 루프 필요) ── */

  // 관문: 아래(제어축, rel 270) 피격 시 좌우(수직축, rel 0/180) 통과 개방
  transistor_gate: {
    conditional: {
      init: false,
      resolve: (rels) => rels.has(270),
    },
    interact: (inDir, cell, active) => {
      const rel = relDir(inDir, cell.rotation);
      if (rel === 270) return {};                          // 제어 빔 흡수
      if (rel === 0 || rel === 180) {
        return active ? { outDirs: [inDir] } : { partial: true };
      }
      return { partial: true };                            // 위/대각 차단
    },
  },
  // 교차 관문: H·V 둘 다 있어야 둘 다 통과 (AND)
  cross_gate: {
    conditional: {
      init: false,
      resolve: (rels) =>
        (rels.has(0) || rels.has(180)) && (rels.has(90) || rels.has(270)),
    },
    interact: (inDir, cell, active) => {
      const rel = relDir(inDir, cell.rotation);
      if (rel % 90 !== 0) return { partial: true };        // 대각 차단
      return active ? { outDirs: [inDir] } : { partial: true };
    },
  },
  // 우선순위 관문: 둘 다 오면 직선축(rel 0/180)만 통과, 하나만 오면 그대로 통과
  priority_gate: {
    conditional: {
      init: false, // active = "양 축 동시 입사" 상태
      resolve: (rels) =>
        (rels.has(0) || rels.has(180)) && (rels.has(90) || rels.has(270)),
    },
    interact: (inDir, cell, active) => {
      const rel = relDir(inDir, cell.rotation);
      if (rel % 90 !== 0) return { partial: true };        // 대각 차단
      if (!active) return { outDirs: [inDir] };            // 단독 축은 통과
      return rel === 0 || rel === 180 ? { outDirs: [inDir] } : { partial: true };
    },
  },
  // 표적 프로젝터(광집기): 측면(rel 0/180) 피격 시에만 정면으로 발사 + 충족
  target_projector: {
    isTarget: true,
    emits: true,
    conditional: {
      init: false,
      resolve: (rels) => rels.has(0) || rels.has(180),
    },
    interact: (inDir, cell) => {
      const rel = relDir(inDir, cell.rotation);
      if (rel === 0 || rel === 180) return { satisfied: true }; // 측면 흡수 + 충족
      return { partial: true };                                  // 그 외 차단
    },
  },
  // 반전 프로젝터(가변추출기): 기본 발사, 다른 3면(rel 0/180/270) 피격 시 꺼짐
  inverting_projector: {
    emits: true,
    conditional: {
      init: true,
      resolve: (rels) => !(rels.has(0) || rels.has(180) || rels.has(270)),
    },
    interact: (inDir, cell) => {
      const rel = relDir(inDir, cell.rotation);
      if (rel === 0 || rel === 180 || rel === 270) return {};    // 흡수 (소등 제어)
      return { partial: true };                                  // 정면/대각 차단
    },
  },
};

/* ── 순수 계산 (고정점 루프) ───────────────────────────── */

const MAX_ITERS = 8;

interface TraceResult {
  segments: BeamSegment[];
  incidence: Map<string, CellIncidence>;
}

// 주어진 조건부 상태(states)로 전체 빔을 1패스 추적한다.
function trace(
  mapData: (CellData | null)[][],
  states: Map<string, boolean>,
): TraceResult {
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

  // 빔 소스: 발사기 + 활성 상태의 프로젝터
  const beams: { x: number; y: number; dir: number }[] = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cell = mapData[r][c];
      if (!cell) continue;
      if (cell.type === 'ray') {
        beams.push({ x: c, y: r, dir: (cell.rotation + 270) % 360 });
      } else if (REGISTRY[cell.type]?.emits && states.get(`${c},${r}`)) {
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
      ? (REGISTRY[item.type] ?? PASSIVE).interact(cDir, item, states.get(`${nextX},${nextY}`))
      : { outDirs: [cDir] };

    record(nextX, nextY, cDir, !!outcome.satisfied);
    segments.push({ x1: cx, y1: cy, x2: nextX, y2: nextY, partial: !!outcome.partial });

    for (const d of outcome.outDirs ?? []) {
      beams.push({ x: nextX, y: nextY, dir: d });
    }
  }

  return { segments, incidence };
}

export function computeLaser(mapData: (CellData | null)[][]): LaserResult {
  const gridSize = mapData.length;

  // 조건부 기물 수집 + 초기 상태
  const conditionals: { key: string; cell: CellData; behavior: PieceBehavior }[] = [];
  let states = new Map<string, boolean>();
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cell = mapData[r][c];
      const behavior = cell ? REGISTRY[cell.type] : undefined;
      if (cell && behavior?.conditional) {
        const key = `${c},${r}`;
        conditionals.push({ key, cell, behavior });
        states.set(key, behavior.conditional.init);
      }
    }
  }

  // 고정점 반복: 직전 패스의 incidence 로 상태 재평가, 수렴 시 종료.
  // MAX_ITERS 내 미수렴(진동)이면 전부 OFF 강제 후 최종 1패스 → 결정적 종결.
  let result = trace(mapData, states);
  if (conditionals.length > 0) {
    let converged = false;
    for (let iter = 0; iter < MAX_ITERS; iter++) {
      const next = new Map<string, boolean>();
      for (const { key, cell, behavior } of conditionals) {
        const dirs = result.incidence.get(key)?.dirs ?? new Set<number>();
        const rels = new Set<number>();
        for (const d of dirs) rels.add(relDir(d, cell.rotation));
        next.set(key, behavior.conditional!.resolve(rels));
      }
      let same = true;
      for (const [k, v] of next) {
        if (states.get(k) !== v) { same = false; break; }
      }
      if (same) { converged = true; break; }
      states = next;
      result = trace(mapData, states);
    }
    if (!converged) {
      states = new Map([...states.keys()].map(k => [k, false]));
      result = trace(mapData, states);
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
        if (result.incidence.get(`${c},${r}`)?.satisfied) targetsHit++;
      }
    }
  }

  return {
    segments: result.segments,
    incidence: result.incidence,
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
