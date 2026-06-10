import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { ToolItem } from './ToolItem';
import type { PieceType, Rotation } from '../../types/game';

export function TestModeInventory() {
  const { isEditorMode, playerInventory, selectedTool, setSelectedTool } = useGameStore(useShallow(s => ({
    isEditorMode: s.isEditorMode,
    playerInventory: s.playerInventory,
    selectedTool: s.selectedTool,
    setSelectedTool: s.setSelectedTool,
  })));

  if (isEditorMode) return null;

  const items = Object.entries(playerInventory).filter(([, v]) => v.count > 0);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">🎒 인벤토리</p>
      {items.length === 0 ? (
        <p className="text-xs text-ink-muted">인벤토리가 비어있습니다.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {items.map(([key, item]) => (
            <ToolItem
              key={key}
              type={item.type as PieceType}
              rotation={item.rotation as Rotation}
              count={item.count}
              selected={selectedTool?.source === 'inventory' && selectedTool.inventoryKey === key}
              onClick={() =>
                setSelectedTool(
                  selectedTool?.source === 'inventory' && selectedTool.inventoryKey === key
                    ? null
                    : {
                        type: item.type as PieceType,
                        source: 'inventory',
                        isInvTool: true,
                        inventoryKey: key,
                        canRotate: item.canRotate,
                        rotation: item.rotation as Rotation,
                      },
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
