import { describe, it, expect, afterEach } from 'vitest';
import {
  applyCatalogConfig, resetCatalogConfig, getCatalogs, getCatalog,
  getCatalogOverrides, isBuiltinCatalogId, isValidCatalogId,
  DEFAULT_CATALOGS,
} from '../src/lib/catalogConfig';

afterEach(() => resetCatalogConfig());

describe('코드 기본값', () => {
  it('config 없이 빌트인 5종을 order 순으로 노출한다', () => {
    const list = getCatalogs();
    expect(list.map(c => c.id)).toEqual(['featured', 'original', 'recent', 'hall', 'mine']);
    expect(list.every(c => isBuiltinCatalogId(c.id))).toBe(true);
  });

  it('LibraryScreen 하드코딩 규칙과 같은 조건을 담고 있다', () => {
    expect(getCatalog('featured')?.rule).toEqual({ kind: 'reaction', field: 'reactionGod', min: 3 });
    expect(getCatalog('original')?.rule).toEqual({ kind: 'author', author: 'RayOriginal' });
    expect(getCatalog('recent')?.rule).toEqual({ kind: 'all' });
    expect(getCatalog('hall')?.rule).toEqual({ kind: 'reaction', field: 'reactionGod', top: 20 });
    expect(getCatalog('mine')?.rule).toEqual({ kind: 'mine' });
  });

  it('id 유효성 규칙', () => {
    expect(isValidCatalogId('weekly_pick')).toBe(true);
    expect(isValidCatalogId('Weekly')).toBe(false);
    expect(isValidCatalogId('')).toBe(false);
    expect(isValidCatalogId('a'.repeat(49))).toBe(false);
  });
});

describe('applyCatalogConfig — 머지', () => {
  it('빌트인의 라벨·이모지·순서를 오버라이드한다', () => {
    const r = applyCatalogConfig({
      version: 1,
      catalogs: { featured: { label: '이주의 추천', emoji: '⭐', order: 9 } },
    });
    expect(r.applied).toEqual(['featured']);

    const featured = getCatalog('featured')!;
    expect(featured.label).toBe('이주의 추천');
    expect(featured.emoji).toBe('⭐');
    expect(featured.order).toBe(9);
    // 지정 안 한 필드는 코드 기본값 유지
    expect(featured.rule).toEqual({ kind: 'reaction', field: 'reactionGod', min: 3 });
    // order 변경이 정렬에 반영
    expect(getCatalogs().at(-1)!.id).toBe('featured');
  });

  it('hidden 은 기본 목록에서 빠지고 includeHidden 으로만 보인다', () => {
    applyCatalogConfig({ catalogs: { hall: { hidden: true } } });
    expect(getCatalogs().map(c => c.id)).not.toContain('hall');
    expect(getCatalogs({ includeHidden: true }).map(c => c.id)).toContain('hall');
  });

  it('커스텀 카탈로그를 추가한다 (order 누락 시 빌트인 뒤)', () => {
    applyCatalogConfig({
      catalogs: { weekly_pick: { label: '이번주 추천', emoji: '🗓' } },
    });
    const custom = getCatalog('weekly_pick')!;
    expect(custom.label).toBe('이번주 추천');
    expect(custom.order).toBe(DEFAULT_CATALOGS.length);
    expect(isBuiltinCatalogId('weekly_pick')).toBe(false);
    expect(getCatalogs().at(-1)!.id).toBe('weekly_pick');
  });

  it('수동 큐레이션 목록을 보존한다', () => {
    applyCatalogConfig({
      catalogs: { featured: { pinnedMapIds: ['a', 'b'], excludedMapIds: ['c'] } },
    });
    expect(getCatalog('featured')!.pinnedMapIds).toEqual(['a', 'b']);
    expect(getCatalog('featured')!.excludedMapIds).toEqual(['c']);
  });

  it('재적용은 이전 오버라이드를 대체한다', () => {
    applyCatalogConfig({ catalogs: { featured: { label: '1차' } } });
    applyCatalogConfig({ catalogs: { original: { label: '2차' } } });
    expect(getCatalog('featured')!.label).toBe('추천');
    expect(getCatalog('original')!.label).toBe('2차');
    expect(Object.keys(getCatalogOverrides())).toEqual(['original']);
  });
});

describe('손상 방어 — throw 없이 기본값 폴백', () => {
  const BAD: unknown[] = [
    null,
    undefined,
    'nope',
    42,
    { catalogs: null },
    { catalogs: [] },              // 배열은 맵이 아님
    { catalogs: 'x' },
  ];

  it.each(BAD.map((v, i) => [i, v]))('손상 문서 #%i 는 기본값을 유지한다', (_i, doc) => {
    expect(() => applyCatalogConfig(doc)).not.toThrow();
    expect(getCatalogs().map(c => c.id)).toEqual(['featured', 'original', 'recent', 'hall', 'mine']);
  });

  it('잘못된 엔트리만 skip 하고 나머지는 적용한다', () => {
    const r = applyCatalogConfig({
      catalogs: {
        featured: { label: '살아남음' },
        original: 'not-an-object',
        recent: [],
        hall: {},                       // 유효 필드 0개
        'Bad Id': { label: '무시' },     // id 규칙 위반 (커스텀)
        no_label: { emoji: '❓' },        // 커스텀인데 라벨 없음
      },
    });
    expect(r.applied).toEqual(['featured']);
    expect(r.skipped.sort()).toEqual(['Bad Id', 'hall', 'no_label', 'original', 'recent']);
    expect(getCatalog('featured')!.label).toBe('살아남음');
    expect(getCatalogs().map(c => c.id)).toEqual(['featured', 'original', 'recent', 'hall', 'mine']);
  });

  it('규칙이 손상되면 규칙만 떨어지고 나머지는 살린다', () => {
    applyCatalogConfig({
      catalogs: {
        original: { label: '원본2', rule: { kind: 'author' } },        // author 누락
        featured: { rule: { kind: 'reaction', field: 'nope' } },        // field 불량
      },
    });
    expect(getCatalog('original')!.label).toBe('원본2');
    expect(getCatalog('original')!.rule).toEqual({ kind: 'author', author: 'RayOriginal' }); // 기본값 유지
    expect(getCatalog('featured')!.rule).toEqual({ kind: 'reaction', field: 'reactionGod', min: 3 });
  });

  it('문자열 아닌 mapId 는 걸러낸다', () => {
    applyCatalogConfig({
      catalogs: { mine: { pinnedMapIds: ['ok', 3, null, ''] } },
    });
    expect(getCatalog('mine')!.pinnedMapIds).toEqual(['ok']);
  });
});
