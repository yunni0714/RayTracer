import type { PieceType } from '../types/game';
import {
  DEFAULT_DEFS, setBehaviorOverrides,
  type PieceBehaviorDef, type FaceSpec, type FaceEffect, type FaceEffectKind,
} from './laserEngine';
import { setSvgOverrides } from './svgArt';
import { setLabelOverrides } from './pieceActions';

/* ════════════════════════════════════════════════════════
   기물 config 오버레이 — Firestore `config/pieces` 문서를
   코드 기본값 위에 머지한다 (docs/ADMIN_PANEL.md).

   - config 미존재/손상 → 코드 기본값 100% 보존 (silent fallback).
   - applyPieceConfig(raw) 는 순수(네트워크 없음) — 테스트/어드민 즉시반영 공용.
   - 적용 후 UI 갱신은 호출자가 store.bumpPieceConfigRev() 로 트리거.
   ════════════════════════════════════════════════════════ */

export type PieceTab = 'basic' | 'intermediate' | 'advanced';

export interface PieceDefaults {
  canRotate: boolean;
  canMove: boolean;
  isInventory: boolean;
}

export interface PieceConfigEntry {
  svg?: string;
  labelKo?: string;
  tab?: PieceTab;
  defaults?: Partial<PieceDefaults>;
  behavior?: PieceBehaviorDef;
}

export interface PieceConfigDoc {
  version: number;
  pieces: Partial<Record<string, PieceConfigEntry>>;
}

/* ── 커스텀 타입 (config-only 기물) ─────────────────────── */

const BUILTIN_TYPES: ReadonlySet<string> = new Set(Object.keys(DEFAULT_DEFS));
const CUSTOM_ID_RE = /^[a-z0-9_]+$/;
const CUSTOM_ID_MAX = 32;

// 커스텀 기물 id 검증: slug 형식, 길이 제한, 빌트인과 충돌 금지.
export function isValidCustomTypeId(id: string): boolean {
  return id.length > 0 && id.length <= CUSTOM_ID_MAX && CUSTOM_ID_RE.test(id) && !BUILTIN_TYPES.has(id);
}

let customTypes: string[] = [];

// 현재 config 가 등록한 커스텀 타입 목록 (팔레트/어드민이 빌트인과 합쳐 렌더)
export function getCustomTypes(): string[] {
  return [...customTypes];
}

/* ── 팔레트 탭 기본값 (표시 순서 보존) ──────────────────── */

const BASIC: PieceType[] = ['ray', 'target', 'mirror', 'half_mirror', 'block', 'tunnel', 'single_mirror', 'target_mirror_a', 'target_mirror_b'];
const INTERMEDIATE: PieceType[] = [
  'diode', 'v_mirror_double', 'v_half_mirror_double', 'small_target', 'omni_target', 'high_block',
  'transistor_gate', 'cross_gate', 'priority_gate', 'target_projector', 'inverting_projector',
];
const ADVANCED: PieceType[] = ['mirror_45', 'half_mirror_45', 'diag_single_mirror_a', 'diag_single_mirror_b', 'v_mirror', 'v_half_mirror', 'v_single_mirror', 'v_target_mirror_a', 'v_target_mirror_b'];

// 팔레트 표시 순서(탭 오버라이드 시에도 이 상대 순서 유지)
export const PALETTE_ORDER: PieceType[] = [...BASIC, ...INTERMEDIATE, ...ADVANCED];

const DEFAULT_TABS: Record<PieceType, PieceTab> = Object.fromEntries([
  ...BASIC.map(t => [t, 'basic']),
  ...INTERMEDIATE.map(t => [t, 'intermediate']),
  ...ADVANCED.map(t => [t, 'advanced']),
]) as Record<PieceType, PieceTab>;

const DEFAULT_PIECE_DEFAULTS: PieceDefaults = { canRotate: false, canMove: false, isInventory: false };

/* ── 오버라이드 상태 (모듈 캐시) ────────────────────────── */

let tabOverrides: Partial<Record<string, PieceTab>> = {};
let defaultsOverrides: Partial<Record<string, Partial<PieceDefaults>>> = {};
let rawEntries: Partial<Record<string, PieceConfigEntry>> = {};

export function getPieceTab(type: string): PieceTab {
  return tabOverrides[type] ?? (DEFAULT_TABS as Partial<Record<string, PieceTab>>)[type] ?? 'intermediate';
}

export function getPieceDefaults(type: string): PieceDefaults {
  const merged = { ...DEFAULT_PIECE_DEFAULTS, ...defaultsOverrides[type] };
  // canMove 는 isInventory(유저지급)에 종속한다 — 유저지급 기물만 플레이 중 이동 가능.
  return { ...merged, canMove: merged.isInventory };
}

// 어드민 에디터용: 현재 적용된 raw 오버라이드 엔트리
export function getPieceConfigEntry(type: string): PieceConfigEntry | undefined {
  return rawEntries[type];
}

// 어드민 에디터용: 전체 오버라이드 스냅샷 (저장 후 로컬 즉시반영에 사용)
export function getAllConfigEntries(): Partial<Record<string, PieceConfigEntry>> {
  return { ...rawEntries };
}

/* ── 검증 ───────────────────────────────────────────────── */

const KINDS: FaceEffectKind[] = ['pass', 'block', 'absorb', 'reflect', 'split', 'reverse'];
const TABS: PieceTab[] = ['basic', 'intermediate', 'advanced'];

function isFaceEffect(v: unknown): v is FaceEffect {
  if (!v || typeof v !== 'object') return false;
  const e = v as FaceEffect;
  return KINDS.includes(e.kind)
    && (e.surfaceAngle === undefined || typeof e.surfaceAngle === 'number')
    && (e.satisfy === undefined || typeof e.satisfy === 'boolean');
}

function isFaceSpec(v: unknown): v is FaceSpec {
  if (!v || typeof v !== 'object') return false;
  if ('open' in v || 'closed' in v) {
    const d = v as { open?: unknown; closed?: unknown };
    return isFaceEffect(d.open) && isFaceEffect(d.closed);
  }
  return isFaceEffect(v);
}

function isValidDef(v: unknown): v is PieceBehaviorDef {
  if (!v || typeof v !== 'object') return false;
  const d = v as PieceBehaviorDef;
  if (!isFaceSpec(d.fallback)) return false;
  if (d.rotationStep !== 45 && d.rotationStep !== 90) return false;
  if (!d.faces || typeof d.faces !== 'object') return false;
  for (const [k, spec] of Object.entries(d.faces)) {
    const rel = Number(k);
    if (!Number.isFinite(rel) || rel % 45 !== 0 || rel < 0 || rel >= 360) return false;
    if (!isFaceSpec(spec)) return false;
  }
  if (d.conditional !== undefined) {
    const c = d.conditional;
    if (typeof c.init !== 'boolean' || !Array.isArray(c.groups)) return false;
    if (!c.groups.every(g => Array.isArray(g) && g.every(f => typeof f === 'number'))) return false;
  }
  if (d.emit !== undefined) {
    if (typeof d.emit.fromRel !== 'number' || typeof d.emit.whenActive !== 'boolean') return false;
  }
  return true;
}

// SVG 새니타이즈 — config 의 SVG 는 전 플레이어에게 innerHTML 로 렌더되므로
// 실행 가능한 요소/속성을 제거한다 (저장형 XSS 방어, 심층 방어).
// 정규식 기반 스크러버: script/foreignObject 제거, on* 핸들러·javascript: URI 제거.
export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*script\b[^>]*\/?>/gi, '')
    .replace(/<\s*foreignObject[\s\S]*?<\s*\/\s*foreignObject\s*>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|xlink:href)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '')
    .replace(/javascript:/gi, '');
}

function sanitizeEntry(raw: unknown): PieceConfigEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as PieceConfigEntry;
  const out: PieceConfigEntry = {};
  if (typeof e.svg === 'string') {
    const cleaned = sanitizeSvg(e.svg);
    if (cleaned.trim().startsWith('<svg')) out.svg = cleaned;
  }
  if (typeof e.labelKo === 'string' && e.labelKo.trim()) out.labelKo = e.labelKo.trim();
  if (e.tab && TABS.includes(e.tab)) out.tab = e.tab;
  if (e.defaults && typeof e.defaults === 'object') {
    const d: Partial<PieceDefaults> = {};
    for (const k of ['canRotate', 'canMove', 'isInventory'] as const) {
      if (typeof e.defaults[k] === 'boolean') d[k] = e.defaults[k];
    }
    if (Object.keys(d).length > 0) out.defaults = d;
  }
  if (e.behavior !== undefined) {
    if (!isValidDef(e.behavior)) return null; // behavior 가 손상되면 엔트리 통째로 무시
    out.behavior = e.behavior;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/* ── 적용 / 리셋 ────────────────────────────────────────── */

export interface ApplyResult {
  applied: string[];
  skipped: string[];
}

// config 문서(파싱된 JSON)를 검증 후 오버레이로 적용. 순수 — 네트워크 없음.
// 빌트인 = 코드 기본값 위 머지. 커스텀 = config-only — behavior+svg 둘 다 있어야 등록
// (둘 중 하나라도 없으면 렌더/엔진이 받아줄 수 없으므로 skip).
export function applyPieceConfig(raw: unknown): ApplyResult {
  const applied: string[] = [];
  const skipped: string[] = [];

  const behaviorDefs: Partial<Record<string, PieceBehaviorDef>> = {};
  const svgs: Partial<Record<string, string>> = {};
  const labels: Partial<Record<string, string>> = {};
  const tabs: Partial<Record<string, PieceTab>> = {};
  const defaults: Partial<Record<string, Partial<PieceDefaults>>> = {};
  const entries: Partial<Record<string, PieceConfigEntry>> = {};
  const customs: string[] = [];

  const pieces = (raw as PieceConfigDoc | null)?.pieces;
  if (pieces && typeof pieces === 'object') {
    for (const [type, rawEntry] of Object.entries(pieces)) {
      const isBuiltin = BUILTIN_TYPES.has(type);
      if (!isBuiltin && !isValidCustomTypeId(type)) { skipped.push(type); continue; }
      const entry = sanitizeEntry(rawEntry);
      if (!entry) { skipped.push(type); continue; }
      if (!isBuiltin && !(entry.behavior && entry.svg)) { skipped.push(type); continue; }
      entries[type] = entry;
      if (entry.behavior) behaviorDefs[type] = entry.behavior;
      if (entry.svg) svgs[type] = entry.svg;
      if (entry.labelKo) labels[type] = entry.labelKo;
      if (entry.tab) tabs[type] = entry.tab;
      if (entry.defaults) defaults[type] = entry.defaults;
      if (!isBuiltin) customs.push(type);
      applied.push(type);
    }
  }

  setBehaviorOverrides(behaviorDefs);
  setSvgOverrides(svgs);
  setLabelOverrides(labels);
  tabOverrides = tabs;
  defaultsOverrides = defaults;
  rawEntries = entries;
  customTypes = customs;

  return { applied, skipped };
}

export function resetPieceConfig(): void {
  setBehaviorOverrides({});
  setSvgOverrides({});
  setLabelOverrides({});
  tabOverrides = {};
  defaultsOverrides = {};
  rawEntries = {};
  customTypes = [];
}

// 부팅 시 1회 호출 (App.tsx). 실패해도 코드 기본값으로 동작 — 절대 throw 하지 않는다.
export async function loadPieceConfig(): Promise<ApplyResult | null> {
  try {
    const { fetchPieceConfig } = await import('./firebaseService');
    const doc = await fetchPieceConfig();
    if (!doc) return null;
    return applyPieceConfig(doc);
  } catch {
    return null;
  }
}
