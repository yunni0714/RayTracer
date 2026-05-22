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
    isLibraryMode, activeModal, isEditorMode, currentUserUid,
    openModal, currentLoadedMapObj,
  } = useGameStore(useShallow(s => ({
    isLibraryMode: s.isLibraryMode,
    activeModal: s.activeModal,
    isEditorMode: s.isEditorMode,
    currentUserUid: s.currentUserUid,
    openModal: s.openModal,
    currentLoadedMapObj: s.currentLoadedMapObj,
  })));

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <Header />

      <main className="flex-1 overflow-hidden">
        {isLibraryMode ? (
          <LibraryScreen />
        ) : (
          <div className="flex h-full overflow-hidden">
            {/* 좌측: 팔레트/인벤토리 + 맵 정보 */}
            <aside className="w-56 shrink-0 p-3 bg-white border-r border-gray-200 overflow-y-auto">
              <PalettePanel />
              <TestModeInventory />

              {/* 에디터 모드 맵 공유 버튼 (맵 미로드 시만 표시) */}
              {isEditorMode && currentUserUid && !currentLoadedMapObj && (
                <div className="mt-4 border-t pt-3">
                  <button
                    onClick={() => openModal('upload')}
                    className="w-full px-3 py-2 bg-ray-purple text-white text-sm rounded hover:opacity-90 transition-opacity"
                  >
                    📤 맵 공유하기
                  </button>
                </div>
              )}

              {/* 로드된 맵 정보 + 평가/투표/액션 */}
              {currentLoadedMapObj && <LoadedMapInfo />}
            </aside>

            {/* 중앙: 게임 보드 */}
            <div className="flex-1 flex items-center justify-center p-4 min-w-0">
              <GameBoard />
            </div>

            {/* 우측: 사이드 패널 (맵 로드 시에만) */}
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
