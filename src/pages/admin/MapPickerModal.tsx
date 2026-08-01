import { useMemo, useState } from 'react';
import { filterMaps } from '../../lib/adminMaps';
import { MiniGrid } from '../../components/library/MiniGrid';
import { Button, DifficultyPill, Modal, TextInput, cx } from '../../components/ui';
import type { MapDocument } from '../../types/game';

/* 맵 검색·다중 선택 모달 — 카탈로그 고정/제외 목록 편집에 쓴다.
   검색은 어드민 맵 관리와 같은 filterMaps() (제목·작성자 부분일치). */

interface Props {
  title: string;
  maps: MapDocument[];
  selectedIds: string[];
  loading?: boolean;
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}

export function MapPickerModal({ title, maps, selectedIds, loading, onClose, onConfirm }: Props) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string[]>(selectedIds);

  const visible = useMemo(() => filterMaps(maps, search).slice(0, 60), [maps, search]);

  function toggle(id: string) {
    setPicked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  return (
    <Modal
      title={title}
      width="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button variant="success" onClick={() => onConfirm(picked)}>
            {picked.length}개 적용
          </Button>
        </>
      }
    >
      <TextInput
        autoFocus
        placeholder="제목 또는 작성자 검색…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="max-h-[46vh] overflow-y-auto flex flex-col gap-1 -mx-1 px-1">
        {loading ? (
          <p className="py-6 text-center text-xs text-ink-muted">맵 목록 불러오는 중…</p>
        ) : visible.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-muted">
            {maps.length === 0 ? '맵이 없습니다.' : '검색 결과가 없습니다.'}
          </p>
        ) : visible.map(m => {
          const on = picked.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              className={cx(
                'flex items-center gap-2 p-1.5 rounded-tile border text-left transition-colors',
                on ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2',
              )}
            >
              <span className="w-10 shrink-0">
                <MiniGrid mapData={m.mapData} revealRotation variant="v2" gridSize={m.gridSize ?? 5} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-bold truncate">{m.title || '제목 없음'}</span>
                <span className="block text-[10px] text-ink-muted truncate">{m.author}</span>
              </span>
              <DifficultyPill difficulty={m.difficulty} />
              <span className={cx('w-4 text-center text-xs', on ? 'text-accent' : 'text-ink-muted')}>
                {on ? '✓' : ''}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-ink-muted">검색 결과는 최대 60개까지 표시됩니다.</p>
    </Modal>
  );
}
