import { useEffect, useRef } from 'react';
import { getSvgArt } from '../../lib/svgArt';
import { getLastRotationEvent, ROTATION_ANIM_MS } from '../../lib/pieceActions';
import { useGameStore } from '../../store/gameStore';
import type { CellData } from '../../types/game';

interface Props {
  row: number;
  col: number;
  cell: CellData | null;
}

export function GridCell({ row, col, cell }: Props) {
  useGameStore(s => s.pieceConfigRev); // config 오버레이 갱신 시 리렌더

  const pieceRef = useRef<HTMLDivElement>(null);
  const prevRotationRef = useRef<number | null>(null);
  const prevTypeRef = useRef<string | null>(null);

  const rotation = cell?.rotation ?? null;
  const type = cell?.type ?? null;

  // 회전 연출: rotatePiece() 마커가 이 셀을 가리킬 때만 이전각→새각 일회성 애니메이션.
  // 맵 로드/undo/스왑은 마커가 없으므로 즉시 스냅. 최종 각은 인라인 스타일이 보장한다.
  useEffect(() => {
    const from = prevRotationRef.current;
    const sameType = prevTypeRef.current === type;
    prevRotationRef.current = rotation;
    prevTypeRef.current = type;

    if (rotation === null || from === null || from === rotation || !sameType) return;

    const ev = getLastRotationEvent();
    if (!ev || ev.row !== row || ev.col !== col || Date.now() - ev.ts > 500) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // 최단 부호 델타 — 270°→0° 도 역회전 없이 정방향 90° 로 돈다
    const delta = ((rotation - from + 540) % 360) - 180;
    pieceRef.current?.animate(
      [
        { transform: `rotate(${rotation - delta}deg)` },
        { transform: `rotate(${rotation}deg)` },
      ],
      { duration: ROTATION_ANIM_MS, easing: 'ease-in-out' },
    );
  }, [rotation, type, row, col]);

  return (
    <div
      data-row={row}
      data-col={col}
      className="grid-cell relative w-full h-full border border-[var(--cell-border)] bg-[var(--cell)] cursor-pointer select-none overflow-hidden hover:bg-surface-2"
    >
      {cell && (
        <div
          ref={pieceRef}
          className="absolute inset-0 flex items-center justify-center p-2"
          style={{ transform: `rotate(${cell.rotation}deg)` }}
          dangerouslySetInnerHTML={{ __html: getSvgArt(cell.type) }}
        />
      )}
      {cell?.isInventory && (
        <div className="absolute top-0.5 right-0.5 text-xs leading-none select-none">🎒</div>
      )}
      {cell?.isInventory && !cell.canRotate && (
        <div className="absolute top-0.5 left-0.5 text-xs leading-none select-none">🔒</div>
      )}
      {cell && !cell.isInventory && cell.canRotate && (
        <div className="absolute top-0.5 right-0.5 text-xs leading-none select-none">🔄</div>
      )}
    </div>
  );
}
