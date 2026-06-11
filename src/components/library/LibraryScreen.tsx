import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSearchParams } from 'react-router-dom';
import { useGameStore } from '../../store/gameStore';
import { fetchLibraryList } from '../../lib/firebaseService';
import { MapCard } from './MapCard';
import { MiniGrid } from './MiniGrid';
import { Button, TextInput, Select, Tabs, Pill, cx, type PillTone } from '../ui';
import type { MapDocument, Difficulty } from '../../types/game';
import type { CellData, Rotation } from '../../types/game';

function mapDocToGrid(mapObj: MapDocument): (CellData | null)[][] {
  const size = mapObj.gridSize ?? 5;
  const grid: (CellData | null)[][] = Array.from({ length: size }, () =>
    Array(size).fill(null)
  );
  for (const item of mapObj.mapData) {
    if (item.y >= 0 && item.y < size && item.x >= 0 && item.x < size) {
      grid[item.y][item.x] = {
        type: item.type,
        rotation: item.rotation as Rotation,
        canMove: item.canMove,
        canRotate: item.canRotate,
        isInventory: item.isInventory,
      };
    }
  }
  return grid;
}

const DIFF_TONE: Record<Difficulty, PillTone> = {
  Tutor: 'tutor', Easy: 'easy', Normal: 'normal', Hard: 'hard', Insane: 'insane',
};

function calculateUserDifficulty(diffVotes: Partial<Record<Difficulty, number>>): Difficulty | null {
  const entries = Object.entries(diffVotes) as [Difficulty, number][];
  if (entries.length === 0) return null;
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

type Category = 'featured' | 'original' | 'recent' | 'hall' | 'mine';

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'featured', label: '🔥 추천' },
  { id: 'original', label: '🏛 원본' },
  { id: 'recent', label: '🕗 최근' },
  { id: 'hall', label: '🏆 명예의전당' },
  { id: 'mine', label: '👤 내 맵' },
];

const HALL_LIMIT = 20;

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
        <Pill tone={DIFF_TONE[map.difficulty]}>공식: {map.difficulty}</Pill>
        <Pill tone={userDiff ? DIFF_TONE[userDiff] : 'none'}>평가: {userDiff ?? 'None'}</Pill>
      </div>
      {map.description && (
        <p className="text-xs text-ink-muted leading-relaxed whitespace-pre-wrap">{map.description}</p>
      )}
      <div className="flex gap-3.5 text-sm font-bold">
        <span className="text-success">✅ {map.reactionOk}</span>
        <span className="text-danger">🔥 {map.reactionGod}</span>
      </div>
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

  const [, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'reactionGod'>('createdAt');
  const [activeCategory, setActiveCategory] = useState<Category>('recent');
  const [selected, setSelected] = useState<MapDocument | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchLibraryList(sortBy)
      .then(setAllLibraryMaps)
      .finally(() => setLoading(false));
  }, [sortBy, setAllLibraryMaps]);

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

  // 검색어가 있으면 카테고리 무관 전체에서 부분일치
  const isSearching = search.trim() !== '';
  let visibleMaps: MapDocument[];
  if (isSearching) {
    const q = search.toLowerCase();
    visibleMaps = allLibraryMaps.filter(m =>
      m.title.toLowerCase().includes(q) || m.author.toLowerCase().includes(q)
    );
  } else {
    switch (activeCategory) {
      case 'featured':
        visibleMaps = [...allLibraryMaps]
          .filter(m => (m.reactionGod ?? 0) >= 3)
          .sort((a, b) => (b.reactionGod ?? 0) - (a.reactionGod ?? 0));
        break;
      case 'original':
        visibleMaps = [...allLibraryMaps]
          .filter(m => m.author === 'RayOriginal')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'hall':
        visibleMaps = [...allLibraryMaps]
          .sort((a, b) => (b.reactionGod ?? 0) - (a.reactionGod ?? 0))
          .slice(0, HALL_LIMIT);
        break;
      case 'mine':
        visibleMaps = currentUserUid
          ? allLibraryMaps.filter(m => m.authorUid === currentUserUid)
          : [];
        break;
      default:
        visibleMaps = allLibraryMaps;
    }
  }

  const emptyMessage =
    activeCategory === 'mine' && !currentUserUid && !isSearching
      ? '로그인하면 내가 만든 맵이 표시됩니다.'
      : '맵이 없습니다.';

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-canvas text-ink">

      {/* ① 좌 존 (데스크탑): 카테고리 내비 */}
      <aside className="hidden lg:flex w-56 shrink-0 bg-surface border-r border-line p-3 flex-col gap-1">
        <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted mb-1">카테고리</h5>
        {CATEGORIES.map(c => (
          <Button
            key={c.id}
            variant={activeCategory === c.id && !isSearching ? 'accent' : 'ghost'}
            block
            className="justify-start"
            onClick={() => { setActiveCategory(c.id); setSearch(''); }}
          >
            {c.label}
          </Button>
        ))}
        <div className="mt-auto border-t border-line pt-3">
          <Button variant="warning" block onClick={createNewMap}>
            ✨ 새 맵 만들기
          </Button>
        </div>
      </aside>

      {/* ①′ 모바일: 카테고리 = 상단 세그먼트 */}
      <div className="lg:hidden shrink-0 p-2 bg-surface border-b border-line overflow-x-auto hide-scrollbar">
        <Tabs
          variant="segment"
          items={CATEGORIES.map(c => ({ id: c.id, label: c.label }))}
          value={isSearching ? '' : activeCategory}
          onChange={(id) => { setActiveCategory(id as Category); setSearch(''); }}
          className="whitespace-nowrap"
        />
      </div>

      {/* ② 중앙: 선택 카테고리 맵 그리드 */}
      <section className="flex-1 overflow-y-auto p-4 min-h-0">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <TextInput
            type="text"
            placeholder="맵 제목, 제작자 이름으로 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 !w-auto min-w-[160px]"
          />
          <Select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="!w-auto cursor-pointer"
            aria-label="정렬"
          >
            <option value="createdAt">최신 등록순</option>
            <option value="reactionGod">갓맵(👍)순</option>
          </Select>
          <Button variant="warning" className="lg:hidden" onClick={createNewMap}>
            ✨ 새 맵
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12 text-ink-muted">불러오는 중...</div>
        ) : visibleMaps.length === 0 ? (
          <div className="flex justify-center py-12 text-ink-muted">{emptyMessage}</div>
        ) : (
          <div
            className="grid gap-4 pb-8"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
          >
            {visibleMaps.map(map => (
              <MapCard
                key={map.id}
                map={map}
                selected={selected?.id === map.id}
                onClick={setSelected}
              />
            ))}
          </div>
        )}
      </section>

      {/* ③ 우 존 (데스크탑): 선택 맵 미리보기 + ▶ 플레이 */}
      <aside className="hidden lg:flex w-72 shrink-0 bg-surface border-l border-line p-4 flex-col overflow-y-auto">
        {selected ? (
          <MapPreview map={selected} onPlay={playMap} />
        ) : (
          <p className="text-xs text-ink-muted text-center mt-8">
            맵을 선택하면 미리보기가 표시됩니다.
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
