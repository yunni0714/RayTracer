import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { SelectedPieceInfo } from '../game/SelectedPieceInfo';
import { Select } from '../ui';

const GRID_SIZES = [5, 6, 7, 8, 9];

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

// 우 존 — 편집 모드 인스펙터: 맵 통계 + 그리드 크기 + 선택 기물 편집
export function InspectorPanel() {
  const { mapData, setGridSize, requestConfirm } = useGameStore(useShallow(s => ({
    mapData: s.mapData,
    setGridSize: s.setGridSize,
    requestConfirm: s.requestConfirm,
  })));

  const gridSize = mapData.length;

  async function handleGridSizeChange(next: number) {
    if (next === gridSize) return;
    const hasOutside = mapData.some((row, r) =>
      row.some((cell, c) => cell && (r >= next || c >= next)));
    if (hasOutside && !(await requestConfirm({
      message: `${next}×${next}로 줄이면 범위 밖 기물이 삭제됩니다. 계속하시겠습니까?`,
      danger: true,
    }))) return;
    setGridSize(next);
  }

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
        <SectionTitle>그리드 크기</SectionTitle>
        <Select
          value={gridSize}
          onChange={e => handleGridSizeChange(Number(e.target.value))}
          className="!text-xs !py-1.5"
          aria-label="그리드 크기"
        >
          {GRID_SIZES.map(n => <option key={n} value={n}>{n} × {n}</option>)}
        </Select>
      </div>

      <div className="border-t border-line pt-3 flex flex-col gap-2">
        <SectionTitle>선택 기물</SectionTitle>
        <SelectedPieceInfo />
      </div>
    </div>
  );
}
