import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { updateMapInDB } from '../../lib/firebaseService';
import { getSvgArt } from '../../lib/svgArt';
import { getPieceLabel } from '../../lib/pieceActions';
import {
  ROTATIONS, findItemIndexAt, rotateMapItem, setMapItemRotation,
} from '../../lib/adminMaps';
import { Button, Select, Pill, cx } from '../../components/ui';
import type { AdminMapsState } from './useAdminMaps';
import type { MapDocument, MapItemDTO } from '../../types/game';

/* 저장된 맵의 기물 각도 편집기 (ADMIN.html 회전 편집 패널 이식).
   저장된 rotation = 정답 회전이므로 그대로 렌더/저장한다 — 정규화 금지.
   회전 외 필드(좌표·특성·인벤토리 여부)는 건드리지 않는다. */

const DELTAS = [-90, -45, 45, 90] as const;

export function MapRotationEditor({
  map, admin, onClose,
}: { map: MapDocument; admin: AdminMapsState; onClose: () => void }) {
  const { showNotification, requestConfirm } = useGameStore(useShallow(s => ({
    showNotification: s.showNotification,
    requestConfirm: s.requestConfirm,
  })));

  const [items, setItems] = useState<MapItemDTO[]>(() => map.mapData.map(i => ({ ...i })));
  const [selected, setSelected] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const gridSize = map.gridSize ?? 5;
  const item = selected != null ? items[selected] : undefined;

  function apply(next: MapItemDTO[]) {
    setItems(next);
    setDirty(true);
  }

  async function handleClose() {
    if (dirty && !(await requestConfirm({
      message: '저장하지 않은 회전 변경이 있습니다. 버리고 닫을까요?', danger: true,
    }))) return;
    onClose();
  }

  async function save() {
    setSaving(true);
    try {
      await updateMapInDB(map.id, { mapData: items });
      admin.patchMap(map.id, { mapData: items });
      setDirty(false);
      showNotification(`[${map.title}] 회전 저장 완료.`);
    } catch (err) {
      const code = err instanceof Error ? ((err as { code?: string }).code ?? err.message) : String(err);
      showNotification(`저장 실패 — ${code}`, '#e74c3c');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4 flex-wrap items-start">
        {/* 인터랙티브 그리드 — 기물 클릭으로 선택 */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-ink-muted">그리드 클릭 → 기물 선택</span>
          <div
            className="grid border border-line bg-[var(--cell)]"
            style={{
              gridTemplateColumns: `repeat(${gridSize}, 44px)`,
              gridTemplateRows: `repeat(${gridSize}, 44px)`,
            }}
          >
            {Array.from({ length: gridSize }, (_, row) =>
              Array.from({ length: gridSize }, (_, col) => {
                const idx = findItemIndexAt(items, col, row);
                const cell = idx >= 0 ? items[idx] : null;
                return (
                  <button
                    key={`${row}-${col}`}
                    type="button"
                    disabled={!cell}
                    onClick={() => setSelected(idx)}
                    className={cx(
                      'border border-[var(--cell-border)] flex items-center justify-center p-1 transition-colors',
                      cell ? 'cursor-pointer hover:bg-surface-2' : 'cursor-default',
                      idx >= 0 && idx === selected && 'bg-accent-soft ring-2 ring-accent',
                    )}
                    title={cell ? `${getPieceLabel(cell.type)} (${col}, ${row}) ${cell.rotation}°` : undefined}
                  >
                    {cell && (
                      <span
                        className="w-full h-full block"
                        style={{ transform: `rotate(${cell.rotation}deg)` }}
                        dangerouslySetInnerHTML={{ __html: getSvgArt(cell.type) }}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 선택 기물 컨트롤 */}
        <div className="flex-1 min-w-[240px] flex flex-col gap-2">
          {!item ? (
            <p className="text-[11px] text-ink-muted">
              기물을 클릭해 선택하세요. 모든 기물의 각도를 편집할 수 있습니다
              (회전 불가 기물 포함 — 저장된 값이 정답 회전입니다).
            </p>
          ) : (
            <>
              <div className="border border-line rounded-tile p-2 flex flex-col gap-1 bg-surface">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="w-6 h-6 shrink-0"
                    style={{ transform: `rotate(${item.rotation}deg)` }}
                    dangerouslySetInnerHTML={{ __html: getSvgArt(item.type) }}
                  />
                  <strong className="text-xs">{getPieceLabel(item.type)}</strong>
                  <code className="text-[10px] text-ink-muted">{item.type}</code>
                </div>
                <p className="text-[11px] text-ink-muted">
                  위치 ({item.x}, {item.y}) · 현재 <strong className="text-ink">{item.rotation}°</strong>
                </p>
                <div className="flex gap-1 flex-wrap">
                  {item.canRotate && <Pill tone="info" className="!text-[9px] !px-1 !py-0">🔄 회전 가능</Pill>}
                  {item.canMove && <Pill tone="info" className="!text-[9px] !px-1 !py-0">🖐 이동 가능</Pill>}
                  {item.isInventory && <Pill tone="neutral" className="!text-[9px] !px-1 !py-0">🎒 유저 지급</Pill>}
                </div>
              </div>

              <div className="flex gap-1 flex-wrap">
                {DELTAS.map(d => (
                  <Button
                    key={d}
                    variant="secondary"
                    className="!text-xs"
                    onClick={() => apply(rotateMapItem(items, selected!, d))}
                  >
                    {d < 0 ? '↺' : '↻'} {d > 0 ? `+${d}` : d}°
                  </Button>
                ))}
              </div>

              <label className="flex items-center gap-2 text-xs">
                직접 지정
                <Select
                  value={item.rotation}
                  onChange={e => apply(setMapItemRotation(items, selected!, Number(e.target.value)))}
                  className="!w-auto"
                >
                  {ROTATIONS.map(r => <option key={r} value={r}>{r}°</option>)}
                </Select>
              </label>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 justify-end items-center">
        {dirty && <Pill tone="danger">저장 안 됨</Pill>}
        <Button variant="secondary" onClick={handleClose}>닫기</Button>
        <Button variant="success" onClick={save} disabled={saving || !dirty}>
          {saving ? '저장 중…' : '💾 이 맵 저장'}
        </Button>
      </div>
    </div>
  );
}
