import type { CellData, PieceType } from '../types/game';

/* ════════════════════════════════════════════════════════
   레이저 엔진 — 계산(순수)과 렌더(캔버스)의 분리

   computeLaser(mapData)        : 순수 계산. BeamSegment 누적 + 셀별
                                  incidence(입사 방향/충족) 기록 + 승리 판정.
   drawSegments(ctx, segs, px)  : 세그먼트를 캔버스에 그리기만 한다.
   simulateLaser(ctx, canvas, m): 둘을 잇는 얇은 래퍼(기존 시그니처 유지).

   기물 동작은 면별(per-face) 선언 스키마 PieceBehaviorDef 로 정의하고
   buildBehavior() 가 interact 로 컴파일한다 (docs/ADMIN_PANEL.md).
   DEFAULT_DEFS = 코드 기본값. 어드민 config 오버라이드는
   setBehaviorOverrides() 로 주입된다 (src/lib/pieceConfig.ts).
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

/* ── 면별(per-face) 동작 선언 스키마 ───────────────────── */

export type FaceEffectKind = 'pass' | 'block' | 'absorb' | 'reflect' | 'split' | 'reverse';
//  pass    : 그대로 통과 (outDirs=[inDir])
//  block   : 표면 차단 (partial — 절반만 그림)
//  absorb  : 흡수 (빔 종료; 표적 흡수면)
//  reflect : 면각 반사 (calculateReflection(inDir, surfaceAngle+rotation))
//  split   : 반거울 (통과 + 반사 동시)
//  reverse : 180° 되돌림 (양면거울 정면축)

export interface FaceEffect {
  kind: FaceEffectKind;
  surfaceAngle?: number; // reflect/split 면각 (기물 기준 — rotation 이 더해진다)
  satisfy?: boolean;     // 표적 충족 — 모든 kind 와 겸용 (reflect+satisfy=표적거울 등)
}

// 조건부 기물의 면은 활성(open)/비활성(closed) 두 상태 효과를 가질 수 있다.
export type FaceSpec = FaceEffect | { open: FaceEffect; closed: FaceEffect };

// 조건부 활성 판정 — 직전 패스의 입사면(rel) 집합 기준.
//  groups: 각 그룹에서 ≥1 면 피격(any) 이고 모든 그룹 충족(all) 시 활성.
//          예) transistor [[270]] / cross_gate [[0,180],[90,270]] (H AND V)
//  negate: true 면 반대로, 나열된 면 전부 미피격일 때 활성 (반전 프로젝터).
export interface ConditionalDef {
  init: boolean;
  groups: number[][];
  negate?: boolean;
}

export interface PieceBehaviorDef {
  faces: Partial<Record<number, FaceSpec>>; // relDir(45 단위) → 효과
  fallback: FaceSpec;                       // 미지정 방향
  rotationStep: 45 | 90;
  conditional?: ConditionalDef;
  emit?: { fromRel: number; whenActive: boolean }; // 프로젝터 사출 (rotation+fromRel 방향)
  // isTarget 은 faces/fallback 중 satisfy:true 존재 시 자동 파생 — 별도 플래그 없음
}

/* ── def → 동작 컴파일 ─────────────────────────────────── */

interface BeamOutcome {
  partial?: boolean;    // 표면에서 차단(절반 길이만 그림)
  outDirs?: number[];   // 셀에서 이어 나가는 빔 방향들
  satisfied?: boolean;  // 표적 충족
}

interface PieceBehavior {
  isTarget: boolean;
  conditional?: { init: boolean; resolve: (relDirs: Set<number>) => boolean };
  emit?: { fromRel: number; whenActive: boolean };
  interact: (inDir: number, cell: CellData, active?: boolean) => BeamOutcome;
}

// 기물 기준 상대각: rel = (inDir - rotation + 360) % 360
function relDir(inDir: number, rotation: number): number {
  return (inDir - rotation + 360) % 360;
}

function isDualFace(spec: FaceSpec): spec is { open: FaceEffect; closed: FaceEffect } {
  return 'open' in spec && 'closed' in spec;
}

function resolveFace(spec: FaceSpec, active: boolean | undefined): FaceEffect {
  return isDualFace(spec) ? (active ? spec.open : spec.closed) : spec;
}

function faceHasSatisfy(spec: FaceSpec): boolean {
  return isDualFace(spec)
    ? !!spec.open.satisfy || !!spec.closed.satisfy
    : !!spec.satisfy;
}

function applyEffect(fx: FaceEffect, inDir: number, rotation: number): BeamOutcome {
  const sa = ((fx.surfaceAngle ?? 0) + rotation) % 360;
  switch (fx.kind) {
    case 'pass':    return { outDirs: [inDir], satisfied: fx.satisfy };
    case 'reverse': return { outDirs: [(inDir + 180) % 360], satisfied: fx.satisfy };
    case 'reflect': return { outDirs: [calculateReflection(inDir, sa)], satisfied: fx.satisfy };
    case 'split':   return { outDirs: [inDir, calculateReflection(inDir, sa)], satisfied: fx.satisfy };
    case 'absorb':  return { satisfied: fx.satisfy };
    case 'block':
    default:        return { partial: true, satisfied: fx.satisfy };
  }
}

export function buildBehavior(def: PieceBehaviorDef): PieceBehavior {
  const isTarget =
    Object.values(def.faces).some(spec => spec && faceHasSatisfy(spec))
    || faceHasSatisfy(def.fallback);

  const conditional = def.conditional && {
    init: def.conditional.init,
    resolve: (rels: Set<number>): boolean => {
      const c = def.conditional!;
      if (c.negate) return !c.groups.flat().some(f => rels.has(f));
      return c.groups.every(g => g.some(f => rels.has(f)));
    },
  };

  return {
    isTarget,
    conditional,
    emit: def.emit,
    interact: (inDir, cell, active) => {
      const rel = relDir(inDir, cell.rotation);
      const spec = def.faces[rel] ?? def.fallback;
      return applyEffect(resolveFace(spec, active), inDir, cell.rotation);
    },
  };
}

/* ── 코드 기본 def 테이블 ──────────────────────────────── */

const fx = (kind: FaceEffectKind, surfaceAngle?: number, satisfy?: boolean): FaceEffect =>
  ({ kind, ...(surfaceAngle !== undefined && { surfaceAngle }), ...(satisfy && { satisfy }) });

// 조건부 게이트 공용: 열림=통과 / 닫힘=차단
const gated = { open: fx('pass'), closed: fx('block') } as const;

export const DEFAULT_DEFS: Record<PieceType, PieceBehaviorDef> = {
  // 발사기: 소스 기물(trace 가 type==='ray' 로 빔 생성). 입사 빔은 흡수.
  ray: { faces: {}, fallback: fx('absorb'), rotationStep: 90 },

  // 표적: 정면(rel 90)만 충족, 그 외 면 흡수
  target: {
    faces: { 90: fx('absorb', undefined, true) },
    fallback: fx('absorb'),
    rotationStep: 90,
  },

  block: { faces: {}, fallback: fx('pass'), rotationStep: 90 },   // 기존 block 은 통과

  // 터널: 통과축(rel 90/270)만 통과, 그 외 차단
  tunnel: {
    faces: { 90: fx('pass'), 270: fx('pass') },
    fallback: fx('block'),
    rotationStep: 90,
  },

  mirror:         { faces: {}, fallback: fx('reflect', 135), rotationStep: 90 },
  half_mirror:    { faces: {}, fallback: fx('split', 135), rotationStep: 90 },
  mirror_45:      { faces: {}, fallback: fx('reflect', 337.5), rotationStep: 45 },
  half_mirror_45: { faces: {}, fallback: fx('split', 337.5), rotationStep: 45 },

  // 단면거울류: 반사면(rel 집합)만 반사, 뒷면 차단
  // (rel 집합 = 기존 oneSidedMirror(normalBase) 의 전면 범위 (90,270) 를 이산화)
  single_mirror: {
    faces: { 0: fx('reflect', 135), 45: fx('reflect', 135), 90: fx('reflect', 135) },
    fallback: fx('block'),
    rotationStep: 90,
  },
  target_mirror_a: {
    faces: { 0: fx('reflect', 135), 45: fx('reflect', 135), 90: fx('reflect', 135) },
    fallback: fx('block'),
    rotationStep: 90,
  },
  target_mirror_b: {
    faces: { 0: fx('reflect', 135), 45: fx('reflect', 135), 90: fx('reflect', 135) },
    fallback: fx('block'),
    rotationStep: 90,
  },
  diag_single_mirror_a: {
    faces: { 225: fx('reflect', 202.5), 270: fx('reflect', 202.5), 315: fx('reflect', 202.5), 0: fx('reflect', 202.5) },
    fallback: fx('block'),
    rotationStep: 90,
  },
  diag_single_mirror_b: {
    faces: { 180: fx('reflect', 157.5), 225: fx('reflect', 157.5), 270: fx('reflect', 157.5), 315: fx('reflect', 157.5) },
    fallback: fx('block'),
    rotationStep: 90,
  },
  v_mirror:      { faces: {}, fallback: fx('reflect', 0), rotationStep: 90 },
  v_half_mirror: { faces: {}, fallback: fx('split', 0), rotationStep: 90 },
  v_single_mirror: {
    faces: { 225: fx('reflect', 0), 270: fx('reflect', 0), 315: fx('reflect', 0) },
    fallback: fx('block'),
    rotationStep: 90,
  },
  v_target_mirror_a: {
    faces: { 45: fx('reflect', 0), 90: fx('reflect', 0), 135: fx('reflect', 0) },
    fallback: fx('block'),
    rotationStep: 90,
  },
  v_target_mirror_b: {
    faces: { 45: fx('reflect', 0), 90: fx('reflect', 0), 135: fx('reflect', 0) },
    fallback: fx('block'),
    rotationStep: 90,
  },

  /* ── Group A: 무상태 기믹 기물 ──────────────────────── */

  // 일방터널: 화살표 방향(rel 270)으로 진행하는 빔만 통과
  diode: {
    faces: { 270: fx('pass') },
    fallback: fx('block'),
    rotationStep: 90,
  },
  // 수직 양면거울: 정면 축 되돌림, 평행 축 차단, 대각은 면각 반사
  v_mirror_double: {
    faces: { 0: fx('reverse'), 180: fx('reverse'), 90: fx('block'), 270: fx('block') },
    fallback: fx('reflect', 0),
    rotationStep: 90,
  },
  // 수직 양면 반거울: 정면 축 통과+되돌림(split 90 ≡ reverse 분기), 평행 축 통과, 대각 split
  v_half_mirror_double: {
    faces: { 0: fx('split', 90), 180: fx('split', 90), 90: fx('pass'), 270: fx('pass') },
    fallback: fx('split', 0),
    rotationStep: 90,
  },
  // 소형 표적: 정면 충족, 뒷면 차단, 수직축·대각 통과
  small_target: {
    faces: { 90: fx('absorb', undefined, true), 270: fx('block'), 0: fx('pass'), 180: fx('pass') },
    fallback: fx('pass'),
    rotationStep: 90,
  },
  // 전방위 표적: 어느 방향이든 흡수+충족
  omni_target: {
    faces: {},
    fallback: fx('absorb', undefined, true),
    rotationStep: 90,
  },
  // 높은 블럭: 완전 차단
  high_block: { faces: {}, fallback: fx('block'), rotationStep: 90 },

  /* ── Group B: 조건부/상태형 기믹 기물 (고정점 루프) ──── */

  // 관문: 아래(rel 270) 피격 시 좌우 축(rel 0/180) 개방
  transistor_gate: {
    faces: { 270: fx('absorb'), 0: gated, 180: gated },
    fallback: fx('block'),
    rotationStep: 90,
    conditional: { init: false, groups: [[270]] },
  },
  // 교차 관문: H·V 둘 다 있어야 둘 다 통과 (AND)
  cross_gate: {
    faces: { 0: gated, 90: gated, 180: gated, 270: gated },
    fallback: fx('block'),
    rotationStep: 90,
    conditional: { init: false, groups: [[0, 180], [90, 270]] },
  },
  // 우선순위 관문: 양 축 동시(=활성)면 직선축(0/180)만, 단독이면 그대로 통과
  priority_gate: {
    faces: {
      0: fx('pass'), 180: fx('pass'),
      90: { open: fx('block'), closed: fx('pass') },
      270: { open: fx('block'), closed: fx('pass') },
    },
    fallback: fx('block'),
    rotationStep: 90,
    conditional: { init: false, groups: [[0, 180], [90, 270]] },
  },
  // 표적 프로젝터(광집기): 측면(rel 0/180) 피격 시 충족 + 정면 발사
  target_projector: {
    faces: { 0: fx('absorb', undefined, true), 180: fx('absorb', undefined, true) },
    fallback: fx('block'),
    rotationStep: 90,
    conditional: { init: false, groups: [[0, 180]] },
    emit: { fromRel: 270, whenActive: true },
  },
  // 반전 프로젝터(가변추출기): 기본 발사, 측후면(rel 0/180/270) 피격 시 소등
  inverting_projector: {
    faces: { 0: fx('absorb'), 180: fx('absorb'), 270: fx('absorb') },
    fallback: fx('block'),
    rotationStep: 90,
    conditional: { init: true, groups: [[0, 180, 270]], negate: true },
    emit: { fromRel: 270, whenActive: true },
  },
};

/* ── 접근자 + 오버라이드 레이어 ────────────────────────── */

// 미지 타입(구버전 클라이언트 보호): 통과
const PASSIVE: PieceBehavior = {
  isTarget: false,
  interact: (inDir) => ({ outDirs: [inDir] }),
};

let overrideDefs: Partial<Record<string, PieceBehaviorDef>> = {};
let behaviorCache = new Map<string, PieceBehavior>();

// 어드민 config 오버라이드 주입 (pieceConfig.ts 가 호출). 캐시 무효화 포함.
export function setBehaviorOverrides(defs: Partial<Record<string, PieceBehaviorDef>>): void {
  overrideDefs = defs;
  behaviorCache = new Map();
}

export function getBehaviorDef(type: string): PieceBehaviorDef | undefined {
  return overrideDefs[type] ?? (DEFAULT_DEFS as Partial<Record<string, PieceBehaviorDef>>)[type];
}

export function getBehavior(type: string): PieceBehavior {
  let b = behaviorCache.get(type);
  if (!b) {
    const def = getBehaviorDef(type);
    b = def ? buildBehavior(def) : PASSIVE;
    behaviorCache.set(type, b);
  }
  return b;
}

// 엔진 isTarget 판정과 UI 통계를 일치시키기 위한 헬퍼
export function isTargetType(type: string): boolean {
  return getBehavior(type).isTarget;
}

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

  // 빔 소스: 발사기 + 사출 조건을 만족한 프로젝터
  const beams: { x: number; y: number; dir: number }[] = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cell = mapData[r][c];
      if (!cell) continue;
      if (cell.type === 'ray') {
        beams.push({ x: c, y: r, dir: (cell.rotation + 270) % 360 });
        continue;
      }
      const emit = getBehavior(cell.type).emit;
      if (emit && (states.get(`${c},${r}`) ?? false) === emit.whenActive) {
        beams.push({ x: c, y: r, dir: (cell.rotation + emit.fromRel) % 360 });
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
      ? getBehavior(item.type).interact(cDir, item, states.get(`${nextX},${nextY}`))
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
      const behavior = cell ? getBehavior(cell.type) : undefined;
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
      if (cell && getBehavior(cell.type).isTarget) {
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
