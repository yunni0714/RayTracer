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
  tab?: PieceTab;        // 레거시 — folderId 가 없으면 folderId 로 읽는다 (하위호환)
  folderId?: string;     // 팔레트 폴더 (tab 대체)
  hidden?: boolean;      // 빌트인 "삭제" = 팔레트에서 숨김 (코드 정의는 못 지움)
  defaults?: Partial<PieceDefaults>;
  behavior?: PieceBehaviorDef;
}

export interface PieceFolder {
  id: string;
  name: string;
  order: number;
}

export interface PieceConfigDoc {
  version: number;
  folders?: PieceFolder[]; // 없으면 기본 3폴더 (하위호환)
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

let hiddenTypes: ReadonlySet<string> = new Set();

// 팔레트 숨김 여부 (빌트인 "삭제"). 맵에 이미 놓인 기물 동작에는 영향 없음.
export function isPieceHidden(type: string): boolean {
  return hiddenTypes.has(type);
}

/* ── 팔레트 탭 기본값 (표시 순서 보존) ──────────────────── */

const BASIC: PieceType[] = ['ray', 'target', 'mirror', 'half_mirror', 'block', 'tunnel', 'single_mirror', 'target_mirror_a', 'target_mirror_b'];
const INTERMEDIATE: PieceType[] = [
  'diode', 'v_mirror_double', 'v_half_mirror_double', 'small_target', 'omni_target', 'high_block',
  'transistor_gate', 'cross_gate', 'priority_gate', 'target_projector', 'inverting_projector',
];
// 팔레트 은퇴 기물(maker 결정): diag_single_mirror_a/b, v_target_mirror_a/b,
// v_mirror(중급 수직 양면거울과 중복). 엔진 def/SVG/라벨은 유지 — 기존 맵 호환.
const ADVANCED: PieceType[] = ['mirror_45', 'half_mirror_45', 'v_half_mirror', 'v_single_mirror'];

// 팔레트 표시 순서(탭 오버라이드 시에도 이 상대 순서 유지)
export const PALETTE_ORDER: PieceType[] = [...BASIC, ...INTERMEDIATE, ...ADVANCED];

const DEFAULT_TABS: Record<PieceType, PieceTab> = Object.fromEntries([
  ...BASIC.map(t => [t, 'basic']),
  ...INTERMEDIATE.map(t => [t, 'intermediate']),
  ...ADVANCED.map(t => [t, 'advanced']),
]) as Record<PieceType, PieceTab>;

const DEFAULT_PIECE_DEFAULTS: PieceDefaults = { canRotate: false, canMove: false, isInventory: false };

/* ── 오버라이드 상태 (모듈 캐시) ────────────────────────── */

let folderOverrides: Partial<Record<string, string>> = {};
let configFolders: PieceFolder[] | null = null;
let defaultsOverrides: Partial<Record<string, Partial<PieceDefaults>>> = {};
let rawEntries: Partial<Record<string, PieceConfigEntry>> = {};

/* ── 폴더 ───────────────────────────────────────────────── */

// 기본 3폴더 — config 에 folders 없을 때 + 항상 존재 보장 (삭제 시 재생성)
export const DEFAULT_FOLDERS: readonly PieceFolder[] = [
  { id: 'basic', name: '초급', order: 0 },
  { id: 'intermediate', name: '중급', order: 1 },
  { id: 'advanced', name: '상급', order: 2 },
];

const FOLDER_ID_RE = /^[a-z0-9_]+$/;
const FOLDER_ID_MAX = 48;

export function isValidFolderId(id: string): boolean {
  return id.length > 0 && id.length <= FOLDER_ID_MAX && FOLDER_ID_RE.test(id);
}

// order 순 정렬된 폴더 목록. 기본 3폴더는 config 가 빠뜨려도 항상 포함.
export function getFolders(): PieceFolder[] {
  const list = configFolders ? configFolders.map(f => ({ ...f })) : DEFAULT_FOLDERS.map(f => ({ ...f }));
  for (const def of DEFAULT_FOLDERS) {
    if (!list.some(f => f.id === def.id)) list.push({ ...def });
  }
  return list.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function getPieceFolder(type: string): string {
  return folderOverrides[type] ?? (DEFAULT_TABS as Partial<Record<string, PieceTab>>)[type] ?? 'intermediate';
}

// 레거시 접근자 — 폴더가 기본 3종 밖이면 'intermediate' 로 수렴.
export function getPieceTab(type: string): PieceTab {
  const f = getPieceFolder(type);
  return (TABS as string[]).includes(f) ? (f as PieceTab) : 'intermediate';
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

// config 의 folders 배열 검증 — 유효 항목만 통과, 비면 null (기본 3폴더 사용).
function sanitizeFolders(raw: unknown): PieceFolder[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: PieceFolder[] = [];
  for (const f of raw) {
    if (!f || typeof f !== 'object') continue;
    const { id, name, order } = f as PieceFolder;
    if (typeof id !== 'string' || !isValidFolderId(id) || seen.has(id)) continue;
    if (typeof name !== 'string' || !name.trim()) continue;
    seen.add(id);
    out.push({ id, name: name.trim(), order: typeof order === 'number' ? order : out.length });
  }
  return out.length > 0 ? out : null;
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
  if (typeof e.folderId === 'string' && isValidFolderId(e.folderId)) out.folderId = e.folderId;
  if (typeof e.hidden === 'boolean') out.hidden = e.hidden;
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
  const folderIds: Partial<Record<string, string>> = {};
  const defaults: Partial<Record<string, Partial<PieceDefaults>>> = {};
  const entries: Partial<Record<string, PieceConfigEntry>> = {};
  const customs: string[] = [];
  const hidden = new Set<string>();

  const folders = sanitizeFolders((raw as PieceConfigDoc | null)?.folders);
  // 유효 폴더 id 집합 — 기본 3폴더는 항상 유효 (getFolders 가 재생성 보장)
  const folderIdSet = new Set([...(folders ?? []).map(f => f.id), ...DEFAULT_FOLDERS.map(f => f.id)]);

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
      // 하위호환: folderId 없으면 레거시 tab 을 폴더로 읽는다. 존재하지 않는 폴더는 무시(기본값 폴백).
      const folderId = entry.folderId ?? entry.tab;
      if (folderId && folderIdSet.has(folderId)) folderIds[type] = folderId;
      if (entry.defaults) defaults[type] = entry.defaults;
      if (entry.hidden) hidden.add(type);
      if (!isBuiltin) customs.push(type);
      applied.push(type);
    }
  }

  setBehaviorOverrides(behaviorDefs);
  setSvgOverrides(svgs);
  setLabelOverrides(labels);
  configFolders = folders;
  folderOverrides = folderIds;
  defaultsOverrides = defaults;
  rawEntries = entries;
  customTypes = customs;
  hiddenTypes = hidden;

  return { applied, skipped };
}

export function resetPieceConfig(): void {
  setBehaviorOverrides({});
  setSvgOverrides({});
  setLabelOverrides({});
  configFolders = null;
  folderOverrides = {};
  defaultsOverrides = {};
  rawEntries = {};
  customTypes = [];
  hiddenTypes = new Set();
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
