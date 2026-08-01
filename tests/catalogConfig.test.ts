import { describe, it, expect, afterEach } from 'vitest';
import {
  applyCatalogConfig, resetCatalogConfig, getCatalogs, getCatalog,
  getCatalogOverrides, isBuiltinCatalogId, isValidCatalogId,
  sanitizeCondition, getBuiltinCatalog, getCustomCatalogIds,
  DEFAULT_CATALOGS,
} from '../src/lib/catalogConfig';

afterEach(() => resetCatalogConfig());

describe('코드 기본값', () => {
  it('config 없이 빌트인 5종을 order 순으로 노출한다', () => {
    const list = getCatalogs();
    expect(list.map(c => c.id)).toEqual(['featured', 'original', 'recent', 'hall', 'mine']);
    expect(list.every(c => isBuiltinCatalogId(c.id))).toBe(true);
  });

  it('예전 LibraryScreen 하드코딩 필터와 같은 조건을 담고 있다', () => {
    expect(getCatalog('featured')?.conditions).toEqual([{ kind: 'reaction', field: 'reactionGod', min: 3 }]);
    expect(getCatalog('original')?.conditions).toEqual([{ kind: 'author', author: 'RayOriginal' }]);
    expect(getCatalog('recent')?.conditions).toEqual([]);
    expect(getCatalog('hall')?.conditions).toEqual([]);
    expect(getCatalog('hall')?.limit).toBe(20);
    expect(getCatalog('hall')?.sort).toEqual({ by: 'reactionGod', dir: 'desc' });
    expect(getCatalog('mine')?.conditions).toEqual([{ kind: 'mine', owned: true }]);
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
    expect(featured.conditions).toEqual([{ kind: 'reaction', field: 'reactionGod', min: 3 }]);
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

  it('손상된 조건만 떨어지고 같은 카탈로그의 나머지는 살린다', () => {
    applyCatalogConfig({
      catalogs: {
        original: {
          label: '원본2',
          conditions: [
            { kind: 'author' },                       // author 누락 → 버림
            { kind: 'difficulty', values: ['Hard'] }, // 유효 → 유지
            { kind: '없는종류' },                      // 미지 kind → 버림
          ],
        },
        featured: { conditions: [{ kind: 'reaction', field: 'nope' }] }, // 전부 버림 → 빈 조건
      },
    });
    expect(getCatalog('original')!.label).toBe('원본2');
    expect(getCatalog('original')!.conditions).toEqual([{ kind: 'difficulty', values: ['Hard'] }]);
    expect(getCatalog('featured')!.conditions).toEqual([]);
  });

  it('문자열 아닌 mapId 는 걸러낸다', () => {
    applyCatalogConfig({
      catalogs: { mine: { pinnedMapIds: ['ok', 3, null, ''] } },
    });
    expect(getCatalog('mine')!.pinnedMapIds).toEqual(['ok']);
  });
});

/* ── v2 스키마 ───────────────────────────────────────────── */

describe('sanitizeCondition — 조건별 검증', () => {
  const ok = (raw: unknown) => sanitizeCondition(raw);

  it('맵 속성 조건 13종 중 유효 입력은 정규화되어 통과', () => {
    expect(ok({ kind: 'author', author: '  Ray  ' })).toEqual({ kind: 'author', author: 'Ray' });
    expect(ok({ kind: 'reaction', field: 'reactionOk', min: 1, max: 9 }))
      .toEqual({ kind: 'reaction', field: 'reactionOk', min: 1, max: 9 });
    expect(ok({ kind: 'difficulty', values: ['Easy', 'Easy', 'Hard'] }))
      .toEqual({ kind: 'difficulty', values: ['Easy', 'Hard'] }); // 중복 제거
    expect(ok({ kind: 'category', values: ['logic'] })).toEqual({ kind: 'category', values: ['logic'] });
    expect(ok({ kind: 'recent', days: 7.9 })).toEqual({ kind: 'recent', days: 7 });
    expect(ok({ kind: 'gridSize', min: 7 })).toEqual({ kind: 'gridSize', min: 7 });
    expect(ok({ kind: 'pieceCount', max: 10 })).toEqual({ kind: 'pieceCount', max: 10 });
    expect(ok({ kind: 'containsPiece', types: ['cross_gate'] }))
      .toEqual({ kind: 'containsPiece', types: ['cross_gate'], mode: 'any' }); // mode 기본값
    expect(ok({ kind: 'titleContains', text: ' 튜토 ' })).toEqual({ kind: 'titleContains', text: '튜토' });
  });

  it('category — 구 스키마 id 는 현재 id 로 승격, 중복은 합쳐진다', () => {
    expect(ok({ kind: 'category', values: ['basic'] })).toEqual({ kind: 'category', values: ['classic'] });
    expect(ok({ kind: 'category', values: ['advanced_logic'] })).toEqual({ kind: 'category', values: ['advanced'] });
    expect(ok({ kind: 'category', values: ['advanced', 'advanced_logic'] }))
      .toEqual({ kind: 'category', values: ['advanced'] });
    expect(ok({ kind: 'category', values: ['없는카테고리'] })).toBeUndefined();
  });

  it('사용자 기준 조건은 불리언 기본값이 true', () => {
    expect(ok({ kind: 'mine' })).toEqual({ kind: 'mine', owned: true });
    expect(ok({ kind: 'played', played: false })).toEqual({ kind: 'played', played: false });
    expect(ok({ kind: 'reacted' })).toEqual({ kind: 'reacted', field: 'any', reacted: true });
    expect(ok({ kind: 'reacted', field: 'god', reacted: false }))
      .toEqual({ kind: 'reacted', field: 'god', reacted: false });
    expect(ok({ kind: 'voted' })).toEqual({ kind: 'voted', voted: true });
  });

  it('잘못된 입력은 undefined', () => {
    expect(ok(null)).toBeUndefined();
    expect(ok([])).toBeUndefined();
    expect(ok({ kind: 'author', author: '   ' })).toBeUndefined();
    expect(ok({ kind: 'reaction', field: 'nope' })).toBeUndefined();
    expect(ok({ kind: 'difficulty', values: ['Ultra'] })).toBeUndefined();   // 허용 목록 밖
    expect(ok({ kind: 'category', values: [] })).toBeUndefined();
    expect(ok({ kind: 'recent', days: 0 })).toBeUndefined();
    expect(ok({ kind: 'gridSize' })).toBeUndefined();                        // min/max 둘 다 없음
    expect(ok({ kind: 'containsPiece', types: 'mirror' })).toBeUndefined();  // 배열 아님
    expect(ok({ kind: '없는조건' })).toBeUndefined();
  });
});

describe('sort / limit / conditions 상한', () => {
  it('sort 는 허용 키만, dir 기본 desc', () => {
    applyCatalogConfig({ catalogs: { recent: { sort: { by: 'title' } } } });
    expect(getCatalog('recent')!.sort).toEqual({ by: 'title', dir: 'desc' });

    applyCatalogConfig({ catalogs: { recent: { sort: { by: '없는키' } } } });
    expect(getCatalog('recent')!.sort).toEqual({ by: 'createdAt', dir: 'desc' }); // 기본값 유지
  });

  it('limit 은 양수 정수만', () => {
    applyCatalogConfig({ catalogs: { recent: { limit: 5.7 } } });
    expect(getCatalog('recent')!.limit).toBe(5);
    applyCatalogConfig({ catalogs: { recent: { limit: -3 } } });
    expect(getCatalog('recent')!.limit).toBeUndefined();
  });

  it('조건 개수는 12개로 제한', () => {
    const many = Array.from({ length: 20 }, () => ({ kind: 'mine', owned: true }));
    applyCatalogConfig({ catalogs: { recent: { conditions: many } } });
    expect(getCatalog('recent')!.conditions!.length).toBe(12);
  });
});

describe('레거시 v1 rule 승격', () => {
  it('rule: all → 빈 조건', () => {
    applyCatalogConfig({ catalogs: { recent: { rule: { kind: 'all' } } } });
    expect(getCatalog('recent')!.conditions).toEqual([]);
  });

  it('rule: mine → mine 조건', () => {
    applyCatalogConfig({ catalogs: { mine: { rule: { kind: 'mine' } } } });
    expect(getCatalog('mine')!.conditions).toEqual([{ kind: 'mine', owned: true }]);
  });

  it('rule: author → author 조건', () => {
    applyCatalogConfig({ catalogs: { original: { rule: { kind: 'author', author: 'Kim' } } } });
    expect(getCatalog('original')!.conditions).toEqual([{ kind: 'author', author: 'Kim' }]);
  });

  it('rule: reaction top → limit + sort 로 승격', () => {
    applyCatalogConfig({ catalogs: { hall: { rule: { kind: 'reaction', field: 'reactionGod', top: 7 } } } });
    const c = getCatalog('hall')!;
    expect(c.conditions).toEqual([{ kind: 'reaction', field: 'reactionGod' }]);
    expect(c.limit).toBe(7);
    expect(c.sort).toEqual({ by: 'reactionGod', dir: 'desc' });
  });

  it('conditions 가 있으면 rule 은 무시된다', () => {
    applyCatalogConfig({
      catalogs: {
        recent: {
          conditions: [{ kind: 'difficulty', values: ['Tutor'] }],
          rule: { kind: 'author', author: 'Kim' },
        },
      },
    });
    expect(getCatalog('recent')!.conditions).toEqual([{ kind: 'difficulty', values: ['Tutor'] }]);
  });
});

describe('getBuiltinCatalog / getCustomCatalogIds', () => {
  it('빌트인 원본 정의를 복사해 돌려준다 (기본값 되돌리기용)', () => {
    applyCatalogConfig({ catalogs: { featured: { label: '변경됨' } } });
    expect(getCatalog('featured')!.label).toBe('변경됨');
    expect(getBuiltinCatalog('featured')!.label).toBe('추천');
    expect(getBuiltinCatalog('없음')).toBeUndefined();

    const clone = getBuiltinCatalog('featured')!;
    clone.label = '수정 시도';
    expect(getBuiltinCatalog('featured')!.label).toBe('추천'); // 원본 불변
  });

  it('커스텀 id 만 골라낸다', () => {
    applyCatalogConfig({
      catalogs: { featured: { label: 'x' }, weekly: { label: '이번주' } },
    });
    expect(getCustomCatalogIds()).toEqual(['weekly']);
  });
});
