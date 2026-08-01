import { getSvgArt } from '../../lib/svgArt';
import { getPieceLabel } from '../../lib/pieceActions';
import { invKey } from '../../store/gameStore';
import { useGameStore } from '../../store/gameStore';
import type { MapItemDTO } from '../../types/game';

/* 지급 기물 목록 — 맵의 isInventory 기물을 인벤토리와 같은 규칙으로 묶어 보여준다.
   회전 가능 기물은 rot 0 으로 정규화(invKey 규칙) — 정답 회전을 흘리지 않는다. */

interface Slot {
  key: string;
  type: string;
  rotation: number;
  count: number;
}

function collectSuppliedPieces(mapData: MapItemDTO[] | undefined): Slot[] {
  const slots = new Map<string, Slot>();
  for (const item of mapData ?? []) {
    if (!item.isInventory) continue;
    const key = invKey(item.type, item.canRotate, item.rotation);
    const existing = slots.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      slots.set(key, {
        key,
        type: item.type,
        rotation: item.canRotate ? 0 : (item.rotation || 0),
        count: 1,
      });
    }
  }
  return [...slots.values()];
}

export function SuppliedPieces({ mapData }: { mapData: MapItemDTO[] }) {
  useGameStore(s => s.pieceConfigRev); // SVG/라벨 오버레이 갱신 시 리렌더

  const slots = collectSuppliedPieces(mapData);

  return (
    <div className="flex flex-col gap-1.5">
      <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">
        지급 기물 {slots.length > 0 && <span className="font-normal">({slots.length}종)</span>}
      </h5>
      {slots.length === 0 ? (
        <p className="text-[11px] text-ink-muted">지급되는 기물이 없습니다 — 배치된 그대로 풉니다.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {slots.map(slot => (
            <div
              key={slot.key}
              title={`${getPieceLabel(slot.type)} ×${slot.count}`}
              className="relative w-11 h-11 p-1 rounded-tile border border-line bg-surface-2 flex items-center justify-center"
            >
              <span
                className="block w-full h-full"
                style={{ transform: `rotate(${slot.rotation}deg)` }}
                dangerouslySetInnerHTML={{ __html: getSvgArt(slot.type) }}
              />
              <span className="absolute -bottom-1 -right-1 px-1 rounded bg-primary text-primary-ink text-[10px] font-extrabold leading-tight">
                {slot.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
