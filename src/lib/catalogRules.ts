import { computeMapCategory } from './mapCategory';
import { USER_CONDITION_KINDS, type CatalogCondition, type CatalogDef, type CatalogSort } from './catalogConfig';
import type { Difficulty, MapDocument } from '../types/game';

/* ════════════════════════════════════════════════════════
   카탈로그 규칙 평가 — 카탈로그 정의 + 맵 목록 → 보여줄 맵.
   순수 함수(네트워크·스토어 없음) — 라이브러리와 어드민 미리보기가 공유한다.

   평가 순서 (고정):
     ① excludedMapIds 제거          — 최우선
     ② conditions 전부 만족(AND)     — 없거나 빈 배열이면 전체
     ③ pinnedMapIds 추가             — 규칙에 안 걸려도 포함
     ④ sort 정렬 (기본 createdAt desc), pinned 는 정렬 후 맨 앞으로
     ⑤ limit 로 자르기
   ════════════════════════════════════════════════════════ */

export interface MapUserState {
  ok: boolean;
  god: boolean;
  diff: Difficulty | null;
}

export interface CatalogContext {
  uid: string | null;
  /** localStorage['ray_map_states'] — 키 존재 = 플레이한 맵 (NextMapPanel 규약) */
  mapStates: Record<string, MapUserState>;
  /** 테스트 주입용. 없으면 Date.now() */
  now?: number;
}

export const EMPTY_CONTEXT: CatalogContext = { uid: null, mapStates: {} };

const DAY_MS = 24 * 60 * 60 * 1000;

function inRange(value: number, min?: number, max?: number): boolean {
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

export function matchesCondition(map: MapDocument, cond: CatalogCondition, ctx: CatalogContext): boolean {
  const state = ctx.mapStates[map.id];

  switch (cond.kind) {
    case 'author':
      return (map.author ?? '') === cond.author;

    case 'reaction':
      return inRange(map[cond.field] ?? 0, cond.min, cond.max);

    case 'difficulty':
      return cond.values.includes(map.difficulty);

    case 'category':
      return cond.values.includes(computeMapCategory(map.mapData));

    case 'recent': {
      const created = new Date(map.createdAt ?? '').getTime();
      if (Number.isNaN(created)) return false;
      return (ctx.now ?? Date.now()) - created <= cond.days * DAY_MS;
    }

    case 'gridSize':
      return inRange(map.gridSize ?? 5, cond.min, cond.max);

    case 'pieceCount':
      return inRange(map.mapData?.length ?? 0, cond.min, cond.max);

    case 'containsPiece': {
      const types = new Set((map.mapData ?? []).map(i => i.type));
      return cond.mode === 'all'
        ? cond.types.every(t => types.has(t))
        : cond.types.some(t => types.has(t));
    }

    case 'titleContains': {
      const q = cond.text.toLowerCase();
      return (map.title ?? '').toLowerCase().includes(q)
        || (map.description ?? '').toLowerCase().includes(q);
    }

    // ── 로그인 사용자 기준 (uid 없으면 전부 불일치) ──
    case 'mine':
      if (!ctx.uid) return false;
      return (map.authorUid === ctx.uid) === cond.owned;

    case 'played':
      if (!ctx.uid) return false;
      return (state !== undefined) === cond.played;

    case 'reacted': {
      if (!ctx.uid) return false;
      const reacted = !!state && (
        cond.field === 'any' ? (state.ok || state.god)
          : cond.field === 'ok' ? state.ok
            : state.god
      );
      return reacted === cond.reacted;
    }

    case 'voted':
      if (!ctx.uid) return false;
      return (!!state && state.diff != null) === cond.voted;
  }
}

// 로그인 사용자 기준 조건이 하나라도 있으면 true — 비로그인 사용자에겐 결과가 비어 있다.
export function needsLogin(catalog: CatalogDef): boolean {
  return (catalog.conditions ?? []).some(c => USER_CONDITION_KINDS.includes(c.kind));
}

const DEFAULT_SORT: CatalogSort = { by: 'createdAt', dir: 'desc' };

export function sortMapsBy(maps: MapDocument[], sort: CatalogSort = DEFAULT_SORT): MapDocument[] {
  const dir = sort.dir === 'asc' ? -1 : 1;
  return [...maps].sort((a, b) => {
    let cmp: number;
    if (sort.by === 'createdAt') cmp = (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
    else if (sort.by === 'title') cmp = (a.title ?? '').localeCompare(b.title ?? '');
    else cmp = (a[sort.by] ?? 0) - (b[sort.by] ?? 0);
    return -cmp * dir; // desc 가 기본이라 부호를 뒤집는다
  });
}

export function selectCatalogMaps(
  catalog: CatalogDef,
  maps: MapDocument[],
  ctx: CatalogContext = EMPTY_CONTEXT,
): MapDocument[] {
  const excluded = new Set(catalog.excludedMapIds ?? []);
  const pinned = new Set((catalog.pinnedMapIds ?? []).filter(id => !excluded.has(id)));
  const conditions = catalog.conditions ?? [];

  const pool = maps.filter(m => !excluded.has(m.id));
  const matched = pool.filter(m =>
    pinned.has(m.id) || conditions.every(c => matchesCondition(m, c, ctx))
  );

  const sorted = sortMapsBy(matched, catalog.sort);
  // 고정 맵은 정렬과 무관하게 맨 앞 (수동 큐레이션 의도)
  const ordered = [
    ...sorted.filter(m => pinned.has(m.id)),
    ...sorted.filter(m => !pinned.has(m.id)),
  ];

  return catalog.limit && catalog.limit > 0 ? ordered.slice(0, catalog.limit) : ordered;
}

/* ── 사람이 읽는 요약 (어드민 목록/툴팁) ────────────────── */

const DIFF_ALL = 5;

export function describeCondition(cond: CatalogCondition): string {
  switch (cond.kind) {
    case 'author': return `작성자 = ${cond.author}`;
    case 'reaction': {
      const label = cond.field === 'reactionGod' ? '🌟' : '👍';
      if (cond.min !== undefined && cond.max !== undefined) return `${label} ${cond.min}~${cond.max}`;
      if (cond.min !== undefined) return `${label} ${cond.min}개 이상`;
      if (cond.max !== undefined) return `${label} ${cond.max}개 이하`;
      return `${label} 반응`;
    }
    case 'difficulty':
      return cond.values.length === DIFF_ALL ? '난이도 전체' : `난이도 ${cond.values.join('·')}`;
    case 'category': return `카테고리 ${cond.values.join('·')}`;
    case 'recent': return `최근 ${cond.days}일`;
    case 'gridSize': return `그리드 ${cond.min ?? ''}~${cond.max ?? ''}`.replace('~ ', '');
    case 'pieceCount': return `기물 수 ${cond.min ?? ''}~${cond.max ?? ''}`;
    case 'containsPiece':
      return `${cond.mode === 'all' ? '모두 포함' : '하나라도 포함'}: ${cond.types.length}종`;
    case 'titleContains': return `제목/설명에 "${cond.text}"`;
    case 'mine': return cond.owned ? '내가 만든 맵' : '남이 만든 맵';
    case 'played': return cond.played ? '플레이한 맵' : '아직 안 한 맵';
    case 'reacted': {
      const f = cond.field === 'any' ? '반응' : cond.field === 'ok' ? '👍' : '🌟';
      return cond.reacted ? `내가 ${f} 누른 맵` : `내가 ${f} 안 누른 맵`;
    }
    case 'voted': return cond.voted ? '내가 난이도 투표한 맵' : '내가 투표 안 한 맵';
  }
}

export function describeCatalog(catalog: CatalogDef): string {
  const parts = (catalog.conditions ?? []).map(describeCondition);
  const base = parts.length ? parts.join(' + ') : '전체 맵';
  const extra: string[] = [];
  if (catalog.limit) extra.push(`상위 ${catalog.limit}개`);
  if (catalog.pinnedMapIds?.length) extra.push(`고정 ${catalog.pinnedMapIds.length}`);
  if (catalog.excludedMapIds?.length) extra.push(`제외 ${catalog.excludedMapIds.length}`);
  return extra.length ? `${base} · ${extra.join(' · ')}` : base;
}
