import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { fetchSuggestionsFromDB, deleteSuggestionFromDB } from '../../lib/firebaseService';
import { formatDateTime } from '../../lib/adminMaps';
import { MiniGrid } from '../../components/library/MiniGrid';
import { Button, IconButton, Pill } from '../../components/ui';
import type { MapDocument, SuggestionDocument } from '../../types/game';

/* 맵 한 개의 풀이 제안 목록 — 맵 관리 카드의 메타 편집 패널 오른쪽에 붙는다.
   (구 [제안 관리] 서브탭 이식: 맵을 드롭다운으로 다시 고르지 않고 카드에서 바로 본다.)
   제안 썸네일은 풀이 자체이므로 revealRotation (SuggestionPanel 과 같은 규칙). */

export function MapSuggestionsPanel({ map }: { map: MapDocument }) {
  const { showNotification, requestConfirm } = useGameStore(useShallow(s => ({
    showNotification: s.showNotification,
    requestConfirm: s.requestConfirm,
  })));

  const [suggestions, setSuggestions] = useState<SuggestionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapId = map.id;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchSuggestionsFromDB(mapId)
      .then(setSuggestions)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [mapId]);

  useEffect(() => { load(); }, [load]);

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
    <div className="flex flex-col gap-2 p-3 min-w-0">
      <div className="flex items-center gap-2">
        <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">
          💬 풀이 제안
        </h5>
        {!loading && !error && (
          <Pill tone="neutral" className="!text-[9px] !px-1 !py-0">{suggestions.length}</Pill>
        )}
        <IconButton
          aria-label="제안 새로고침"
          className="!text-[10px] !px-1.5 !py-1 ml-auto"
          onClick={load}
          disabled={loading}
        >🔄</IconButton>
      </div>

      {error ? (
        <p className="py-6 text-center text-xs text-danger">로드 실패 — {error}</p>
      ) : loading ? (
        <p className="py-6 text-center text-xs text-ink-muted">불러오는 중…</p>
      ) : suggestions.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-muted">이 맵에 대한 풀이 제안이 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-0.5">
          {suggestions.map(sug => (
            <div
              key={sug.id}
              className="flex items-start gap-2 p-2 bg-surface border border-line rounded-tile"
            >
              <span className="w-16 shrink-0">
                <MiniGrid
                  mapData={sug.mapData}
                  revealRotation
                  variant="v2"
                  gridSize={map.gridSize ?? 5}
                />
              </span>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {sug.category === 'NG'
                    ? <Pill tone="danger" className="!text-[9px] !px-1 !py-0">🆖 기물 줄임</Pill>
                    : <Pill tone="info" className="!text-[9px] !px-1 !py-0">🔠 복수정답</Pill>}
                  <strong className="text-[11px]">{sug.suggesterNickname || '익명'}</strong>
                  <code className="text-[9px] text-ink-muted truncate">{sug.suggesterUid}</code>
                </div>
                <p className="text-[11px] text-ink whitespace-pre-wrap leading-relaxed break-words">
                  {sug.comment || '(코멘트 없음)'}
                </p>
                <p className="text-[10px] text-ink-muted">{formatDateTime(sug.createdAt)}</p>
              </div>
              <Button variant="danger" className="!text-[10px] !px-1.5 shrink-0" onClick={() => remove(sug)}>
                🗑
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
