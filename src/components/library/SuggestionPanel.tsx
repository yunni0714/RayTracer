import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { fetchSuggestionsFromDB, deleteSuggestionFromDB } from '../../lib/firebaseService';
import { MiniGrid } from './MiniGrid';
import { Button, Pill } from '../ui';
import type { SuggestionDocument } from '../../types/game';
import type { CellData, Rotation } from '../../types/game';
import { GRID_SIZE } from '../../lib/svgArt';

function sugMapToDTO(mapData: SuggestionDocument['mapData']) {
  return mapData;
}

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
  const panelTitle = isMapOwner
    ? `💡 제안 관리 및 맵 수정 (${suggestions.length}건)`
    : `💡 다른 풀이 제안 (${suggestions.length}건)`;

  function testSuggestion(sug: SuggestionDocument) {
    const grid: (CellData | null)[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
    for (const item of sug.mapData) {
      if (item.y >= 0 && item.y < GRID_SIZE && item.x >= 0 && item.x < GRID_SIZE) {
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

  return (
    <div className="flex flex-col gap-3">
      <p className="mb-1 pb-2.5 text-[13px] font-extrabold text-ink border-b-2 border-line">
        {panelTitle}
      </p>

      {loading ? (
        <div className="py-8 text-center">
          <p className="text-sm font-medium text-ink-muted">불러오는 중...</p>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="mt-4 px-5 py-10 text-center bg-surface-2 rounded-card">
          <p className="text-sm font-medium text-ink-muted leading-relaxed">
            아직 등록된 제안이 없습니다.<br />첫 번째로 풀이를 뽐내보세요!
          </p>
        </div>
      ) : (
        <div className="suggestion-list">
          {suggestions.map(sug => {
            const canDelete = isMapOwner || currentUserUid === sug.suggesterUid;
            const dateStr = new Date(sug.createdAt).toLocaleDateString('ko-KR');

            return (
              <div key={sug.id} className="suggestion-item">
                {/* 미니 그리드 38% */}
                <div className="w-[38%] shrink-0">
                  <MiniGrid mapData={sugMapToDTO(sug.mapData)} variant="v2" />
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0 flex flex-col gap-1.5 justify-center">
                  <div className="flex items-center gap-2 flex-wrap">
                    {sug.category === 'NG' ? (
                      <Pill tone="danger">🆖 기물 줄임</Pill>
                    ) : (
                      <Pill tone="info">🔠 복수정답</Pill>
                    )}
                    <span className="text-[11px] text-ink-muted">{dateStr}</span>
                  </div>
                  <p
                    className="text-xs font-semibold text-ink leading-normal overflow-hidden"
                    style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}
                  >
                    {sug.comment}
                  </p>
                </div>

                {/* 액션 버튼 */}
                <div className="flex flex-col gap-2 shrink-0 self-center">
                  <Button variant="success" className="!text-xs whitespace-nowrap" onClick={() => testSuggestion(sug)}>
                    ▶ 이 풀이로 테스트
                  </Button>
                  {canDelete && (
                    <Button
                      variant="secondary"
                      className="!text-xs !bg-transparent !text-danger !border !border-danger whitespace-nowrap"
                      onClick={() => deleteSuggestion(sug.id)}
                    >
                      🗑️ 삭제
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
