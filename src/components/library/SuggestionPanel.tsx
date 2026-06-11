import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { fetchSuggestionsFromDB, deleteSuggestionFromDB } from '../../lib/firebaseService';
import { MiniGrid } from './MiniGrid';
import { Button, Pill } from '../ui';
import type { SuggestionDocument } from '../../types/game';
import type { CellData, Rotation } from '../../types/game';

export function SuggestionPanel() {
  const {
    currentLoadedMapObj, currentUserUid, currentLoadedMapAuthorUid,
    showNotification, setMapData, suggestions, setSuggestions, requestConfirm,
  } = useGameStore(useShallow(s => ({
    currentLoadedMapObj: s.currentLoadedMapObj,
    currentUserUid: s.currentUserUid,
    currentLoadedMapAuthorUid: s.currentLoadedMapAuthorUid,
    showNotification: s.showNotification,
    setMapData: s.setMapData,
    suggestions: s.suggestions,
    setSuggestions: s.setSuggestions,
    requestConfirm: s.requestConfirm,
  })));

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentLoadedMapObj) return;
    setLoading(true);
    fetchSuggestionsFromDB(currentLoadedMapObj.id)
      .then(setSuggestions)
      .finally(() => setLoading(false));
  }, [currentLoadedMapObj?.id, setSuggestions]);

  if (!currentLoadedMapObj) return null;

  const isMapOwner = !!currentUserUid && currentUserUid === currentLoadedMapAuthorUid;

  function testSuggestion(sug: SuggestionDocument) {
    const size = currentLoadedMapObj?.gridSize ?? 5;
    const grid: (CellData | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
    for (const item of sug.mapData) {
      if (item.y >= 0 && item.y < size && item.x >= 0 && item.x < size) {
        grid[item.y][item.x] = {
          type: item.type,
          rotation: item.rotation as Rotation,
          canMove: item.canMove,
          canRotate: item.canRotate,
          isInventory: item.isInventory,
        };
      }
    }
    setMapData(grid);
    showNotification('제안된 풀이를 불러왔습니다. 확인해보세요!', '#27ae60');
  }

  async function deleteSuggestion(sugId: string) {
    if (!(await requestConfirm({ message: '이 제안을 삭제하시겠습니까?', danger: true }))) return;
    try {
      await deleteSuggestionFromDB(currentLoadedMapObj!.id, sugId);
      showNotification('제안이 삭제되었습니다.', '#e74c3c');
      const updated = await fetchSuggestionsFromDB(currentLoadedMapObj!.id);
      setSuggestions(updated);
    } catch {
      showNotification('삭제 권한이 없거나 오류가 발생했습니다.', '#e74c3c');
    }
  }

  if (loading) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm font-medium text-ink-muted">불러오는 중...</p>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="px-4 py-8 text-center bg-surface-2 rounded-card">
        <p className="text-sm font-medium text-ink-muted leading-relaxed">
          아직 등록된 제안이 없습니다.<br />첫 번째로 풀이를 뽐내보세요!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-ink-muted">총 {suggestions.length}건</p>
      {suggestions.map(sug => {
        const canDelete = isMapOwner || currentUserUid === sug.suggesterUid;
        const dateStr = new Date(sug.createdAt).toLocaleDateString('ko-KR');

        return (
          <div key={sug.id} className="suggestion-item">
            {/* 썸네일 + 분류/날짜 */}
            <div className="flex items-center gap-2">
              <div className="w-14 shrink-0">
                <MiniGrid mapData={sug.mapData} variant="v2" gridSize={currentLoadedMapObj?.gridSize ?? 5} />
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                {sug.category === 'NG' ? (
                  <Pill tone="danger" className="self-start">🆖 기물 줄임</Pill>
                ) : (
                  <Pill tone="info" className="self-start">🔠 복수정답</Pill>
                )}
                <span className="text-[11px] text-ink-muted">{dateStr}</span>
              </div>
            </div>

            {/* 코멘트 */}
            {sug.comment && (
              <p
                className="text-xs font-semibold text-ink leading-normal overflow-hidden"
                style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}
              >
                {sug.comment}
              </p>
            )}

            {/* 액션 */}
            <div className="flex gap-1.5">
              <Button variant="success" block className="!text-xs" onClick={() => testSuggestion(sug)}>
                ▶ 이 풀이로 테스트
              </Button>
              {canDelete && (
                <Button
                  variant="secondary"
                  className="!text-xs !bg-transparent !text-danger !border !border-danger shrink-0"
                  onClick={() => deleteSuggestion(sug.id)}
                  aria-label="제안 삭제"
                >
                  🗑️
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
