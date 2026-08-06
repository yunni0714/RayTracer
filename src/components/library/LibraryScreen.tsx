import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSearchParams } from 'react-router-dom';
import { useGameStore } from '../../store/gameStore';
import { fetchLibraryList } from '../../lib/firebaseService';
import { getCatalogs, type CatalogDef, type CatalogSort, type SortKey } from '../../lib/catalogConfig';
import { selectCatalogMaps, needsLogin, sortMapsBy } from '../../lib/catalogRules';
import { computeMapCategory, CATEGORY_LABELS, CATEGORY_ORDER, type MapCategory } from '../../lib/mapCategory';
import { getAllMapStates } from '../../hooks/useMapReactions';
import { mapDocToGrid } from '../../lib/mapGrid';
import { MapCard } from './MapCard';
import { MiniGrid } from './MiniGrid';
import { MapCategoryBadge } from './MapCategoryBadge';
import { SuppliedPieces } from './SuppliedPieces';
import { Button, TextInput, Select, Tabs, Pill, cx, type PillTone } from '../ui';
import type { MapDocument, Difficulty } from '../../types/game';

const DIFF_TONE: Record<Difficulty, PillTone> = {
  Tutor: 'tutor', Easy: 'easy', Normal: 'normal', Hard: 'hard', Insane: 'insane',
};

const DIFFICULTIES: Difficulty[] = ['Tutor', 'Easy', 'Normal', 'Hard', 'Insane'];
const GRID_SIZES = [5, 6, 7, 8, 9];

/* 정렬 옵션 — 값은 "키:방향". 'catalog' 만 예외(카탈로그 정의를 따른다). */
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'catalog', label: '카탈로그 기본 정렬' },
  { value: 'createdAt:desc', label: '최신 등록순' },
  { value: 'createdAt:asc', label: '오래된 등록순' },
  { value: 'reactionGod:desc', label: '👍 많은순' },
  { value: 'reactionGod:asc', label: '👍 적은순' },
  { value: 'reactionOk:desc', label: '✅ 많은순' },
  { value: 'reactionOk:asc', label: '✅ 적은순' },
  { value: 'difficulty:desc', label: '공식 난이도 높은순' },
  { value: 'difficulty:asc', label: '공식 난이도 낮은순' },
  { value: 'pieceCount:desc', label: '기물 많은순' },
  { value: 'pieceCount:asc', label: '기물 적은순' },
  { value: 'gridSize:desc', label: '그리드 큰순' },
  { value: 'gridSize:asc', label: '그리드 작은순' },
  { value: 'title:asc', label: '제목 ㄱ→ㅎ' },
  { value: 'title:desc', label: '제목 ㅎ→ㄱ' },
];

function parseSort(value: string): CatalogSort | undefined {
  if (value === 'catalog') return undefined;
  const [by, dir] = value.split(':');
  return { by: by as SortKey, dir: dir === 'asc' ? 'asc' : 'desc' };
}

type PlayFilter = 'all' | 'unplayed' | 'played';
type ReactFilter = 'all' | 'reacted' | 'unreacted';

interface Filters {
  difficulties: Difficulty[];
  categories: MapCategory[];
  gridSizes: number[];
  play: PlayFilter;
  react: ReactFilter;
}

const EMPTY_FILTERS: Filters = {
  difficulties: [], categories: [], gridSizes: [], play: 'all', react: 'all',
};

function activeFilterCount(f: Filters): number {
  return f.difficulties.length + f.categories.length + f.gridSizes.length
    + (f.play === 'all' ? 0 : 1) + (f.react === 'all' ? 0 : 1);
}

function calculateUserDifficulty(diffVotes: Partial<Record<Difficulty, number>>): Difficulty | null {
  const entries = Object.entries(diffVotes) as [Difficulty, number][];
  if (entries.length === 0) return null;
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

const DEFAULT_CATALOG_ID = 'recent';

function catalogLabel(c: CatalogDef): string {
  return c.emoji ? `${c.emoji} ${c.label}` : c.label;
}

// 다중 선택 칩 (세부 필터 공용)
function FilterChips<T extends string | number>({ options, values, labelOf, onToggle }: {
  options: readonly T[]; values: T[]; labelOf: (v: T) => string; onToggle: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map(opt => {
        const on = values.includes(opt);
        return (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onToggle(opt)}
            className={cx(
              'px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors',
              on ? 'bg-accent-soft border-accent text-ink' : 'border-line text-ink-muted hover:bg-surface-2',
            )}
          >
            {labelOf(opt)}
          </button>
        );
      })}
    </div>
  );
}

// 선택 맵 미리보기 (우 존 / 모바일 하단 시트 공용)
function MapPreview({ map, onPlay }: { map: MapDocument; onPlay: (m: MapDocument) => void }) {
  const userDiff = calculateUserDifficulty(map.diffVotes);
  return (
    <div className="flex flex-col gap-3">
      <MiniGrid mapData={map.mapData} hideInventory variant="v2" gridSize={map.gridSize ?? 5} />
      <div>
        <h4 className="text-base font-extrabold tracking-tight text-ink truncate" title={map.title}>
          {map.title || '제목 없음'}
        </h4>
        <p className="text-xs text-ink-muted">{map.author}</p>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <MapCategoryBadge mapData={map.mapData} />
        <Pill tone={DIFF_TONE[map.difficulty]}>공식: {map.difficulty}</Pill>
        <Pill tone={userDiff ? DIFF_TONE[userDiff] : 'none'}>평가: {userDiff ?? 'None'}</Pill>
      </div>
      {map.description && (
        <p className="text-xs text-ink-muted leading-relaxed whitespace-pre-wrap">{map.description}</p>
      )}
      <div className="flex gap-3.5 text-sm font-bold">
        <span className="text-success">✅ {map.reactionOk}</span>
        <span className="text-danger">👍 {map.reactionGod}</span>
      </div>
      {/* 플레이 중 지급되는 기물 — 무엇으로 푸는 맵인지 미리 보여준다 */}
      <SuppliedPieces mapData={map.mapData} />
      <Button variant="success" size="md" block onClick={() => onPlay(map)} data-testid="library-play">
        ▶ 플레이
      </Button>
    </div>
  );
}

export function LibraryScreen() {
  const {
    allLibraryMaps, setAllLibraryMaps, setLibraryMode, resetEditorState, requestConfirm,
    currentUserUid,
  } = useGameStore(useShallow(s => ({
    allLibraryMaps: s.allLibraryMaps,
    setAllLibraryMaps: s.setAllLibraryMaps,
    setLibraryMode: s.setLibraryMode,
    resetEditorState: s.resetEditorState,
    requestConfirm: s.requestConfirm,
    currentUserUid: s.currentUserUid,
  })));

  useGameStore(s => s.catalogConfigRev); // 카탈로그 config 갱신 시 리렌더
  useGameStore(s => s.pieceConfigRev);   // 기물 폴더 변경 → category 조건 결과 변화

  const [, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  // 사용자가 정렬을 직접 고르면 그 세션 동안 카탈로그 정렬보다 우선한다
  const [sortValue, setSortValue] = useState<string>('catalog');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeCatalogId, setActiveCatalogId] = useState<string>(DEFAULT_CATALOG_ID);
  const [selected, setSelected] = useState<MapDocument | null>(null);

  const catalogs = getCatalogs();
  const activeCatalog = catalogs.find(c => c.id === activeCatalogId) ?? catalogs[0];
  const sortOverride = parseSort(sortValue);

  // 반응/플레이 상태 — 카탈로그 조건·세부 필터·카드 발광이 같은 스냅샷을 쓴다.
  // 목록을 새로 받을 때마다 갱신 (플레이 후 라이브러리로 돌아오면 반영된다).
  const [mapStates, setMapStates] = useState(getAllMapStates);
  useEffect(() => { setMapStates(getAllMapStates()); }, [allLibraryMaps]);

  // 서버 조회는 limit(50) 이라 정렬 키에 따라 표본이 달라진다 — 사용자가 God 정렬을
  // 고르면 그 기준으로 다시 받아온다. 그 외에는 최신순으로 받고 선별/정렬은 클라이언트.
  const fetchKey: 'createdAt' | 'reactionGod' = sortOverride?.by === 'reactionGod' ? 'reactionGod' : 'createdAt';
  useEffect(() => {
    setLoading(true);
    fetchLibraryList(fetchKey)
      .then(setAllLibraryMaps)
      .finally(() => setLoading(false));
  }, [fetchKey, setAllLibraryMaps]);

  function playMap(map: MapDocument) {
    const s = useGameStore.getState();
    if (s.isAnswerShown) s.hideAnswer();
    if (s.isMapEditMode) s.exitMapEditMode({ restore: false });

    s.loadMapForPlay(mapDocToGrid(map), map);
    setLibraryMode(false);
    s.showNotification(`[${map.title}] 플레이를 시작합니다!`, '#27ae60');
  }

  async function createNewMap() {
    if (!(await requestConfirm({ message: '진행 중인 맵이 모두 초기화되고 빈 에디터로 돌아갑니다. 새로 만드시겠습니까?' }))) return;
    resetEditorState();
    setLibraryMode(false);
    setSearchParams({});
    useGameStore.getState().showNotification('새로운 맵이 생성되었습니다!', '#e67e22');
  }

  function toggleIn<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter(v => v !== value) : [...list, value];
  }

  // 세부 필터 — 카탈로그/검색 결과 위에 얹는다 (교집합)
  function passesFilters(map: MapDocument): boolean {
    const { difficulties, categories, gridSizes, play, react } = filters;
    if (difficulties.length && !difficulties.includes(map.difficulty)) return false;
    if (categories.length && !categories.includes(computeMapCategory(map.mapData))) return false;
    if (gridSizes.length && !gridSizes.includes(map.gridSize ?? 5)) return false;

    const state = mapStates[map.id];
    if (play === 'unplayed' && state !== undefined) return false;
    if (play === 'played' && state === undefined) return false;

    const reacted = !!state && (state.ok || state.god);
    if (react === 'reacted' && !reacted) return false;
    if (react === 'unreacted' && reacted) return false;
    return true;
  }

  // 검색어가 있으면 카탈로그 무관 전체에서 부분일치
  const isSearching = search.trim() !== '';
  let visibleMaps: MapDocument[];
  if (isSearching) {
    const q = search.toLowerCase();
    const hits = allLibraryMaps.filter(m =>
      m.title.toLowerCase().includes(q) || m.author.toLowerCase().includes(q)
    );
    visibleMaps = sortOverride ? sortMapsBy(hits, sortOverride) : hits;
  } else if (activeCatalog) {
    // 사용자가 정렬을 직접 고르면 카탈로그 정렬을 덮어쓴다
    visibleMaps = selectCatalogMaps(
      sortOverride ? { ...activeCatalog, sort: sortOverride } : activeCatalog,
      allLibraryMaps,
      { uid: currentUserUid, mapStates },
    );
  } else {
    visibleMaps = allLibraryMaps;
  }
  const filterCount = activeFilterCount(filters);
  if (filterCount > 0) visibleMaps = visibleMaps.filter(passesFilters);

  const emptyMessage =
    activeCatalog && needsLogin(activeCatalog) && !currentUserUid && !isSearching
      ? '로그인하면 표시됩니다.'
      : filterCount > 0
        ? '세부 필터에 맞는 맵이 없습니다.'
        : '맵이 없습니다.';

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-canvas text-ink">

      {/* ① 좌 존 (데스크탑): 카탈로그 내비 — 정의는 catalogConfig 단일 소스 */}
      <aside className="hidden lg:flex w-56 shrink-0 bg-surface border-r border-line p-3 flex-col gap-1">
        <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted mb-1">카탈로그</h5>
        <div className="flex flex-col gap-1 overflow-y-auto">
          {catalogs.map(c => (
            <Button
              key={c.id}
              variant={activeCatalog?.id === c.id && !isSearching ? 'accent' : 'ghost'}
              block
              className="justify-start"
              onClick={() => { setActiveCatalogId(c.id); setSearch(''); }}
            >
              {catalogLabel(c)}
            </Button>
          ))}
        </div>
        <div className="mt-auto border-t border-line pt-3">
          <Button variant="warning" block onClick={createNewMap}>
            ✨ 새 맵 만들기
          </Button>
        </div>
      </aside>

      {/* ①′ 모바일: 카탈로그 = 상단 세그먼트 */}
      <div className="lg:hidden shrink-0 p-2 bg-surface border-b border-line overflow-x-auto hide-scrollbar">
        <Tabs
          variant="segment"
          items={catalogs.map(c => ({ id: c.id, label: catalogLabel(c) }))}
          value={isSearching ? '' : (activeCatalog?.id ?? '')}
          onChange={(id) => { setActiveCatalogId(id); setSearch(''); }}
          className="whitespace-nowrap"
        />
      </div>

      {/* ② 중앙: 선택 카탈로그 맵 그리드 */}
      <section className="flex-1 overflow-y-auto p-4 min-h-0">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <TextInput
            type="text"
            placeholder="맵 제목, 제작자 이름으로 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 !w-auto min-w-[160px]"
          />
          <Select
            value={sortValue}
            onChange={e => setSortValue(e.target.value)}
            className="!w-auto cursor-pointer"
            aria-label="정렬"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Button
            variant={filterCount > 0 ? 'accent' : 'secondary'}
            onClick={() => setFilterOpen(v => !v)}
            aria-expanded={filterOpen}
          >
            {filterOpen ? '▾' : '▸'} 세부 필터{filterCount > 0 ? ` (${filterCount})` : ''}
          </Button>
          <Button variant="warning" className="lg:hidden" onClick={createNewMap}>
            ✨ 새 맵
          </Button>
        </div>

        {filterOpen && (
          <div className="mb-4 border border-line rounded-tile bg-surface p-3 flex flex-col gap-2.5">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">공식 난이도</span>
              <FilterChips
                options={DIFFICULTIES}
                values={filters.difficulties}
                labelOf={d => d}
                onToggle={d => setFilters(f => ({ ...f, difficulties: toggleIn(f.difficulties, d) }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">카테고리</span>
              <FilterChips
                options={CATEGORY_ORDER}
                values={filters.categories}
                labelOf={c => CATEGORY_LABELS[c]}
                onToggle={c => setFilters(f => ({ ...f, categories: toggleIn(f.categories, c) }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">그리드 크기</span>
              <FilterChips
                options={GRID_SIZES}
                values={filters.gridSizes}
                labelOf={n => `${n}×${n}`}
                onToggle={n => setFilters(f => ({ ...f, gridSizes: toggleIn(f.gridSizes, n) }))}
              />
            </div>
            <div className="flex gap-3 flex-wrap items-end">
              <label className="flex flex-col gap-1 text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">
                플레이 여부
                <Select
                  value={filters.play}
                  onChange={e => setFilters(f => ({ ...f, play: e.target.value as PlayFilter }))}
                  className="!w-auto !text-xs !py-1 font-medium normal-case tracking-normal text-ink"
                >
                  <option value="all">전체</option>
                  <option value="unplayed">아직 안 한 맵</option>
                  <option value="played">플레이한 맵</option>
                </Select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">
                내 반응
                <Select
                  value={filters.react}
                  onChange={e => setFilters(f => ({ ...f, react: e.target.value as ReactFilter }))}
                  className="!w-auto !text-xs !py-1 font-medium normal-case tracking-normal text-ink"
                >
                  <option value="all">전체</option>
                  <option value="reacted">반응한 맵</option>
                  <option value="unreacted">반응 안 한 맵</option>
                </Select>
              </label>
              <Button
                variant="ghost"
                className="ml-auto"
                onClick={() => setFilters(EMPTY_FILTERS)}
                disabled={filterCount === 0}
              >
                필터 초기화
              </Button>
            </div>
            <p className="text-[10px] text-ink-muted">
              플레이·반응 필터는 이 브라우저에 저장된 기록 기준입니다.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12 text-ink-muted">불러오는 중...</div>
        ) : visibleMaps.length === 0 ? (
          <div className="flex justify-center py-12 text-ink-muted">{emptyMessage}</div>
        ) : (
          <div
            className="grid gap-4 pb-8"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
          >
            {visibleMaps.map(map => {
              const state = mapStates[map.id];
              return (
                <MapCard
                  key={map.id}
                  map={map}
                  selected={selected?.id === map.id}
                  reacted={{ ok: !!state?.ok, god: !!state?.god }}
                  onClick={setSelected}
                  onDoubleClick={playMap}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ③ 우 존 (데스크탑): 선택 맵 미리보기 + ▶ 플레이 */}
      <aside className="hidden lg:flex w-72 shrink-0 bg-surface border-l border-line p-4 flex-col overflow-y-auto">
        {selected ? (
          <MapPreview map={selected} onPlay={playMap} />
        ) : (
          <p className="text-xs text-ink-muted text-center mt-8">
            맵을 선택하면 미리보기가 표시됩니다.<br />카드를 더블클릭하면 바로 플레이합니다.
          </p>
        )}
      </aside>

      {/* ③′ 모바일: 선택 시 하단 시트 미리보기 */}
      {selected && (
        <div className={cx(
          'lg:hidden shrink-0 max-h-[55vh] overflow-y-auto',
          'bg-surface border-t border-line p-4 shadow-cardhover',
        )}>
          <div className="flex justify-end mb-1">
            <Button variant="ghost" onClick={() => setSelected(null)} aria-label="미리보기 닫기">
              ✕ 닫기
            </Button>
          </div>
          <MapPreview map={selected} onPlay={playMap} />
        </div>
      )}
    </div>
  );
}
