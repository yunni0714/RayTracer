import { useMemo, useState } from 'react';
import { filterMaps, sortMaps, type MapSortKey } from '../../lib/adminMaps';
import { Button, TextInput, Select, Pill } from '../../components/ui';
import { AdminMapRow } from './AdminMapRow';
import { BulkRotationModal, type BulkScope } from './BulkRotationModal';
import type { AdminMapsState } from './useAdminMaps';

/* [맵 마스터 › 맵 관리] — 전체 맵 목록/검색/정렬 + 행별 편집·제안·이전·삭제 + 일괄 회전.
   목록 상태는 MapMasterTab 소유 (admin prop).
   카드는 넓은 화면에서 2열 — 펼친 카드(메타/회전)만 전체 폭을 쓴다 (AdminMapRow 가 col-span). */

const SORT_LABELS: { id: MapSortKey; label: string }[] = [
  { id: 'createdAt', label: '최신순' },
  { id: 'reactionGod', label: '🌟 반응순' },
  { id: 'reactionOk', label: '👍 반응순' },
];

export function MapsTab({ admin }: { admin: AdminMapsState }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<MapSortKey>('createdAt');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);

  const visible = useMemo(
    () => sortMaps(filterMaps(admin.maps, search), sortBy),
    [admin.maps, search, sortBy],
  );

  // 삭제/재조회로 사라진 id 는 선택에서 제외 (스코프는 항상 실재 맵만)
  const selectedMaps = useMemo(
    () => admin.maps.filter(m => selectedIds.includes(m.id)),
    [admin.maps, selectedIds],
  );

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  // 스코프 객체는 참조 안정성이 필요하다 (BulkRotationModal 이 useMemo 의존성으로 쓴다)
  const scopes: BulkScope[] = useMemo(() => [
    ...(selectedMaps.length > 0
      ? [{ id: 'selected', label: '✅ 선택한 맵', maps: selectedMaps }]
      : []),
    { id: 'filtered', label: search.trim() ? '🔍 검색 결과' : '🗺 전체 맵', maps: visible },
    ...(search.trim() ? [{ id: 'all', label: '🗺 전체 맵', maps: admin.maps }] : []),
  ], [selectedMaps, search, visible, admin.maps]);

  return (
    <div className="h-full overflow-y-auto p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="secondary" onClick={admin.reload} disabled={admin.loading}>
          {admin.loading ? '불러오는 중…' : '🔄 새로고침'}
        </Button>
        <TextInput
          placeholder="제목 또는 작성자 검색…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 !w-auto min-w-[180px]"
        />
        <Select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as MapSortKey)}
          className="!w-auto cursor-pointer"
          aria-label="정렬"
        >
          {SORT_LABELS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
        <span className="text-[11px] text-ink-muted">{visible.length} / {admin.maps.length}</span>
      </div>

      {/* 선택 + 일괄 회전 */}
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-ink-muted">
        <Pill tone={selectedMaps.length > 0 ? 'info' : 'neutral'} className="!text-[9px] !px-1 !py-0">
          {selectedMaps.length}개 선택
        </Pill>
        <Button
          variant="ghost"
          className="!text-[11px] !px-1.5 !py-0.5"
          onClick={() => setSelectedIds(visible.map(m => m.id))}
          disabled={visible.length === 0}
        >
          목록 전체 선택
        </Button>
        <Button
          variant="ghost"
          className="!text-[11px] !px-1.5 !py-0.5"
          onClick={() => setSelectedIds([])}
          disabled={selectedIds.length === 0}
        >
          선택 해제
        </Button>
        <Button
          variant="accent"
          className="!text-xs ml-auto"
          onClick={() => setBulkOpen(true)}
          disabled={admin.maps.length === 0}
        >
          🎛 일괄 회전
        </Button>
      </div>

      {admin.error ? (
        <p className="py-10 text-center text-xs text-danger">
          맵 목록을 불러오지 못했습니다 — {admin.error}
        </p>
      ) : admin.loading ? (
        <p className="py-10 text-center text-xs text-ink-muted">불러오는 중…</p>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-xs text-ink-muted">
          {admin.maps.length === 0 ? '맵이 없습니다.' : '검색 결과가 없습니다.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 pb-8 items-start">
          {visible.map(map => (
            <AdminMapRow
              key={map.id}
              map={map}
              admin={admin}
              selected={selectedIds.includes(map.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {bulkOpen && (
        <BulkRotationModal scopes={scopes} admin={admin} onClose={() => setBulkOpen(false)} />
      )}
    </div>
  );
}
