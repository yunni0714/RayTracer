import { describe, it, expect, afterEach } from 'vitest';
import {
  selectCatalogMaps, matchesCondition, needsLogin, sortMapsBy, describeCatalog,
  type CatalogContext,
} from '../src/lib/catalogRules';
import {
  DEFAULT_CATALOGS, getCatalog, applyCatalogConfig, resetCatalogConfig,
  type CatalogDef, type CatalogCondition,
} from '../src/lib/catalogConfig';
import type { Difficulty, MapDocument, MapItemDTO } from '../src/types/game';

afterEach(() => resetCatalogConfig());

const NOW = Date.parse('2026-08-01T00:00:00.000Z');
const daysAgo = (d: number) => new Date(NOW - d * 86400000).toISOString();

function piece(type: string): MapItemDTO {
  return { x: 0, y: 0, type, rotation: 0, canMove: false, canRotate: false, isInventory: false };
}

function map(p: Partial<MapDocument> & { id: string }): MapDocument {
  return {
    title: '맵', author: '작성자', authorUid: 'uid_other', difficulty: 'Normal' as Difficulty,
    mapData: [piece('ray'), piece('mirror'), piece('target')],
    gridSize: 5, reactionOk: 0, reactionGod: 0, diffVotes: {},
    createdAt: daysAgo(10), version: 1,
    ...p,
  };
}

function ctx(over: Partial<CatalogContext> = {}): CatalogContext {
  return { uid: null, mapStates: {}, now: NOW, ...over };
}

function cat(over: Partial<CatalogDef> = {}): CatalogDef {
  return { id: 'test', label: '테스트', order: 0, ...over };
}

const MAPS: MapDocument[] = [
  map({ id: 'a', title: '기초 반사', author: 'RayOriginal', reactionGod: 5, reactionOk: 2, createdAt: daysAgo(2) }),
  map({ id: 'b', title: '게이트 지옥', authorUid: 'uid_me', difficulty: 'Insane', reactionGod: 1, reactionOk: 9, gridSize: 7, createdAt: daysAgo(40), mapData: [piece('ray'), piece('cross_gate'), piece('target')] }),
  map({ id: 'c', title: '45도', difficulty: 'Easy', reactionGod: 12, createdAt: daysAgo(100), mapData: [piece('ray'), piece('mirror_45'), piece('target'), piece('block')] }),
];

/* ── 조건별 매칭 ─────────────────────────────────────────── */

describe('matchesCondition — 맵 속성 기준', () => {
  const [a, b, c] = MAPS;

  it('author', () => {
    const cond: CatalogCondition = { kind: 'author', author: 'RayOriginal' };
    expect(matchesCondition(a, cond, ctx())).toBe(true);
    expect(matchesCondition(b, cond, ctx())).toBe(false);
  });

  it('reaction — min / max / 범위', () => {
    expect(matchesCondition(a, { kind: 'reaction', field: 'reactionGod', min: 3 }, ctx())).toBe(true);
    expect(matchesCondition(b, { kind: 'reaction', field: 'reactionGod', min: 3 }, ctx())).toBe(false);
    expect(matchesCondition(c, { kind: 'reaction', field: 'reactionGod', max: 5 }, ctx())).toBe(false);
    expect(matchesCondition(a, { kind: 'reaction', field: 'reactionGod', min: 3, max: 6 }, ctx())).toBe(true);
  });

  it('difficulty', () => {
    const cond: CatalogCondition = { kind: 'difficulty', values: ['Insane', 'Hard'] };
    expect(matchesCondition(b, cond, ctx())).toBe(true);
    expect(matchesCondition(c, cond, ctx())).toBe(false);
  });

  it('category — mapCategory 파생값 사용', () => {
    expect(matchesCondition(a, { kind: 'category', values: ['basic'] }, ctx())).toBe(true);
    expect(matchesCondition(b, { kind: 'category', values: ['logic'] }, ctx())).toBe(true);
    expect(matchesCondition(c, { kind: 'category', values: ['advanced'] }, ctx())).toBe(true);
    expect(matchesCondition(c, { kind: 'category', values: ['basic', 'logic'] }, ctx())).toBe(false);
  });

  it('recent — 기간 내/외, 잘못된 날짜는 불일치', () => {
    expect(matchesCondition(a, { kind: 'recent', days: 7 }, ctx())).toBe(true);
    expect(matchesCondition(b, { kind: 'recent', days: 7 }, ctx())).toBe(false);
    expect(matchesCondition(b, { kind: 'recent', days: 60 }, ctx())).toBe(true);
    const broken = map({ id: 'x', createdAt: '쓰레기' });
    expect(matchesCondition(broken, { kind: 'recent', days: 9999 }, ctx())).toBe(false);
  });

  it('gridSize / pieceCount', () => {
    expect(matchesCondition(b, { kind: 'gridSize', min: 7 }, ctx())).toBe(true);
    expect(matchesCondition(a, { kind: 'gridSize', min: 7 }, ctx())).toBe(false);
    expect(matchesCondition(c, { kind: 'pieceCount', min: 4 }, ctx())).toBe(true);
    expect(matchesCondition(a, { kind: 'pieceCount', min: 4 }, ctx())).toBe(false);
  });

  it('containsPiece — any / all', () => {
    expect(matchesCondition(b, { kind: 'containsPiece', types: ['cross_gate'], mode: 'any' }, ctx())).toBe(true);
    expect(matchesCondition(a, { kind: 'containsPiece', types: ['cross_gate'], mode: 'any' }, ctx())).toBe(false);
    expect(matchesCondition(c, { kind: 'containsPiece', types: ['mirror_45', 'block'], mode: 'all' }, ctx())).toBe(true);
    expect(matchesCondition(c, { kind: 'containsPiece', types: ['mirror_45', 'cross_gate'], mode: 'all' }, ctx())).toBe(false);
  });

  it('titleContains — 제목/설명, 대소문자 무시', () => {
    expect(matchesCondition(a, { kind: 'titleContains', text: '기초' }, ctx())).toBe(true);
    const withDesc = map({ id: 'd', title: '무제', description: 'Tutorial 코스' });
    expect(matchesCondition(withDesc, { kind: 'titleContains', text: 'tutorial' }, ctx())).toBe(true);
  });
});

describe('matchesCondition — 로그인 사용자 기준', () => {
  const [a, b] = MAPS;
  const me = ctx({ uid: 'uid_me', mapStates: { a: { ok: true, god: false, diff: 'Hard' } } });

  it('mine — owned true/false', () => {
    expect(matchesCondition(b, { kind: 'mine', owned: true }, me)).toBe(true);
    expect(matchesCondition(a, { kind: 'mine', owned: true }, me)).toBe(false);
    expect(matchesCondition(a, { kind: 'mine', owned: false }, me)).toBe(true);
  });

  it('played — mapStates 키 존재 여부', () => {
    expect(matchesCondition(a, { kind: 'played', played: true }, me)).toBe(true);
    expect(matchesCondition(b, { kind: 'played', played: true }, me)).toBe(false);
    expect(matchesCondition(b, { kind: 'played', played: false }, me)).toBe(true);
  });

  it('reacted — ok / god / any', () => {
    expect(matchesCondition(a, { kind: 'reacted', field: 'ok', reacted: true }, me)).toBe(true);
    expect(matchesCondition(a, { kind: 'reacted', field: 'god', reacted: true }, me)).toBe(false);
    expect(matchesCondition(a, { kind: 'reacted', field: 'any', reacted: true }, me)).toBe(true);
    expect(matchesCondition(b, { kind: 'reacted', field: 'any', reacted: false }, me)).toBe(true);
  });

  it('voted — diff 값 존재 여부', () => {
    expect(matchesCondition(a, { kind: 'voted', voted: true }, me)).toBe(true);
    expect(matchesCondition(b, { kind: 'voted', voted: true }, me)).toBe(false);
  });

  it('비로그인이면 사용자 기준 조건은 전부 불일치', () => {
    const anon = ctx({ mapStates: { a: { ok: true, god: true, diff: null } } });
    expect(matchesCondition(a, { kind: 'mine', owned: false }, anon)).toBe(false);
    expect(matchesCondition(a, { kind: 'played', played: false }, anon)).toBe(false);
    expect(matchesCondition(a, { kind: 'reacted', field: 'any', reacted: true }, anon)).toBe(false);
    expect(matchesCondition(a, { kind: 'voted', voted: false }, anon)).toBe(false);
  });
});

/* ── 선별 파이프라인 ─────────────────────────────────────── */

describe('selectCatalogMaps', () => {
  it('조건 없음 = 전체 (기본 createdAt desc)', () => {
    expect(selectCatalogMaps(cat(), MAPS, ctx()).map(m => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('조건 여러 개는 AND', () => {
    const c = cat({ conditions: [
      { kind: 'reaction', field: 'reactionGod', min: 2 },
      { kind: 'recent', days: 30 },
    ] });
    expect(selectCatalogMaps(c, MAPS, ctx()).map(m => m.id)).toEqual(['a']);
  });

  it('sort + limit', () => {
    const c = cat({ sort: { by: 'reactionGod', dir: 'desc' }, limit: 2 });
    expect(selectCatalogMaps(c, MAPS, ctx()).map(m => m.id)).toEqual(['c', 'a']);
    const asc = cat({ sort: { by: 'reactionOk', dir: 'asc' } });
    expect(selectCatalogMaps(asc, MAPS, ctx()).map(m => m.id)).toEqual(['c', 'a', 'b']);
  });

  it('pinned 는 규칙에 안 걸려도 포함되고 맨 앞에 온다', () => {
    const c = cat({
      conditions: [{ kind: 'author', author: 'RayOriginal' }],
      pinnedMapIds: ['c'],
    });
    expect(selectCatalogMaps(c, MAPS, ctx()).map(m => m.id)).toEqual(['c', 'a']);
  });

  it('excluded 가 pinned 보다 우선', () => {
    const c = cat({ pinnedMapIds: ['b'], excludedMapIds: ['b'] });
    expect(selectCatalogMaps(c, MAPS, ctx()).map(m => m.id)).toEqual(['a', 'c']);
  });

  it('excluded 는 규칙 통과 맵도 제거', () => {
    const c = cat({ conditions: [], excludedMapIds: ['a'] });
    expect(selectCatalogMaps(c, MAPS, ctx()).map(m => m.id)).toEqual(['b', 'c']);
  });

  it('limit 는 pinned 포함 후 자른다', () => {
    const c = cat({ pinnedMapIds: ['c'], limit: 1 });
    expect(selectCatalogMaps(c, MAPS, ctx()).map(m => m.id)).toEqual(['c']);
  });

  it('비로그인 + 사용자 조건 = 빈 목록', () => {
    const c = cat({ conditions: [{ kind: 'mine', owned: true }] });
    expect(selectCatalogMaps(c, MAPS, ctx())).toEqual([]);
    expect(selectCatalogMaps(c, MAPS, ctx({ uid: 'uid_me' })).map(m => m.id)).toEqual(['b']);
  });

  it('빈 맵 목록도 안전', () => {
    expect(selectCatalogMaps(cat(), [], ctx())).toEqual([]);
  });
});

describe('needsLogin', () => {
  it('사용자 기준 조건이 있으면 true', () => {
    expect(needsLogin(cat({ conditions: [{ kind: 'mine', owned: true }] }))).toBe(true);
    expect(needsLogin(cat({ conditions: [{ kind: 'played', played: false }] }))).toBe(true);
    expect(needsLogin(cat({ conditions: [{ kind: 'author', author: 'x' }] }))).toBe(false);
    expect(needsLogin(cat())).toBe(false);
  });
});

/* ── 빌트인 5종 회귀 (예전 LibraryScreen switch 와 동일 결과) ── */

describe('빌트인 카탈로그 동작 회귀', () => {
  const many: MapDocument[] = [
    ...MAPS,
    map({ id: 'd', author: 'RayOriginal', reactionGod: 3, createdAt: daysAgo(1) }),
    map({ id: 'e', authorUid: 'uid_me', reactionGod: 0, createdAt: daysAgo(5) }),
  ];
  const me = ctx({ uid: 'uid_me' });

  it('추천 = God 3개 이상, God 내림차순', () => {
    const c = getCatalog('featured')!;
    expect(selectCatalogMaps(c, many, me).map(m => m.id)).toEqual(['c', 'a', 'd']);
  });

  it('원본 = author RayOriginal, 최신순', () => {
    const c = getCatalog('original')!;
    expect(selectCatalogMaps(c, many, me).map(m => m.id)).toEqual(['d', 'a']);
  });

  it('최근 = 전체 최신순', () => {
    const c = getCatalog('recent')!;
    expect(selectCatalogMaps(c, many, me).map(m => m.id)).toEqual(['d', 'a', 'e', 'b', 'c']);
  });

  it('명예의전당 = God 상위 20', () => {
    const c = getCatalog('hall')!;
    expect(c.limit).toBe(20);
    expect(selectCatalogMaps(c, many, me).map(m => m.id)).toEqual(['c', 'a', 'd', 'b', 'e']);
  });

  it('내 맵 = authorUid 일치, 비로그인은 빈 목록', () => {
    const c = getCatalog('mine')!;
    expect(selectCatalogMaps(c, many, me).map(m => m.id)).toEqual(['e', 'b']);
    expect(selectCatalogMaps(c, many, ctx())).toEqual([]);
  });

  it('DEFAULT_CATALOGS 5종이 order 순', () => {
    expect(DEFAULT_CATALOGS.map(c => c.id)).toEqual(['featured', 'original', 'recent', 'hall', 'mine']);
  });
});

/* ── config 오버라이드가 평가에 반영 ─────────────────────── */

describe('어드민 오버라이드 반영', () => {
  it('빌트인 조건을 바꾸면 결과가 바뀐다', () => {
    expect(selectCatalogMaps(getCatalog('featured')!, MAPS, ctx()).map(m => m.id)).toEqual(['c', 'a']);

    applyCatalogConfig({
      version: 2,
      catalogs: { featured: { conditions: [{ kind: 'difficulty', values: ['Insane'] }] } },
    });
    expect(selectCatalogMaps(getCatalog('featured')!, MAPS, ctx()).map(m => m.id)).toEqual(['b']);
  });

  it('커스텀 카탈로그 + 수동 큐레이션', () => {
    applyCatalogConfig({
      version: 2,
      catalogs: {
        weekly: {
          label: '이번주', emoji: '🗓',
          conditions: [{ kind: 'recent', days: 7 }],
          pinnedMapIds: ['c'],
        },
      },
    });
    const c = getCatalog('weekly')!;
    expect(selectCatalogMaps(c, MAPS, ctx()).map(m => m.id)).toEqual(['c', 'a']);
  });
});

describe('sortMapsBy / describeCatalog', () => {
  it('title 정렬', () => {
    expect(sortMapsBy(MAPS, { by: 'title', dir: 'asc' }).map(m => m.title))
      .toEqual(['45도', '게이트 지옥', '기초 반사']);
  });

  it('원본 배열 불변', () => {
    const order = MAPS.map(m => m.id);
    sortMapsBy(MAPS, { by: 'reactionGod', dir: 'desc' });
    expect(MAPS.map(m => m.id)).toEqual(order);
  });

  it('요약 문자열', () => {
    expect(describeCatalog(cat())).toBe('전체 맵');
    expect(describeCatalog(getCatalog('featured')!)).toContain('🌟 3개 이상');
    expect(describeCatalog(cat({ limit: 20, pinnedMapIds: ['a'] }))).toBe('전체 맵 · 상위 20개 · 고정 1');
  });
});
