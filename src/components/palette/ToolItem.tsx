import { getSvgArt } from '../../lib/svgArt';
import { useGameStore } from '../../store/gameStore';
import type { AnyPieceType, Rotation } from '../../types/game';

interface Props {
  type: AnyPieceType;
  rotation?: Rotation;
  count?: number;
  selected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'lg';
  lock?: boolean; // 회전 불가 표식 (인벤토리 기물의 일탈 특성)
}

// 납작한 직사각 타일(sm=44px) / 큰 타일(lg=64px). 기물 SVG는 비율유지 정사각 중앙 배치.
export function ToolItem({ type, rotation = 0, count, selected, onClick, size = 'sm', lock }: Props) {
  useGameStore(s => s.pieceConfigRev); // config 오버레이 갱신 시 리렌더

  return (
    <button
      type="button"
      onClick={onClick}
      data-tool={type}
      className={`relative ${size === 'lg' ? 'h-16' : 'h-11'} border rounded-tile flex items-center justify-center transition-colors ${
        selected
          ? 'border-accent bg-accent-soft'
          : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2'
      }`}
    >
      <div
        className="h-full aspect-square p-1.5"
        style={{ transform: `rotate(${rotation}deg)` }}
        dangerouslySetInnerHTML={{ __html: getSvgArt(type) }}
      />
      {lock && (
        <span
          className="absolute top-0.5 left-0.5 text-[10px] leading-none px-0.5 rounded bg-surface-2 border border-line"
          title="회전 불가"
        >
          🔒
        </span>
      )}
      {count !== undefined && (
        <span className="absolute bottom-0.5 right-1 text-xs font-bold text-primary">
          ×{count}
        </span>
      )}
    </button>
  );
}
