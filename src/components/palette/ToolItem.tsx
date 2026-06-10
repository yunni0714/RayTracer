import { SVG_ART } from '../../lib/svgArt';
import type { PieceType, Rotation } from '../../types/game';

interface Props {
  type: PieceType;
  rotation?: Rotation;
  count?: number;
  selected?: boolean;
  onClick?: () => void;
}

// 납작한 직사각 타일(높이 44px). 기물 SVG는 비율유지 정사각 중앙 배치.
export function ToolItem({ type, rotation = 0, count, selected, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tool={type}
      className={`relative h-11 border rounded-tile flex items-center justify-center transition-colors ${
        selected
          ? 'border-accent bg-accent-soft'
          : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2'
      }`}
    >
      <div
        className="h-full aspect-square p-1.5"
        style={{ transform: `rotate(${rotation}deg)` }}
        dangerouslySetInnerHTML={{ __html: SVG_ART[type] }}
      />
      {count !== undefined && (
        <span className="absolute bottom-0.5 right-1 text-xs font-bold text-primary">
          ×{count}
        </span>
      )}
    </button>
  );
}
