import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';
import { Header } from '../components/layout/Header';
import { Notification } from '../components/layout/Notification';
import { GameBoard } from '../components/game/GameBoard';
import { PalettePanel } from '../components/palette/PalettePanel';
import { TestModeInventory } from '../components/palette/TestModeInventory';
import { LibraryScreen } from '../components/library/LibraryScreen';
import { LoadedMapInfo } from '../components/library/LoadedMapInfo';
import { RightSidePanel } from '../components/library/RightSidePanel';
import { NicknameModal } from '../components/modals/NicknameModal';
import { UploadModal } from '../components/modals/UploadModal';
import { SuggestionModal } from '../components/modals/SuggestionModal';

export function EditorPage() {
  const {
    isLibraryMode, activeModal, isEditorMode,
    currentLoadedMapObj, isLaserOn, toggleLaser,
    isAnswerShown, showAnswer, hideAnswer,
  } = useGameStore(useShallow(s => ({
    isLibraryMode: s.isLibraryMode,
    activeModal: s.activeModal,
    isEditorMode: s.isEditorMode,
    currentLoadedMapObj: s.currentLoadedMapObj,
    isLaserOn: s.isLaserOn,
    toggleLaser: s.toggleLaser,
    isAnswerShown: s.isAnswerShown,
    showAnswer: s.showAnswer,
    hideAnswer: s.hideAnswer,
  })));

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <Header />

      <main className="flex-1 overflow-hidden">
        {isLibraryMode ? (
          <LibraryScreen />
        ) : (
          <div className="flex h-full overflow-hidden">

            {/* ① LEFT: board-wrapper */}
            <div className="flex flex-col shrink-0 p-4 gap-2 overflow-y-auto">
              {currentLoadedMapObj && <LoadedMapInfo />}
              <GameBoard />
            </div>

            {/* ② RIGHT: palette-area (~380px) */}
            <div className="w-96 shrink-0 bg-white border-l border-gray-200 p-3 overflow-y-auto flex flex-col gap-2">
              {/* 레이저 버튼 (항상 표시) */}
              <button
                onClick={toggleLaser}
                className="w-full px-4 py-3 rounded text-white text-sm font-bold transition-colors"
                style={{ background: isLaserOn ? '#27ae60' : '#e74c3c' }}
              >
                {isLaserOn ? '🟢 실시간 레이저 끄기 (ON)' : '🔴 실시간 레이저 켜기 (OFF)'}
              </button>

              {/* 정답 보기 버튼 (테스트 모드 + 맵 로드 시) */}
              {!isEditorMode && currentLoadedMapObj && (
                <button
                  onClick={isAnswerShown ? hideAnswer : showAnswer}
                  className="w-full px-4 py-3 rounded text-white text-sm font-bold transition-colors"
                  style={{ background: isAnswerShown ? '#8e44ad' : '#27ae60' }}
                >
                  {isAnswerShown ? '📖 정답 닫기 (ON)' : '📖 정답 보기'}
                </button>
              )}

              {/* 테스트 모드: 인벤토리 */}
              {!isEditorMode && <TestModeInventory />}

              {/* 에디터 모드: 팔레트 패널 */}
              {isEditorMode && <PalettePanel />}
            </div>

            {/* ③ FAR RIGHT: rightSidePanel (맵 로드 시) */}
            {currentLoadedMapObj && (
              <div className="p-3 overflow-hidden flex items-stretch">
                <RightSidePanel />
              </div>
            )}
          </div>
        )}
      </main>

      {/* 모달 */}
      {activeModal === 'nickname' && <NicknameModal mode="set" />}
      {activeModal === 'changeNickname' && <NicknameModal mode="change" />}
      {activeModal === 'upload' && <UploadModal />}
      {activeModal === 'suggestion' && <SuggestionModal />}

      <Notification />
    </div>
  );
}
