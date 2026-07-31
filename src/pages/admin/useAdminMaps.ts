import { useCallback, useEffect, useState } from 'react';
import { fetchAllMapsForAdmin } from '../../lib/firebaseService';
import type { MapDocument } from '../../types/game';

/* 어드민 맵 목록 상태. MapMasterTab 에서 한 번만 호출하고 서브탭에 props 로 내린다
   (서브탭마다 호출하면 탭 전환 = 언마운트마다 재조회한다).
   patchMap/removeMap = 서버 쓰기 성공 후 로컬 동기화 — 전체 재조회 없이 즉시 반영. */

export interface AdminMapsState {
  maps: MapDocument[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  patchMap: (id: string, patch: Partial<MapDocument>) => void;
  removeMap: (id: string) => void;
}

export function useAdminMaps(): AdminMapsState {
  const [maps, setMaps] = useState<MapDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAllMapsForAdmin()
      .then(setMaps)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const patchMap = useCallback((id: string, patch: Partial<MapDocument>) => {
    setMaps(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const removeMap = useCallback((id: string) => {
    setMaps(prev => prev.filter(m => m.id !== id));
  }, []);

  return { maps, loading, error, reload, patchMap, removeMap };
}
