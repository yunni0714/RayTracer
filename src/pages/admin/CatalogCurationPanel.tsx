import { useState } from 'react';
import { MiniGrid } from '../../components/library/MiniGrid';
import { Button, IconButton, Pill } from '../../components/ui';
import { MapPickerModal } from './MapPickerModal';
import type { MapDocument } from '../../types/game';

/* 수동 큐레이션 — 규칙과 무관하게 고정할 맵 / 제외할 맵.
   제외가 고정보다 우선한다 (catalogRules.selectCatalogMaps 평가 순서). */

interface ListProps {
  title: string;
  hint: string;
  ids: string[];
  maps: MapDocument[];
  loading?: boolean;
  onChange: (ids: string[]) => void;
}

function MapIdList({ title, hint, ids, maps, loading, onChange }: ListProps) {
  const [picking, setPicking] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <h6 className="text-[11px] font-extrabold text-ink">{title}</h6>
        <Pill tone="neutral" className="!text-[9px] !px-1 !py-0">{ids.length}</Pill>
        <Button variant="secondary" className="!text-xs ml-auto" onClick={() => setPicking(true)}>
          ＋ 맵 추가
        </Button>
      </div>
      <p className="text-[10px] text-ink-muted">{hint}</p>

      {ids.length === 0 ? (
        <p className="text-[11px] text-ink-muted py-1">없음</p>
      ) : (
        <div className="flex flex-col gap-1">
          {ids.map(id => {
            const map = maps.find(m => m.id === id);
            return (
              <div key={id} className="flex items-center gap-2 p-1 border border-line rounded-tile">
                <span className="w-8 shrink-0">
                  {map
                    ? <MiniGrid mapData={map.mapData} revealRotation variant="v2" gridSize={map.gridSize ?? 5} />
                    : <span className="block w-8 h-8 rounded bg-surface-2" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[11px] font-bold truncate">
                    {map?.title ?? '(목록에 없는 맵)'}
                  </span>
                  <code className="block text-[9px] text-ink-muted truncate">{id}</code>
                </span>
                <IconButton
                  aria-label="제거"
                  className="!text-[10px] !px-1 !py-1"
                  onClick={() => onChange(ids.filter(x => x !== id))}
                >✕</IconButton>
              </div>
            );
          })}
        </div>
      )}

      {picking && (
        <MapPickerModal
          title={title}
          maps={maps}
          selectedIds={ids}
          loading={loading}
          onClose={() => setPicking(false)}
          onConfirm={next => { onChange(next); setPicking(false); }}
        />
      )}
    </div>
  );
}

interface Props {
  pinnedMapIds: string[];
  excludedMapIds: string[];
  maps: MapDocument[];
  loading?: boolean;
  onChange: (patch: { pinnedMapIds?: string[]; excludedMapIds?: string[] }) => void;
}

export function CatalogCurationPanel({ pinnedMapIds, excludedMapIds, maps, loading, onChange }: Props) {
  return (
    <section className="flex flex-col gap-3 border border-line rounded-tile p-3">
      <div className="flex items-center gap-2">
        <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">수동 큐레이션</h5>
        <span className="text-[11px] text-ink-muted">제외가 고정보다 우선합니다.</span>
      </div>

      <MapIdList
        title="📌 고정 맵"
        hint="규칙에 걸리지 않아도 항상 포함되고 목록 맨 앞에 표시됩니다."
        ids={pinnedMapIds}
        maps={maps}
        loading={loading}
        onChange={ids => onChange({ pinnedMapIds: ids })}
      />

      <MapIdList
        title="🚫 제외 맵"
        hint="규칙에 걸려도 이 카탈로그에서는 빠집니다."
        ids={excludedMapIds}
        maps={maps}
        loading={loading}
        onChange={ids => onChange({ excludedMapIds: ids })}
      />
    </section>
  );
}
