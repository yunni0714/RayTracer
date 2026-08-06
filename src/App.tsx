import { useEffect } from 'react';
import { Routes, Route, useSearchParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { useUserSettings } from './hooks/useUserSettings';
import { useInboxRefresh } from './hooks/useInboxRefresh';
import { useGameStore } from './store/gameStore';
import { fetchFromDB } from './lib/firebaseService';
import { mapDocToGrid } from './lib/mapGrid';
import { loadPieceConfig } from './lib/pieceConfig';
import { loadCatalogConfig } from './lib/catalogConfig';
import { EditorPage } from './pages/EditorPage';
import { AdminLayout } from './pages/admin/AdminLayout';

function useUrlMapLoader() {
  const [searchParams] = useSearchParams();
  const currentUserUid = useGameStore(s => s.currentUserUid);
  const { loadMapForPlay, setLibraryMode } = useGameStore(useShallow(s => ({
    loadMapForPlay: s.loadMapForPlay,
    setLibraryMode: s.setLibraryMode,
  })));

  useEffect(() => {
    const mapId = searchParams.get('mapId');
    if (!mapId) return;

    fetchFromDB(mapId).then(map => {
      if (!map) return;
      loadMapForPlay(mapDocToGrid(map), map);
      setLibraryMode(false);
    });
  // URL이 처음 로드될 때만 1회 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserUid]);
}

// 부팅 시 1회: 기물 config 오버레이 로드 (실패해도 코드 기본값으로 동작)
function usePieceConfigLoader() {
  const bump = useGameStore(s => s.bumpPieceConfigRev);
  useEffect(() => {
    loadPieceConfig().then(result => { if (result) bump(); });
  }, [bump]);
}

// 부팅 시 1회: 라이브러리 카탈로그 오버레이 로드 (실패해도 코드 기본값으로 동작)
function useCatalogConfigLoader() {
  const bump = useGameStore(s => s.bumpCatalogConfigRev);
  useEffect(() => {
    loadCatalogConfig().then(result => { if (result) bump(); });
  }, [bump]);
}

export function App() {
  useTheme();
  useUserSettings();
  useAuth();
  useInboxRefresh();
  useUrlMapLoader();
  usePieceConfigLoader();
  useCatalogConfigLoader();

  return (
    <Routes>
      <Route path="/" element={<EditorPage />} />
      {/* 어드민 셸 — /admin 은 기본 탭으로 리다이렉트, 탭 상태는 URL 이 보관 */}
      <Route path="/admin" element={<AdminLayout />} />
      <Route path="/admin/:tab" element={<AdminLayout />} />
      {/* 탭 내부 서브탭 (맵 마스터) */}
      <Route path="/admin/:tab/:sub" element={<AdminLayout />} />
      <Route path="*" element={<EditorPage />} />
    </Routes>
  );
}
