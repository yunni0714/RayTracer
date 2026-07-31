import { useMemo, useState } from 'react';
import { filterMaps, sortMaps, type MapSortKey } from '../../lib/adminMaps';
import { Button, TextInput, Select } from '../../components/ui';
import { AdminMapRow } from './AdminMapRow';
import type { AdminMapsState } from './useAdminMaps';

/* [맵 마스터 › 맵 관리] — 전체 맵 목록/검색/정렬 + 행별 편집·이전·삭제.
   목록 상태는 MapMasterTab 소유 (admin prop). */

const SORT_LABELS: { id: MapSortKey; label: string }[] = [
  { id: 'createdAt', label: '최신순' },
  { id: 'reactionGod', label: '🌟 반응순' },
  { id: 'reactionOk', label: '👍 반응순' },
];

export function MapsTab({ admin }: { admin: AdminMapsState }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<MapSortKey>('createdAt');

  const visible = useMemo(
    () => sortMaps(filterMaps(admin.maps, search), sortBy),
    [admin.maps, search, sortBy],
  );

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
        <div className="flex flex-col gap-2 pb-8">
          {visible.map(map => (
            <AdminMapRow key={map.id} map={map} admin={admin} />
          ))}
        </div>
      )}
    </div>
  );
}
