import { useState } from 'react';
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
import { ConfirmHost, Button, Tabs } from '../components/ui';

type SheetTab = 'tools' | 'info';

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

  // 모바일 하단 시트 탭 (lg 미만에서만 표시)
  const [sheetTab, setSheetTab] = useState<SheetTab>('tools');

  // 좌 존 콘텐츠: 팔레트(편집) / 인벤토리(플레이)
  const toolsZone = isEditorMode ? <PalettePanel /> : <TestModeInventory />;

  // 우 존 콘텐츠: 인스펙터(편집) / 맵정보·평가(플레이)
  const infoZone = (
    <>
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
    </>
  );

  return (
    <div className="flex flex-col h-screen bg-canvas text-ink">
      <Header />

      <main className="flex-1 overflow-hidden flex flex-col">
        {isLibraryMode ? (
          <LibraryScreen />
        ) : (
          <>
            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

              {/* ① 좌 존 (데스크탑): 팔레트/인벤토리 */}
              <aside className="hidden lg:block w-56 shrink-0 bg-surface border-r border-line p-3 overflow-y-auto">
                {toolsZone}
              </aside>

              {/* ② 중앙: 캔버스(보드) — 모바일은 전체폭 */}
              <section className="flex-1 overflow-auto p-3 lg:p-4 flex items-start justify-center min-h-0">
                <GameBoard />
              </section>

              {/* ③ 우 존 (데스크탑): 인스펙터/맵정보 */}
              <aside className="hidden lg:flex w-56 shrink-0 bg-surface border-l border-line p-3 overflow-y-auto flex-col gap-3">
                {infoZone}
              </aside>

              {/* ④ 부가 존 (데스크탑): 다음문제/풀이제안 (맵 로드 시) */}
              {currentLoadedMapObj && (
                <aside className="hidden lg:flex shrink-0 p-3 overflow-hidden items-stretch">
                  <RightSidePanel />
                </aside>
              )}

              {/* ⑤ 모바일/태블릿: 좌·우 존을 하단 시트 탭으로 */}
              <div className="lg:hidden shrink-0 max-h-[45vh] flex flex-col bg-surface border-t border-line">
                <div className="p-2 border-b border-line">
                  <Tabs
                    variant="segment"
                    className="w-full"
                    items={[
                      { id: 'tools', label: isEditorMode ? '🧰 팔레트' : '🎒 인벤토리' },
                      { id: 'info', label: 'ℹ️ 정보' },
                    ]}
                    value={sheetTab}
                    onChange={(id) => setSheetTab(id as SheetTab)}
                  />
                </div>
                <div className="overflow-y-auto p-3 flex flex-col gap-3">
                  {sheetTab === 'tools' ? toolsZone : (
                    <>
                      {infoZone}
                      {currentLoadedMapObj && <RightSidePanel />}
                    </>
                  )}
                </div>
              </div>
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
