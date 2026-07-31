import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { fetchSuggestionsFromDB, deleteSuggestionFromDB } from '../../lib/firebaseService';
import { formatDateTime } from '../../lib/adminMaps';
import { MiniGrid } from '../../components/library/MiniGrid';
import { Button, Select, Pill } from '../../components/ui';
import type { AdminMapsState } from './useAdminMaps';
import type { SuggestionDocument } from '../../types/game';

/* [맵 마스터 › 제안 관리] — 맵별 풀이 제안 조회/삭제 (ADMIN.html 제안 탭 이식).
   제안 썸네일은 풀이 자체이므로 revealRotation (SuggestionPanel 과 같은 규칙). */

export function SuggestionsTab({ admin }: { admin: AdminMapsState }) {
  const { showNotification, requestConfirm } = useGameStore(useShallow(s => ({
    showNotification: s.showNotification,
    requestConfirm: s.requestConfirm,
  })));

  const [mapId, setMapId] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMap = admin.maps.find(m => m.id === mapId);

  const load = useCallback((id: string) => {
    if (!id) { setSuggestions([]); setError(null); return; }
    setLoading(true);
    setError(null);
    fetchSuggestionsFromDB(id)
      .then(setSuggestions)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(mapId); }, [mapId, load]);

  async function remove(sug: SuggestionDocument) {
    if (!(await requestConfirm({
      message: `[${sug.suggesterNickname || '익명'}] 의 풀이 제안을 삭제할까요?`, danger: true,
    }))) return;
    try {
      await deleteSuggestionFromDB(mapId, sug.id);
      setSuggestions(prev => prev.filter(s => s.id !== sug.id));
      showNotification('제안을 삭제했습니다.', '#e74c3c');
    } catch (err) {
      const code = err instanceof Error ? ((err as { code?: string }).code ?? err.message) : String(err);
      showNotification(`삭제 실패 — ${code}`, '#e74c3c');
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Select
          value={mapId}
          onChange={e => setMapId(e.target.value)}
          className="flex-1 !w-auto min-w-[220px] cursor-pointer"
          aria-label="맵 선택"
        >
          <option value="">맵을 선택하세요…</option>
          {admin.maps.map(m => (
            <option key={m.id} value={m.id}>{m.title || '제목 없음'} ({m.id.slice(0, 8)}…)</option>
          ))}
        </Select>
        <Button variant="secondary" onClick={() => load(mapId)} disabled={!mapId || loading}>
          {loading ? '불러오는 중…' : '🔄 새로고침'}
        </Button>
        {mapId && !loading && !error && (
          <span className="text-[11px] text-ink-muted">제안 {suggestions.length}개</span>
        )}
      </div>

      {!mapId ? (
        <p className="py-10 text-center text-xs text-ink-muted">위에서 맵을 선택하세요.</p>
      ) : error ? (
        <p className="py-10 text-center text-xs text-danger">로드 실패 — {error}</p>
      ) : loading ? (
        <p className="py-10 text-center text-xs text-ink-muted">불러오는 중…</p>
      ) : suggestions.length === 0 ? (
        <p className="py-10 text-center text-xs text-ink-muted">이 맵에 대한 풀이 제안이 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-2 pb-8">
          {suggestions.map(sug => (
            <div key={sug.id} className="flex items-start gap-3 p-3 bg-surface border border-line rounded-tile flex-wrap">
              <div className="w-24 shrink-0">
                <MiniGrid
                  mapData={sug.mapData}
                  revealRotation
                  variant="v2"
                  gridSize={selectedMap?.gridSize ?? 5}
                />
              </div>
              <div className="flex-1 min-w-[200px] flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {sug.category === 'NG'
                    ? <Pill tone="danger">🆖 기물 줄임</Pill>
                    : <Pill tone="info">🔠 복수정답</Pill>}
                  <strong className="text-xs">{sug.suggesterNickname || '익명'}</strong>
                  <code className="text-[10px] text-ink-muted">{sug.suggesterUid}</code>
                </div>
                <p className="text-xs text-ink whitespace-pre-wrap leading-relaxed">
                  {sug.comment || '(코멘트 없음)'}
                </p>
                <p className="text-[11px] text-ink-muted">{formatDateTime(sug.createdAt)}</p>
              </div>
              <Button variant="danger" className="!text-xs shrink-0" onClick={() => remove(sug)}>
                🗑 삭제
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
