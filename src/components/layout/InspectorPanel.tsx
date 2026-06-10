import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">
      {children}
    </h5>
  );
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-ink-muted">{label}</span>
      <span className="font-bold text-ink">{value}</span>
    </div>
  );
}

// 우 존 — 편집 모드 인스펙터: 맵 통계 + (Phase 5에서 선택 기물 편집이 들어올 자리)
export function InspectorPanel() {
  const { mapData } = useGameStore(useShallow(s => ({ mapData: s.mapData })));

  let pieces = 0, targets = 0, rays = 0, inventory = 0;
  for (const row of mapData) {
    for (const cell of row) {
      if (!cell) continue;
      pieces++;
      if (cell.type === 'ray') rays++;
      if (cell.type.includes('target')) targets++;
      if (cell.isInventory) inventory++;
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>맵 통계</SectionTitle>
      <div className="flex flex-col gap-1.5">
        <FieldRow label="기물" value={pieces} />
        <FieldRow label="발사기" value={rays} />
        <FieldRow label="표적" value={targets} />
        <FieldRow label="유저 지급" value={inventory} />
      </div>

      <div className="border-t border-line pt-3 flex flex-col gap-2">
        <SectionTitle>선택 기물</SectionTitle>
        <p className="text-xs text-ink-muted">기물을 클릭하면 정보가 표시됩니다.</p>
      </div>
    </div>
  );
}
