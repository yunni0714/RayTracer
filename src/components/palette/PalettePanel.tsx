import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { ToolItem } from './ToolItem';
import type { PieceType } from '../../types/game';

const BASIC_TOOLS: PieceType[] = ['ray', 'target', 'mirror', 'half_mirror', 'block', 'tunnel', 'single_mirror', 'target_mirror_a', 'target_mirror_b'];
const ADVANCED_TOOLS: PieceType[] = ['mirror_45', 'half_mirror_45', 'diag_single_mirror_a', 'diag_single_mirror_b', 'v_mirror', 'v_half_mirror', 'v_single_mirror', 'v_target_mirror_a', 'v_target_mirror_b'];

type Tab = 'basic' | 'advanced';

export function PalettePanel() {
  const [activeTab, setActiveTab] = useState<Tab>('basic');

  const {
    selectedTool, setSelectedTool, isUnlocked,
    isModRotatableActive, isModLockActive, isModInvActive,
    setModRotatable, setModLock, setModInv,
    clearGrid, isEditorMode,
  } = useGameStore(s => ({
    selectedTool: s.selectedTool,
    setSelectedTool: s.setSelectedTool,
    isUnlocked: s.isUnlocked,
    isModRotatableActive: s.isModRotatableActive,
    isModLockActive: s.isModLockActive,
    isModInvActive: s.isModInvActive,
    setModRotatable: s.setModRotatable,
    setModLock: s.setModLock,
    setModInv: s.setModInv,
    clearGrid: s.clearGrid,
    isEditorMode: s.isEditorMode,
  }));

  if (!isEditorMode) return null;

  const tools = activeTab === 'basic' ? BASIC_TOOLS : ADVANCED_TOOLS;

  return (
    <div className="flex flex-col gap-3 w-52">
      {/* 탭 */}
      <div className="flex rounded overflow-hidden border border-gray-300">
        {(['basic', 'advanced'] as Tab[]).map(tab => (
          (tab === 'advanced' && !isUnlocked) ? null : (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab ? 'bg-ray-purple text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab === 'basic' ? '기본' : '상급'}
            </button>
          )
        ))}
      </div>

      {/* 기물 목록 */}
      <div className="grid grid-cols-3 gap-1.5">
        {tools.map(type => (
          <ToolItem
            key={type}
            type={type}
            selected={selectedTool?.type === type}
            onClick={() => setSelectedTool(
              selectedTool?.type === type ? null : { type, source: 'palette' }
            )}
          />
        ))}
      </div>

      {/* 수정자 */}
      <div className="flex flex-col gap-1 mt-1">
        <p className="text-xs text-gray-500 font-medium">배치 옵션</p>
        <button
          onClick={() => setModRotatable(!isModRotatableActive)}
          className={`px-3 py-1.5 text-xs rounded border transition-colors ${
            isModRotatableActive ? 'bg-ray-green text-white border-ray-green' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          🔄 회전 가능
        </button>
        <button
          onClick={() => setModLock(!isModLockActive)}
          className={`px-3 py-1.5 text-xs rounded border transition-colors ${
            isModLockActive ? 'bg-ray-red text-white border-ray-red' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          🔒 이동 잠금
        </button>
        <button
          onClick={() => setModInv(!isModInvActive)}
          className={`px-3 py-1.5 text-xs rounded border transition-colors ${
            isModInvActive ? 'bg-ray-blue text-white border-ray-blue' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          🎒 인벤토리
        </button>
      </div>

      {/* 액션 */}
      <div className="flex flex-col gap-1 border-t pt-2 mt-1">
        <button
          onClick={clearGrid}
          className="px-3 py-1.5 text-xs rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
        >
          🗑 전체 지우기
        </button>
      </div>
    </div>
  );
}
