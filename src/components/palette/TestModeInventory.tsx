import { useGameStore } from '../../store/gameStore';
import { ToolItem } from './ToolItem';
import type { PieceType, Rotation } from '../../types/game';

export function TestModeInventory() {
  const { isEditorMode, playerInventory } = useGameStore(s => ({
    isEditorMode: s.isEditorMode,
    playerInventory: s.playerInventory,
  }));

  if (isEditorMode) return null;

  const items = Object.entries(playerInventory).filter(([, v]) => v.count > 0);

  return (
    <div className="flex flex-col gap-2 w-52">
      <p className="text-sm font-medium text-gray-700">🎒 인벤토리</p>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">인벤토리가 비어있습니다.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {items.map(([key, item]) => (
            <ToolItem
              key={key}
              type={item.type as PieceType}
              rotation={item.rotation as Rotation}
              count={item.count}
            />
          ))}
        </div>
      )}
    </div>
  );
}
