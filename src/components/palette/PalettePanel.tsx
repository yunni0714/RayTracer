import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore, emptyGrid } from '../../store/gameStore';
import { ToolItem } from './ToolItem';
import { GRID_SIZE } from '../../lib/svgArt';
import type { PieceType, CellData } from '../../types/game';

const BASIC_TOOLS: PieceType[] = ['ray', 'target', 'mirror', 'half_mirror', 'block', 'tunnel', 'single_mirror', 'target_mirror_a', 'target_mirror_b'];
const ADVANCED_TOOLS: PieceType[] = ['mirror_45', 'half_mirror_45', 'diag_single_mirror_a', 'diag_single_mirror_b', 'v_mirror', 'v_half_mirror', 'v_single_mirror', 'v_target_mirror_a', 'v_target_mirror_b'];

type Tab = 'basic' | 'intermediate' | 'advanced';

export function PalettePanel() {
  const [activeTab, setActiveTab] = useState<Tab>('basic');
  const [jsonText, setJsonText] = useState('');

  const {
    selectedTool, setSelectedTool, isUnlocked, setUnlocked,
    isModRotatableActive, isModLockActive, isModInvActive,
    setModRotatable, setModLock, setModInv,
    clearGrid,
    mapData, saveUndoSnapshot, setMapData, showNotification,
    currentUserUid, currentLoadedMapObj, openModal,
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
    mapData: s.mapData,
    saveUndoSnapshot: s.saveUndoSnapshot,
    setMapData: s.setMapData,
    showNotification: s.showNotification,
    currentUserUid: s.currentUserUid,
    currentLoadedMapObj: s.currentLoadedMapObj,
    openModal: s.openModal,
  })));

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
          type: cell.type, x: c, y: r,
          rotation: cell.canRotate ? 0 : cell.rotation,
          canMove: cell.canMove, canRotate: cell.canRotate, isInventory: cell.isInventory,
        });
      }
    }
    setJsonText(JSON.stringify(rows, null, 2));
  }

  function handleImport() {
    try {
      let parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed) && parsed.mapData) parsed = parsed.mapData;
      if (!Array.isArray(parsed)) throw new Error('invalid');
      const newGrid = emptyGrid();
      for (const item of parsed) {
        if (item.y >= 0 && item.y < GRID_SIZE && item.x >= 0 && item.x < GRID_SIZE) {
          newGrid[item.y][item.x] = {
            type: item.type, rotation: item.rotation ?? 0,
            canMove: item.canMove ?? true, canRotate: item.canRotate ?? false,
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

  const tools = activeTab === 'basic' ? BASIC_TOOLS : activeTab === 'advanced' ? ADVANCED_TOOLS : [];

  return (
    <div className="flex flex-col gap-3">
      {/* 탭 */}
      <div className="flex rounded overflow-hidden border border-gray-300">
        {([
          { id: 'basic' as Tab, label: '초급 기물' },
          { id: 'intermediate' as Tab, label: '중급 기물' },
          ...(isUnlocked ? [{ id: 'advanced' as Tab, label: '상급 기물' }] : []),
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.id ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 기물 목록 */}
      {activeTab === 'intermediate' ? (
        <p className="text-xs text-gray-400 text-center py-4">비어 있음</p>
      ) : (
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
      )}

      {/* 수정자 */}
      <div className="flex flex-col gap-1 mt-1">
        <p className="text-xs text-gray-500 font-medium">특성 부여 옵션 (선택 후 포인터로 덧칠 가능)</p>
        {/* 회전 가능 */}
        <button
          onClick={() => {
            const next = !isModRotatableActive;
            setModRotatable(next);
            if (next) { setModLock(false); setModInv(false); }
          }}
          className="px-3 py-1.5 text-xs rounded border font-medium transition-colors"
          style={isModRotatableActive
            ? { background: '#2980b9', color: 'white', borderColor: '#2980b9' }
            : { background: '#d4e6f1', color: '#1a5276', borderColor: '#2980b9' }}
        >
          🔄 회전 가능
        </button>
        {/* 회전 불가 */}
        <button
          onClick={() => {
            const next = !isModLockActive;
            setModLock(next);
            if (next) { setModInv(true); setModRotatable(false); }
          }}
          className="px-3 py-1.5 text-xs rounded border font-medium transition-colors"
          style={isModLockActive
            ? { background: '#f1c40f', color: '#7d6608', borderColor: '#f1c40f' }
            : { background: '#fcf3cf', color: '#7d6608', borderColor: '#f1c40f' }}
        >
          🔒 회전 불가
        </button>
        {/* 유저 지급 */}
        <button
          onClick={() => {
            const next = !isModInvActive;
            setModInv(next);
            if (next) setModRotatable(false);
            else setModLock(false);
          }}
          className="px-3 py-1.5 text-xs rounded border font-medium transition-colors"
          style={isModInvActive
            ? { background: '#c0392b', color: 'white', borderColor: '#c0392b', transform: 'scale(1.03)', boxShadow: '0 0 8px rgba(192,57,43,0.6)' }
            : { background: '#fadbd8', color: '#922b21', borderColor: '#e74c3c' }}
        >
          🎒 유저 지급
        </button>
      </div>

      {/* 액션 버튼 2×2 */}
      <div className="grid grid-cols-2 gap-1 border-t pt-2 mt-1">
        <button
          onClick={clearGrid}
          className="px-2 py-2 text-xs rounded font-medium text-white transition-colors"
          style={{ background: '#2c3e50' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#1a252f')}
          onMouseLeave={e => (e.currentTarget.style.background = '#2c3e50')}
        >
          🗑 전체 지우기
        </button>
        <button
          onClick={handleImport}
          className="px-2 py-2 text-xs rounded font-medium text-white transition-colors"
          style={{ background: '#16a085' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#0e6655')}
          onMouseLeave={e => (e.currentTarget.style.background = '#16a085')}
        >
          📥 JSON 불러오기
        </button>
        <button
          onClick={handleExport}
          className="px-2 py-2 text-xs rounded font-medium text-white transition-colors"
          style={{ background: '#7f8c8d' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#626567')}
          onMouseLeave={e => (e.currentTarget.style.background = '#7f8c8d')}
        >
          📤 JSON 추출
        </button>
        {currentUserUid && !currentLoadedMapObj && (
          <button
            onClick={() => openModal('upload')}
            className="px-2 py-2 text-xs rounded font-medium text-white transition-colors"
            style={{ background: '#8e44ad' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#6c3483')}
            onMouseLeave={e => (e.currentTarget.style.background = '#8e44ad')}
          >
            ☁️ 서버에 맵 등록하기
          </button>
        )}
      </div>

      {/* JSON 텍스트영역 */}
      <textarea
        value={jsonText}
        onChange={handleJsonChange}
        placeholder="JSON을 입력하세요."
        rows={4}
        className="w-full text-xs border border-gray-300 rounded p-1.5 font-mono resize-none focus:outline-none focus:border-ray-purple"
      />
    </div>
  );
}
