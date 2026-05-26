import { useRef, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { signInWithGoogle, signOutUser } from '../../lib/firebaseService';

export function Header() {
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

  return (
    <header className="flex items-center gap-3 px-4 py-2 bg-ray-dark text-white shadow-md">
      <h1 className="text-lg font-bold tracking-wide mr-auto">⚡ Project Ray</h1>

      <button
        onClick={handleNewMap}
        className="px-3 py-1.5 bg-ray-purple hover:opacity-90 rounded text-sm font-medium transition-opacity"
      >
        + 새 맵
      </button>

      <button
        onClick={() => setLibraryMode(!isLibraryMode)}
        className="px-3 py-1.5 bg-ray-blue hover:opacity-90 rounded text-sm font-medium transition-opacity"
      >
        {isLibraryMode ? '✏️ 에디터' : '📚 라이브러리'}
      </button>

      {!isLibraryMode && (!currentLoadedMapObj || isMapEditMode) && (
        <button
          onClick={toggleMode}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-opacity hover:opacity-90 ${
            isEditorMode ? 'bg-ray-green' : 'bg-ray-orange'
          }`}
        >
          {isEditorMode ? '▶ 테스트 모드' : '✏️ 에디터 모드'}
        </button>
      )}

      {currentUserUid ? (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(v => !v)}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-sm font-medium transition-colors"
          >
            👤 {currentUserNickname ?? '사용자'}
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white text-gray-800 rounded shadow-lg min-w-[160px] z-50">
              <button
                onClick={() => { openModal('changeNickname'); setDropdownOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
              >
                ✏️ 닉네임 변경
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-ray-red transition-colors"
              >
                🚪 로그아웃
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={handleLogin}
          className="flex items-center gap-2 px-3 py-1.5 bg-white text-gray-800 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-4 h-4" />
          구글 로그인
        </button>
      )}
    </header>
  );
}
