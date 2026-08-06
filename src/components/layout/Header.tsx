import { useRef, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { signInWithGoogle, signOutUser } from '../../lib/firebaseService';
import { isAdminUid } from '../../lib/admin';
import { useNavigate } from 'react-router-dom';
import { Button, IconButton, Tabs } from '../ui';
import { InboxButton } from './InboxButton';

export function Header() {
  const navigate = useNavigate();

  const {
    currentUserUid, currentUserNickname, isEditorMode, isLibraryMode,
    toggleMode, setLibraryMode, openModal, showNotification, resetEditorState,
    currentLoadedMapObj, isMapEditMode,
  } = useGameStore(useShallow(s => ({
    currentUserUid: s.currentUserUid,
    currentUserNickname: s.currentUserNickname,
    isEditorMode: s.isEditorMode,
    isLibraryMode: s.isLibraryMode,
    toggleMode: s.toggleMode,
    setLibraryMode: s.setLibraryMode,
    openModal: s.openModal,
    showNotification: s.showNotification,
    resetEditorState: s.resetEditorState,
    currentLoadedMapObj: s.currentLoadedMapObj,
    isMapEditMode: s.isMapEditMode,
  })));

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogin() {
    try { await signInWithGoogle(); }
    catch (err) {
      const code = (err as { code?: string }).code ?? String(err);
      showNotification(`로그인 실패: ${code}`, '#e74c3c');
    }
  }

  async function handleLogout() {
    await signOutUser();
    setDropdownOpen(false);
  }

  function handleNewMap() {
    if (!isEditorMode) toggleMode();
    resetEditorState();
    setLibraryMode(false);
  }

  // [편집|플레이] 세그먼트: 모드 전환 가능 상태에서만 표시
  const canToggleMode = !isLibraryMode && (!currentLoadedMapObj || isMapEditMode);

  return (
    <header className="flex items-center gap-2 px-4 py-2 bg-surface text-ink border-b border-line shadow-card">
      <h1 className="text-lg font-extrabold tracking-tight mr-auto">⚡ Project Ray</h1>

      <Button variant="accent" onClick={handleNewMap}>+ 새 맵</Button>

      <Button variant="secondary" onClick={() => setLibraryMode(!isLibraryMode)}>
        {isLibraryMode ? '✏️ 에디터' : '📚 라이브러리'}
      </Button>

      {canToggleMode && (
        <Tabs
          variant="segment"
          items={[
            { id: 'edit', label: '✏️ 편집' },
            { id: 'play', label: '▶ 플레이' },
          ]}
          value={isEditorMode ? 'edit' : 'play'}
          onChange={(id) => {
            if ((id === 'edit') !== isEditorMode) toggleMode();
          }}
        />
      )}

      {/* 알림함 — 테마/어드민은 헤더에서 빠지고 각각 계정 설정 모달 /
          계정 드롭다운으로 옮겼다. 배지 마크업은 어드민 상단바와 공유. */}
      <InboxButton />

      {currentUserUid ? (
        <div className="relative" ref={dropdownRef}>
          <Button variant="secondary" onClick={() => setDropdownOpen(v => !v)}>
            👤 {currentUserNickname ?? '사용자'}
          </Button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 bg-surface text-ink border border-line rounded-tile shadow-cardhover min-w-[180px] z-50 overflow-hidden p-1">
              <Button
                variant="ghost"
                block
                className="justify-start"
                onClick={() => { openModal('settings'); setDropdownOpen(false); }}
              >
                ⚙️ 계정 설정
              </Button>
              <Button
                variant="ghost"
                block
                className="justify-start"
                onClick={() => { openModal('changeNickname'); setDropdownOpen(false); }}
              >
                ✏️ 닉네임 변경
              </Button>
              {isAdminUid(currentUserUid) && (
                <Button
                  variant="ghost"
                  block
                  className="justify-start"
                  onClick={() => { setDropdownOpen(false); navigate('/admin'); }}
                >
                  🛠 어드민
                </Button>
              )}
              <div className="my-1 border-t border-line" />
              <Button
                variant="ghost"
                block
                className="justify-start !text-danger"
                onClick={handleLogout}
              >
                🚪 로그아웃
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 비로그인은 드롭다운이 없으므로 설정(테마 포함) 진입점을 따로 둔다 */}
          <IconButton
            variant="secondary"
            onClick={() => openModal('settings')}
            aria-label="설정"
            title="설정"
          >
            ⚙️
          </IconButton>
          <Button variant="secondary" onClick={handleLogin}>
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-4 h-4" />
            구글 로그인
          </Button>
        </>
      )}
    </header>
  );
}
