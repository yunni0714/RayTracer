import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';
import { Header } from '../components/layout/Header';
import { Notification } from '../components/layout/Notification';
import { StatusBar } from '../components/layout/StatusBar';
import { InspectorPanel } from '../components/layout/InspectorPanel';
import { GameBoard } from '../components/game/GameBoard';
import { PalettePanel } from '../components/palette/PalettePanel';
import { TestModeInventory } from '../components/palette/TestModeInventory';
import { LibraryScreen } from '../components/library/LibraryScreen';
import { LoadedMapInfo } from '../components/library/LoadedMapInfo';
import { RightSidePanel } from '../components/library/RightSidePanel';
import { NicknameModal } from '../components/modals/NicknameModal';
import { UploadModal } from '../components/modals/UploadModal';
import { SuggestionModal } from '../components/modals/SuggestionModal';
import { ConfirmHost, Button } from '../components/ui';

export function EditorPage() {
  const {
    isLibraryMode, activeModal, isEditorMode,
    currentLoadedMapObj,
    isAnswerShown, showAnswer, hideAnswer,
  } = useGameStore(useShallow(s => ({
    isLibraryMode: s.isLibraryMode,
    activeModal: s.activeModal,
    isEditorMode: s.isEditorMode,
    currentLoadedMapObj: s.currentLoadedMapObj,
    isAnswerShown: s.isAnswerShown,
    showAnswer: s.showAnswer,
    hideAnswer: s.hideAnswer,
  })));

  return (
    <div className="flex flex-col h-screen bg-canvas text-ink">
      <Header />

      <main className="flex-1 overflow-hidden flex flex-col">
        {isLibraryMode ? (
          <LibraryScreen />
        ) : (
          <>
            <div className="flex flex-1 overflow-hidden">

              {/* ① 좌 존: 팔레트(편집) / 인벤토리(플레이) */}
              <aside className="w-56 shrink-0 bg-surface border-r border-line p-3 overflow-y-auto">
                {isEditorMode ? <PalettePanel /> : <TestModeInventory />}
              </aside>

              {/* ② 중앙: 캔버스(보드) */}
              <section className="flex-1 overflow-auto p-4 flex items-start justify-center">
                <GameBoard />
              </section>

              {/* ③ 우 존: 인스펙터(편집) / 맵정보·평가(플레이) */}
              <aside className="w-56 shrink-0 bg-surface border-l border-line p-3 overflow-y-auto flex flex-col gap-3">
                {!isEditorMode && currentLoadedMapObj && (
                  <Button
                    variant={isAnswerShown ? 'accent' : 'success'}
                    block
                    onClick={isAnswerShown ? hideAnswer : showAnswer}
                  >
                    {isAnswerShown ? '📖 정답 닫기' : '📖 정답 보기'}
                  </Button>
                )}
                {isEditorMode && <InspectorPanel />}
                {!isEditorMode && currentLoadedMapObj && <LoadedMapInfo />}
                {!isEditorMode && !currentLoadedMapObj && (
                  <p className="text-xs text-ink-muted">로드된 맵이 없습니다.</p>
                )}
              </aside>

              {/* ④ 부가 존: 다음문제/풀이제안 (맵 로드 시) */}
              {currentLoadedMapObj && (
                <aside className="shrink-0 p-3 overflow-hidden flex items-stretch">
                  <RightSidePanel />
                </aside>
              )}
            </div>

            {/* 하단 상태바 */}
            <StatusBar />
          </>
        )}
      </main>

      {/* 모달 */}
      {activeModal === 'nickname' && <NicknameModal mode="set" />}
      {activeModal === 'changeNickname' && <NicknameModal mode="change" />}
      {activeModal === 'upload' && <UploadModal />}
      {activeModal === 'suggestion' && <SuggestionModal />}

      <Notification />
      <ConfirmHost />
    </div>
  );
}
