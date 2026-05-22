import { SVG_ART } from '../../lib/svgArt';
import type { PieceType, Rotation } from '../../types/game';

interface Props {
  type: PieceType;
  rotation?: Rotation;
  count?: number;
  selected?: boolean;
  onClick?: () => void;
}

export function ToolItem({ type, rotation = 0, count, selected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      data-tool={type}
      className={`relative w-16 h-16 border-2 rounded flex items-center justify-center p-2 transition-colors ${
        selected
          ? 'border-ray-purple bg-purple-50'
          : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
      }`}
    >
      <div
        style={{ transform: `rotate(${rotation}deg)`, width: '100%', height: '100%' }}
        dangerouslySetInnerHTML={{ __html: SVG_ART[type] }}
      />
      {count !== undefined && (
        <span className="absolute bottom-0.5 right-1 text-xs font-bold text-ray-blue">
          ×{count}
        </span>
      )}
    </button>
  );
}
