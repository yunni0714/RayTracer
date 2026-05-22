import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { fetchSuggestionsFromDB, deleteSuggestionFromDB } from '../../lib/firebaseService';
import { MiniGrid } from './MiniGrid';
import type { SuggestionDocument } from '../../types/game';
import type { CellData, Rotation } from '../../types/game';
import { GRID_SIZE } from '../../lib/svgArt';

function sugMapToDTO(mapData: SuggestionDocument['mapData']) {
  return mapData;
}

export function SuggestionPanel() {
  const {
    currentLoadedMapObj, currentUserUid, currentLoadedMapAuthorUid,
    showNotification, setMapData, suggestions, setSuggestions,
  } = useGameStore(useShallow(s => ({
    currentLoadedMapObj: s.currentLoadedMapObj,
    currentUserUid: s.currentUserUid,
    currentLoadedMapAuthorUid: s.currentLoadedMapAuthorUid,
    showNotification: s.showNotification,
    setMapData: s.setMapData,
    suggestions: s.suggestions,
    setSuggestions: s.setSuggestions,
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
    if (!window.confirm('이 제안을 삭제하시겠습니까?')) return;
    try {
      await deleteSuggestionFromDB(currentLoadedMapObj!.id, sugId);
      showNotification('제안이 삭제되었습니다.', '#e74c3c');
      const updated = await fetchSuggestionsFromDB(currentLoadedMapObj!.id);
      setSuggestions(updated);
    } catch {
      showNotification('삭제 권한이 없거나 오류가 발생했습니다.', '#e74c3c');
    }
  }

  const btnBase: React.CSSProperties = {
    border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700,
    fontSize: 12, whiteSpace: 'nowrap', transition: 'background 0.2s', fontFamily: 'inherit',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: 10 }}>
        {panelTitle}
      </p>

      {loading ? (
        <div style={{ padding: '30px 0', textAlign: 'center' }}>
          <p style={{ color: '#94a3b8', fontSize: 14, fontWeight: 500 }}>불러오는 중...</p>
        </div>
      ) : suggestions.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: 12, marginTop: 15 }}>
          <p style={{ color: '#64748b', fontSize: 14, fontWeight: 500, lineHeight: 1.6, margin: 0 }}>
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
                <div style={{ width: '38%', flexShrink: 0 }}>
                  <MiniGrid mapData={sugMapToDTO(sug.mapData)} variant="v2" />
                </div>

                {/* 내용 */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {sug.category === 'NG' ? (
                      <span style={{ background: '#ef4444', color: 'white', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>🆖 기물 줄임</span>
                    ) : (
                      <span style={{ background: '#3b82f6', color: 'white', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>🔠 복수정답</span>
                    )}
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>{dateStr}</span>
                  </div>
                  <p style={{
                    margin: 0, fontSize: 12, fontWeight: 600, color: '#1e293b', lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {sug.comment}
                  </p>
                </div>

                {/* 액션 버튼 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, alignSelf: 'center' }}>
                  <button
                    onClick={() => testSuggestion(sug)}
                    style={{ ...btnBase, padding: '9px 12px', background: '#10b981', color: 'white' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#059669')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#10b981')}
                  >
                    ▶ 이 풀이로 테스트
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => deleteSuggestion(sug.id)}
                      style={{ ...btnBase, padding: '7px 12px', background: 'transparent', color: '#ef4444', border: '1px solid #f87171' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ef4444'; }}
                    >
                      🗑️ 삭제
                    </button>
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
