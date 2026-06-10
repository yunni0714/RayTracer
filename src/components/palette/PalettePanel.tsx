import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore, emptyGrid } from '../../store/gameStore';
import { ToolItem } from './ToolItem';
import { GRID_SIZE } from '../../lib/svgArt';
import { Button, Tabs, TextArea, cx } from '../ui';
import type { PieceType, CellData } from '../../types/game';

const BASIC_TOOLS: PieceType[] = ['ray', 'target', 'mirror', 'half_mirror', 'block', 'tunnel', 'single_mirror', 'target_mirror_a', 'target_mirror_b'];
const INTERMEDIATE_TOOLS: PieceType[] = ['diode', 'v_mirror_double', 'v_half_mirror_double', 'small_target', 'omni_target', 'high_block'];
const ADVANCED_TOOLS: PieceType[] = ['mirror_45', 'half_mirror_45', 'diag_single_mirror_a', 'diag_single_mirror_b', 'v_mirror', 'v_half_mirror', 'v_single_mirror', 'v_target_mirror_a', 'v_target_mirror_b'];

type Tab = 'basic' | 'intermediate' | 'advanced';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">
      {children}
    </h5>
  );
}

// 특성 부여 토글 칩 — 소프트 배경 + 컬러 보더, 활성 시 솔리드.
function ModChip({
  active, activeCls, idleCls, onClick, children,
}: {
  active: boolean; activeCls: string; idleCls: string;
  onClick: () => void; children: React.ReactNode;
}) {
  return (
    <Button
      variant="secondary"
      block
      onClick={onClick}
      className={cx('!text-xs !border', active ? activeCls : idleCls)}
    >
      {children}
    </Button>
  );
}

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

  const tools = activeTab === 'basic' ? BASIC_TOOLS
    : activeTab === 'intermediate' ? INTERMEDIATE_TOOLS
    : ADVANCED_TOOLS;

  return (
    <div className="flex flex-col gap-3">
      {/* 기물 — 폴더 탭 + 타일 그리드 */}
      <SectionTitle>기물</SectionTitle>
      <div className="border border-line rounded-tile overflow-hidden">
        <Tabs
          variant="folder"
          items={[
            { id: 'basic', label: '초급' },
            { id: 'intermediate', label: '중급' },
            ...(isUnlocked ? [{ id: 'advanced', label: '상급' }] : []),
          ]}
          value={activeTab}
          onChange={(id) => setActiveTab(id as Tab)}
        />
        <div className="p-1.5 bg-surface">
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
        </div>
      </div>

      {/* 특성 부여 · 덧칠 */}
      <div className="border-t border-line pt-3 flex flex-col gap-1.5">
        <SectionTitle>특성 부여 · 덧칠</SectionTitle>
        <ModChip
          active={isModRotatableActive}
          activeCls="!bg-primary !text-primary-ink !border-primary"
          idleCls="!bg-primary-soft !text-primary !border-primary"
          onClick={() => {
            const next = !isModRotatableActive;
            setModRotatable(next);
            if (next) { setModLock(false); setModInv(false); }
          }}
        >
          🔄 회전 가능
        </ModChip>
        <ModChip
          active={isModLockActive}
          activeCls="!bg-warning !text-white !border-warning"
          idleCls="!bg-warning-soft !text-warning !border-warning"
          onClick={() => {
            const next = !isModLockActive;
            setModLock(next);
            if (next) { setModInv(true); setModRotatable(false); }
          }}
        >
          🔒 회전 불가
        </ModChip>
        <ModChip
          active={isModInvActive}
          activeCls="!bg-danger !text-white !border-danger"
          idleCls="!bg-danger-soft !text-danger !border-danger"
          onClick={() => {
            const next = !isModInvActive;
            setModInv(next);
            if (next) setModRotatable(false);
            else setModLock(false);
          }}
        >
          🎒 유저 지급
        </ModChip>
      </div>

      {/* 작업 */}
      <div className="border-t border-line pt-3 flex flex-col gap-1.5">
        <SectionTitle>작업</SectionTitle>
        <div className="grid grid-cols-2 gap-1.5">
          <Button variant="secondary" className="!text-xs" onClick={clearGrid}>
            🗑 전체 지우기
          </Button>
          <Button variant="success" className="!text-xs" onClick={handleImport}>
            📥 JSON 로드
          </Button>
          <Button variant="secondary" className="!text-xs" onClick={handleExport}>
            📤 JSON 추출
          </Button>
          {currentUserUid && !currentLoadedMapObj && (
            <Button variant="accent" className="!text-xs" onClick={() => openModal('upload')}>
              ☁️ 맵 등록
            </Button>
          )}
        </div>
        <TextArea
          value={jsonText}
          onChange={handleJsonChange}
          placeholder="JSON을 입력하세요."
          rows={4}
          className="!text-xs font-mono !p-1.5"
        />
      </div>
    </div>
  );
}
