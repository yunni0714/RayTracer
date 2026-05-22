import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore, emptyGrid } from '../../store/gameStore';
import { ToolItem } from './ToolItem';
import { GRID_SIZE } from '../../lib/svgArt';
import type { PieceType, CellData } from '../../types/game';

const BASIC_TOOLS: PieceType[] = ['ray', 'target', 'mirror', 'half_mirror', 'block', 'tunnel', 'single_mirror', 'target_mirror_a', 'target_mirror_b'];
const ADVANCED_TOOLS: PieceType[] = ['mirror_45', 'half_mirror_45', 'diag_single_mirror_a', 'diag_single_mirror_b', 'v_mirror', 'v_half_mirror', 'v_single_mirror', 'v_target_mirror_a', 'v_target_mirror_b'];

type Tab = 'basic' | 'advanced';

export function PalettePanel() {
  const [activeTab, setActiveTab] = useState<Tab>('basic');
  const [jsonText, setJsonText] = useState('');

  const {
    selectedTool, setSelectedTool, isUnlocked, setUnlocked,
    isModRotatableActive, isModLockActive, isModInvActive,
    setModRotatable, setModLock, setModInv,
    clearGrid, isEditorMode,
    mapData, saveUndoSnapshot, setMapData, showNotification,
  } = useGameStore(useShallow(s => ({
    selectedTool: s.selectedTool,
    setSelectedTool: s.setSelectedTool,
    isUnlocked: s.isUnlocked,
    setUnlocked: s.setUnlocked,
    isModRotatableActive: s.isModRotatableActive,
    isModLockActive: s.isModLockActive,
    isModInvActive: s.isModInvActive,
    setModRotatable: s.setModRotatable,
    setModLock: s.setModLock,
    setModInv: s.setModInv,
    clearGrid: s.clearGrid,
    isEditorMode: s.isEditorMode,
    mapData: s.mapData,
    saveUndoSnapshot: s.saveUndoSnapshot,
    setMapData: s.setMapData,
    showNotification: s.showNotification,
  })));

  if (!isEditorMode) return null;

  const tools = activeTab === 'basic' ? BASIC_TOOLS : ADVANCED_TOOLS;

  function handleJsonChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setJsonText(text);
    if (!isUnlocked && text.includes('wheresmy8hours')) {
      setUnlocked(true);
      showNotification('팀장님 몰래 상급 기물 탭이 활성화되었습니다!', '#8e44ad');
    }
  }

  function handleExport() {
    const rows: object[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = mapData[r][c];
        if (!cell) continue;
        rows.push({
          type: cell.type,
          x: c, y: r,
          rotation: cell.canRotate ? 0 : cell.rotation,
          canMove: cell.canMove,
          canRotate: cell.canRotate,
          isInventory: cell.isInventory,
        });
      }
    }
    setJsonText(JSON.stringify(rows, null, 2));
  }

  function handleImport() {
    try {
      let parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed) && parsed.mapData) parsed = parsed.mapData;
      if (!Array.isArray(parsed)) throw new Error('invalid format');

      const newGrid = emptyGrid();
      for (const item of parsed) {
        if (item.y >= 0 && item.y < GRID_SIZE && item.x >= 0 && item.x < GRID_SIZE) {
          newGrid[item.y][item.x] = {
            type: item.type,
            rotation: item.rotation ?? 0,
            canMove: item.canMove ?? true,
            canRotate: item.canRotate ?? false,
            isInventory: item.isInventory ?? false,
          } as CellData;
        }
      }
      saveUndoSnapshot();
      setMapData(newGrid);
      showNotification('JSON 데이터를 불러왔습니다!', '#27ae60');
    } catch {
      showNotification('JSON 형식이 올바르지 않습니다.', '#e74c3c');
    }
  }

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
          onClick={() => {
            const next = !isModRotatableActive;
            setModRotatable(next);
            if (next) { setModLock(false); setModInv(false); }
          }}
          className={`px-3 py-1.5 text-xs rounded border transition-colors ${
            isModRotatableActive ? 'bg-ray-green text-white border-ray-green' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          🔄 회전 가능
        </button>
        <button
          onClick={() => {
            const next = !isModLockActive;
            setModLock(next);
            if (next) setModRotatable(false);
          }}
          className={`px-3 py-1.5 text-xs rounded border transition-colors ${
            isModLockActive ? 'bg-ray-red text-white border-ray-red' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          🔒 이동 잠금
        </button>
        <button
          onClick={() => {
            const next = !isModInvActive;
            setModInv(next);
            if (next) setModRotatable(false);
          }}
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

      {/* JSON 추출/불러오기 */}
      <div className="flex flex-col gap-1 border-t pt-2 mt-1">
        <p className="text-xs text-gray-500 font-medium">JSON 데이터</p>
        <textarea
          value={jsonText}
          onChange={handleJsonChange}
          placeholder="JSON 데이터..."
          rows={4}
          className="w-full text-xs border border-gray-300 rounded p-1.5 font-mono resize-none focus:outline-none focus:border-ray-purple"
        />
        <div className="flex gap-1">
          <button
            onClick={handleExport}
            className="flex-1 px-2 py-1.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            📤 JSON 추출
          </button>
          <button
            onClick={handleImport}
            className="flex-1 px-2 py-1.5 text-xs bg-ray-purple text-white rounded hover:opacity-90 transition-opacity"
          >
            📥 JSON 불러오기
          </button>
        </div>
      </div>
    </div>
  );
}
