import type { Difficulty } from '../types/game';
import type { MapCategory } from './mapCategory';

/* ════════════════════════════════════════════════════════
   라이브러리 카탈로그 config 오버레이 (어드민)

   Firestore `config/catalog` 문서를 코드 기본값(DEFAULT_CATALOGS) 위에
   머지한다. `pieceConfig.ts` 와 같은 오버레이 모델 — config 미존재/손상 시
   코드 기본값으로 silent fallback 하고, loadCatalogConfig() 는 절대 throw
   하지 않는다.

   ⚠️ 카탈로그 목록에 접근할 때는 항상 getCatalogs()/getCatalog() 를 쓸 것.
      DEFAULT_CATALOGS 를 직접 읽으면 어드민 오버라이드가 무시된다.

   맵 선별(평가)은 여기 없다 — `catalogRules.ts` 가 담당한다 (정의/평가 분리).
   ════════════════════════════════════════════════════════ */

export type SortKey = 'createdAt' | 'reactionGod' | 'reactionOk' | 'title';
export type SortDir = 'asc' | 'desc';
export interface CatalogSort { by: SortKey; dir: SortDir }

/* 카탈로그 조건 — 배열에 담기면 전부 만족(AND)해야 한다.
   'mine' | 'played' | 'reacted' | 'voted' 는 로그인 사용자 기준(needsLogin). */
export type CatalogCondition =
  | { kind: 'author'; author: string }
  | { kind: 'reaction'; field: 'reactionOk' | 'reactionGod'; min?: number; max?: number }
  | { kind: 'difficulty'; values: Difficulty[] }
  | { kind: 'category'; values: MapCategory[] }
  | { kind: 'recent'; days: number }
  | { kind: 'gridSize'; min?: number; max?: number }
  | { kind: 'pieceCount'; min?: number; max?: number }
  | { kind: 'containsPiece'; types: string[]; mode: 'any' | 'all' }
  | { kind: 'titleContains'; text: string }
  // ── 로그인 사용자 기준 ──
  | { kind: 'mine'; owned: boolean }
  | { kind: 'played'; played: boolean }
  | { kind: 'reacted'; field: 'ok' | 'god' | 'any'; reacted: boolean }
  | { kind: 'voted'; voted: boolean };

export type CatalogConditionKind = CatalogCondition['kind'];

export const USER_CONDITION_KINDS: readonly CatalogConditionKind[] =
  ['mine', 'played', 'reacted', 'voted'] as const;

export interface CatalogDef {
  id: string;
  label: string;
  emoji?: string;
  order: number;
  hidden?: boolean;             // 라이브러리에서 숨김 (정의는 유지)
  conditions?: CatalogCondition[]; // AND. 없거나 빈 배열이면 전체
  sort?: CatalogSort;           // 기본 createdAt desc
  limit?: number;               // 상위 N개만 (명예의전당 = 20)
  pinnedMapIds?: string[];      // 규칙과 무관하게 포함 (정렬 후 맨 앞)
  excludedMapIds?: string[];    // 규칙에 걸려도 제외 (최우선)
}

export interface CatalogConfigDoc {
  version?: number;
  catalogs?: Record<string, Partial<CatalogDef>>;
}

/* ── 코드 기본값 ────────────────────────────────────────── */
// 라이브러리 빌트인 5종. 예전 LibraryScreen 하드코딩 필터와 동작이 같다.
export const DEFAULT_CATALOGS: readonly CatalogDef[] = [
  {
    id: 'featured', label: '추천', emoji: '🔥', order: 0,
    conditions: [{ kind: 'reaction', field: 'reactionGod', min: 3 }],
    sort: { by: 'reactionGod', dir: 'desc' },
  },
  {
    id: 'original', label: '원본', emoji: '🏛', order: 1,
    conditions: [{ kind: 'author', author: 'RayOriginal' }],
    sort: { by: 'createdAt', dir: 'desc' },
  },
  {
    id: 'recent', label: '최근', emoji: '🕗', order: 2,
    conditions: [],
    sort: { by: 'createdAt', dir: 'desc' },
  },
  {
    id: 'hall', label: '명예의전당', emoji: '🏆', order: 3,
    conditions: [],
    sort: { by: 'reactionGod', dir: 'desc' },
    limit: 20,
  },
  {
    id: 'mine', label: '내 맵', emoji: '👤', order: 4,
    conditions: [{ kind: 'mine', owned: true }],
    sort: { by: 'createdAt', dir: 'desc' },
  },
];

const BUILTIN_IDS: ReadonlySet<string> = new Set(DEFAULT_CATALOGS.map(c => c.id));

const CATALOG_ID_RE = /^[a-z0-9_]+$/;
const CATALOG_ID_MAX = 48;
const LABEL_MAX = 40;
const EMOJI_MAX = 8;
const MAP_ID_LIST_MAX = 300;
const CONDITIONS_MAX = 12;
const PIECE_TYPES_MAX = 40;

export function isValidCatalogId(id: string): boolean {
  return id.length > 0 && id.length <= CATALOG_ID_MAX && CATALOG_ID_RE.test(id);
}

export function isBuiltinCatalogId(id: string): boolean {
  return BUILTIN_IDS.has(id);
}

export function getBuiltinCatalog(id: string): CatalogDef | undefined {
  const found = DEFAULT_CATALOGS.find(c => c.id === id);
  return found ? structuredCloneDef(found) : undefined;
}

function structuredCloneDef(def: CatalogDef): CatalogDef {
  return JSON.parse(JSON.stringify(def)) as CatalogDef;
}

/* ── 오버레이 상태 ──────────────────────────────────────── */

let overrides: Record<string, Partial<CatalogDef>> = {};

// order 순 정렬된 카탈로그 목록. 빌트인 5종은 config 가 빠뜨려도 항상 포함.
export function getCatalogs(opts: { includeHidden?: boolean } = {}): CatalogDef[] {
  const byId = new Map<string, CatalogDef>();
  for (const def of DEFAULT_CATALOGS) byId.set(def.id, structuredCloneDef(def));

  for (const [id, patch] of Object.entries(overrides)) {
    const base = byId.get(id);
    if (base) {
      byId.set(id, { ...base, ...patch, id });
    } else {
      // 커스텀 카탈로그 — sanitize 단계에서 label/order 를 보장한다
      byId.set(id, { label: id, order: byId.size, ...patch, id } as CatalogDef);
    }
  }

  const list = [...byId.values()];
  return (opts.includeHidden ? list : list.filter(c => !c.hidden))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function getCatalog(id: string): CatalogDef | undefined {
  return getCatalogs({ includeHidden: true }).find(c => c.id === id);
}

// 어드민 에디터용: 현재 적용된 raw 오버라이드 스냅샷
export function getCatalogOverrides(): Record<string, Partial<CatalogDef>> {
  return { ...overrides };
}

export function getCustomCatalogIds(): string[] {
  return Object.keys(overrides).filter(id => !BUILTIN_IDS.has(id));
}

/* ── 검증 ───────────────────────────────────────────────── */

const DIFFICULTIES: Difficulty[] = ['Tutor', 'Easy', 'Normal', 'Hard', 'Insane'];
const CATEGORIES: MapCategory[] = ['basic', 'logic', 'advanced', 'advanced_logic'];
const SORT_KEYS: SortKey[] = ['createdAt', 'reactionGod', 'reactionOk', 'title'];

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function strList(raw: unknown, allowed: readonly string[] | null, max: number): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v !== 'string' || !v) continue;
    if (allowed && !allowed.includes(v)) continue;
    seen.add(v);
    if (seen.size >= max) break;
  }
  return seen.size ? [...seen] : undefined;
}

// 조건 하나를 검증한다. 못 쓰는 형태면 undefined — 그 조건만 버리고 나머지는 살린다.
export function sanitizeCondition(raw: unknown): CatalogCondition | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const c = raw as Record<string, unknown>;

  switch (c.kind) {
    case 'author':
      return typeof c.author === 'string' && c.author.trim()
        ? { kind: 'author', author: c.author.trim() } : undefined;

    case 'reaction': {
      if (c.field !== 'reactionOk' && c.field !== 'reactionGod') return undefined;
      const out: CatalogCondition = { kind: 'reaction', field: c.field };
      const min = num(c.min); const max = num(c.max);
      if (min !== undefined) out.min = min;
      if (max !== undefined) out.max = max;
      return out;
    }

    case 'difficulty': {
      const values = strList(c.values, DIFFICULTIES, DIFFICULTIES.length) as Difficulty[] | undefined;
      return values ? { kind: 'difficulty', values } : undefined;
    }

    case 'category': {
      const values = strList(c.values, CATEGORIES, CATEGORIES.length) as MapCategory[] | undefined;
      return values ? { kind: 'category', values } : undefined;
    }

    case 'recent': {
      const days = num(c.days);
      return days !== undefined && days > 0 ? { kind: 'recent', days: Math.floor(days) } : undefined;
    }

    case 'gridSize':
    case 'pieceCount': {
      const min = num(c.min); const max = num(c.max);
      if (min === undefined && max === undefined) return undefined;
      const out = { kind: c.kind } as Extract<CatalogCondition, { kind: 'gridSize' | 'pieceCount' }>;
      if (min !== undefined) out.min = min;
      if (max !== undefined) out.max = max;
      return out;
    }

    case 'containsPiece': {
      const types = strList(c.types, null, PIECE_TYPES_MAX);
      if (!types) return undefined;
      return { kind: 'containsPiece', types, mode: c.mode === 'all' ? 'all' : 'any' };
    }

    case 'titleContains':
      return typeof c.text === 'string' && c.text.trim()
        ? { kind: 'titleContains', text: c.text.trim() } : undefined;

    case 'mine':
      return { kind: 'mine', owned: c.owned !== false };

    case 'played':
      return { kind: 'played', played: c.played !== false };

    case 'reacted': {
      const field = c.field === 'ok' || c.field === 'god' ? c.field : 'any';
      return { kind: 'reacted', field, reacted: c.reacted !== false };
    }

    case 'voted':
      return { kind: 'voted', voted: c.voted !== false };

    default:
      return undefined;
  }
}

function sanitizeConditions(raw: unknown): CatalogCondition[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: CatalogCondition[] = [];
  for (const item of raw.slice(0, CONDITIONS_MAX)) {
    const cond = sanitizeCondition(item);
    if (cond) out.push(cond);
  }
  return out; // 빈 배열도 유효 (= 전체)
}

function sanitizeSort(raw: unknown): CatalogSort | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const s = raw as Record<string, unknown>;
  if (typeof s.by !== 'string' || !SORT_KEYS.includes(s.by as SortKey)) return undefined;
  return { by: s.by as SortKey, dir: s.dir === 'asc' ? 'asc' : 'desc' };
}

function sanitizeMapIds(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = raw.filter((v): v is string => typeof v === 'string' && v.length > 0).slice(0, MAP_ID_LIST_MAX);
  return ids.length ? ids : undefined;
}

/* 레거시(v1) 단일 rule → v2 조건/정렬/limit 승격.
   프로덕션 config 문서는 아직 없지만, 초기 스키마로 저장된 문서가 있어도 깨지지 않게 한다. */
function liftLegacyRule(raw: unknown): Pick<CatalogDef, 'conditions' | 'sort' | 'limit'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  switch (r.kind) {
    case 'all':
      return { conditions: [] };
    case 'mine':
      return { conditions: [{ kind: 'mine', owned: true }] };
    case 'author': {
      const cond = sanitizeCondition({ kind: 'author', author: r.author });
      return cond ? { conditions: [cond] } : null;
    }
    case 'reaction': {
      const cond = sanitizeCondition({ kind: 'reaction', field: r.field, min: r.min });
      if (!cond) return null;
      const out: Pick<CatalogDef, 'conditions' | 'sort' | 'limit'> = {
        conditions: [cond],
        sort: { by: (r.field === 'reactionOk' ? 'reactionOk' : 'reactionGod'), dir: 'desc' },
      };
      const top = num(r.top);
      if (top !== undefined && top > 0) out.limit = Math.floor(top);
      return out;
    }
    default:
      return null;
  }
}

// 부분 패치를 검증한다. 형태가 아예 아니면 null (해당 엔트리 skip).
function sanitizeEntry(raw: unknown, isBuiltin: boolean): Partial<CatalogDef> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const e = raw as Record<string, unknown>;
  const out: Partial<CatalogDef> = {};

  if (typeof e.label === 'string' && e.label.trim()) out.label = e.label.trim().slice(0, LABEL_MAX);
  if (typeof e.emoji === 'string') out.emoji = e.emoji.slice(0, EMOJI_MAX);
  const order = num(e.order);
  if (order !== undefined) out.order = order;
  if (typeof e.hidden === 'boolean') out.hidden = e.hidden;

  const conditions = sanitizeConditions(e.conditions);
  if (conditions) out.conditions = conditions;
  const sort = sanitizeSort(e.sort);
  if (sort) out.sort = sort;
  const limit = num(e.limit);
  if (limit !== undefined && limit > 0) out.limit = Math.floor(limit);

  // v1 문서 호환 — conditions 가 없을 때만 rule 을 승격한다
  if (!out.conditions && e.rule !== undefined) {
    const lifted = liftLegacyRule(e.rule);
    if (lifted) {
      out.conditions = lifted.conditions;
      if (lifted.sort && !out.sort) out.sort = lifted.sort;
      if (lifted.limit && out.limit === undefined) out.limit = lifted.limit;
    }
  }

  const pinned = sanitizeMapIds(e.pinnedMapIds);
  if (pinned) out.pinnedMapIds = pinned;
  const excluded = sanitizeMapIds(e.excludedMapIds);
  if (excluded) out.excludedMapIds = excluded;

  // 커스텀 카탈로그는 코드 기본값이 없다 — 최소한 라벨은 있어야 목록에 세울 수 있다.
  if (!isBuiltin && !out.label) return null;
  // 빌트인은 빈 패치(유효 필드 0개)면 의미가 없다.
  if (isBuiltin && Object.keys(out).length === 0) return null;

  return out;
}

/* ── 적용 / 리셋 ────────────────────────────────────────── */

export interface CatalogApplyResult {
  applied: string[];
  skipped: string[];
}

// config 문서(파싱된 JSON)를 검증 후 오버레이로 적용. 순수 — 네트워크 없음.
export function applyCatalogConfig(raw: unknown): CatalogApplyResult {
  const applied: string[] = [];
  const skipped: string[] = [];
  const next: Record<string, Partial<CatalogDef>> = {};

  const catalogs = (raw as CatalogConfigDoc | null)?.catalogs;
  if (catalogs && typeof catalogs === 'object' && !Array.isArray(catalogs)) {
    for (const [id, rawEntry] of Object.entries(catalogs)) {
      const isBuiltin = BUILTIN_IDS.has(id);
      if (!isBuiltin && !isValidCatalogId(id)) { skipped.push(id); continue; }
      const entry = sanitizeEntry(rawEntry, isBuiltin);
      if (!entry) { skipped.push(id); continue; }
      // 커스텀은 order 누락 시 빌트인 뒤로
      if (!isBuiltin && entry.order === undefined) entry.order = DEFAULT_CATALOGS.length;
      next[id] = entry;
      applied.push(id);
    }
  }

  overrides = next;
  return { applied, skipped };
}

export function resetCatalogConfig(): void {
  overrides = {};
}

// 실패해도 코드 기본값으로 동작 — 절대 throw 하지 않는다.
export async function loadCatalogConfig(): Promise<CatalogApplyResult | null> {
  try {
    const { fetchCatalogConfig } = await import('./firebaseService');
    const doc = await fetchCatalogConfig();
    if (!doc) return null;
    return applyCatalogConfig(doc);
  } catch {
    return null;
  }
}
