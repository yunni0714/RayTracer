/* ════════════════════════════════════════════════════════
   라이브러리 카탈로그 config 오버레이 (어드민)

   Firestore `config/catalog` 문서를 코드 기본값(DEFAULT_CATALOGS) 위에
   머지한다. `pieceConfig.ts` 와 같은 오버레이 모델 — config 미존재/손상 시
   코드 기본값으로 silent fallback 하고, loadCatalogConfig() 는 절대 throw
   하지 않는다.

   ⚠️ 카탈로그 목록에 접근할 때는 항상 getCatalogs()/getCatalog() 를 쓸 것.
      DEFAULT_CATALOGS 를 직접 읽으면 어드민 오버라이드가 무시된다.

   rule(규칙) / pinnedMapIds·excludedMapIds(수동 큐레이션) 은 편집 UI 가
   붙기 전 단계의 스키마다. 5개 빌트인을 표현할 수 있을 만큼만 정의되어
   있고, 세부 조건 문법은 후속 작업에서 확장한다.
   ════════════════════════════════════════════════════════ */

// 카탈로그가 맵을 고르는 규칙. 현재는 빌트인 5종을 표현할 수 있는 최소 집합.
export type CatalogRule =
  | { kind: 'all' }                                          // 전체 (최근)
  | { kind: 'author'; author: string }                       // 특정 작성자명 (원본)
  | { kind: 'mine' }                                         // 로그인 사용자의 맵 (내 맵)
  | {                                                        // 반응 수 기준 (추천 / 명예의전당)
      kind: 'reaction';
      field: 'reactionOk' | 'reactionGod';
      min?: number;   // 이 값 이상만
      top?: number;   // 상위 N개만
    };

export interface CatalogDef {
  id: string;
  label: string;
  emoji?: string;
  order: number;
  hidden?: boolean;         // 라이브러리에서 숨김 (정의는 유지)
  rule?: CatalogRule;
  pinnedMapIds?: string[];  // 규칙과 무관하게 항상 포함 (수동 큐레이션)
  excludedMapIds?: string[]; // 규칙에 걸려도 제외 (수동 큐레이션)
}

export interface CatalogConfigDoc {
  version?: number;
  catalogs?: Record<string, Partial<CatalogDef>>;
}

/* ── 코드 기본값 ────────────────────────────────────────── */
// LibraryScreen 의 하드코딩 카테고리 5종을 그대로 옮긴 것.
export const DEFAULT_CATALOGS: readonly CatalogDef[] = [
  { id: 'featured', label: '추천', emoji: '🔥', order: 0, rule: { kind: 'reaction', field: 'reactionGod', min: 3 } },
  { id: 'original', label: '원본', emoji: '🏛', order: 1, rule: { kind: 'author', author: 'RayOriginal' } },
  { id: 'recent', label: '최근', emoji: '🕗', order: 2, rule: { kind: 'all' } },
  { id: 'hall', label: '명예의전당', emoji: '🏆', order: 3, rule: { kind: 'reaction', field: 'reactionGod', top: 20 } },
  { id: 'mine', label: '내 맵', emoji: '👤', order: 4, rule: { kind: 'mine' } },
];

const BUILTIN_IDS: ReadonlySet<string> = new Set(DEFAULT_CATALOGS.map(c => c.id));

const CATALOG_ID_RE = /^[a-z0-9_]+$/;
const CATALOG_ID_MAX = 48;
const LABEL_MAX = 40;
const EMOJI_MAX = 8;
const MAP_ID_LIST_MAX = 300;

export function isValidCatalogId(id: string): boolean {
  return id.length > 0 && id.length <= CATALOG_ID_MAX && CATALOG_ID_RE.test(id);
}

export function isBuiltinCatalogId(id: string): boolean {
  return BUILTIN_IDS.has(id);
}

/* ── 오버레이 상태 ──────────────────────────────────────── */

let overrides: Record<string, Partial<CatalogDef>> = {};

// order 순 정렬된 카탈로그 목록. 빌트인 5종은 config 가 빠뜨려도 항상 포함.
export function getCatalogs(opts: { includeHidden?: boolean } = {}): CatalogDef[] {
  const byId = new Map<string, CatalogDef>();
  for (const def of DEFAULT_CATALOGS) byId.set(def.id, { ...def });

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

/* ── 검증 ───────────────────────────────────────────────── */

function sanitizeRule(raw: unknown): CatalogRule | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Partial<CatalogRule> & Record<string, unknown>;
  switch (r.kind) {
    case 'all':
    case 'mine':
      return { kind: r.kind };
    case 'author':
      return typeof r.author === 'string' && r.author ? { kind: 'author', author: r.author } : undefined;
    case 'reaction': {
      if (r.field !== 'reactionOk' && r.field !== 'reactionGod') return undefined;
      const rule: CatalogRule = { kind: 'reaction', field: r.field };
      if (typeof r.min === 'number' && Number.isFinite(r.min)) rule.min = r.min;
      if (typeof r.top === 'number' && Number.isFinite(r.top) && r.top > 0) rule.top = Math.floor(r.top);
      return rule;
    }
    default:
      return undefined;
  }
}

function sanitizeMapIds(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = raw.filter((v): v is string => typeof v === 'string' && v.length > 0).slice(0, MAP_ID_LIST_MAX);
  return ids.length ? ids : undefined;
}

// 부분 패치를 검증한다. 형태가 아예 아니면 null (해당 엔트리 skip).
function sanitizeEntry(raw: unknown, isBuiltin: boolean): Partial<CatalogDef> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const e = raw as Partial<CatalogDef> & Record<string, unknown>;
  const out: Partial<CatalogDef> = {};

  if (typeof e.label === 'string' && e.label.trim()) out.label = e.label.trim().slice(0, LABEL_MAX);
  if (typeof e.emoji === 'string') out.emoji = e.emoji.slice(0, EMOJI_MAX);
  if (typeof e.order === 'number' && Number.isFinite(e.order)) out.order = e.order;
  if (typeof e.hidden === 'boolean') out.hidden = e.hidden;

  const rule = sanitizeRule(e.rule);
  if (rule) out.rule = rule;

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
