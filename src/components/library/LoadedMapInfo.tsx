import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { useMapReactions } from '../../hooks/useMapReactions';
import { deleteMapFromDB } from '../../lib/firebaseService';
import type { Difficulty } from '../../types/game';

const DIFFICULTIES: Difficulty[] = ['Tutor', 'Easy', 'Normal', 'Hard', 'Insane'];

const DIFF_COLORS: Record<Difficulty, string> = {
  Tutor: '#3498db', Easy: '#2ecc71', Normal: '#f39c12', Hard: '#e67e22', Insane: '#e74c3c',
};

function calculateUserDifficulty(diffVotes: Partial<Record<Difficulty, number>>): Difficulty | null {
  const entries = Object.entries(diffVotes) as [Difficulty, number][];
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

export function LoadedMapInfo() {
  const {
    currentLoadedMapObj, currentUserUid, currentLoadedMapAuthorUid,
    currentMapReactions, openModal, showNotification,
    isMapEditMode, enterMapEditMode, exitMapEditMode,
  } = useGameStore(useShallow(s => ({
    currentLoadedMapObj: s.currentLoadedMapObj,
    currentUserUid: s.currentUserUid,
    currentLoadedMapAuthorUid: s.currentLoadedMapAuthorUid,
    currentMapReactions: s.currentMapReactions,
    openModal: s.openModal,
    showNotification: s.showNotification,
    isMapEditMode: s.isMapEditMode,
    enterMapEditMode: s.enterMapEditMode,
    exitMapEditMode: s.exitMapEditMode,
  })));

  const { toggleReaction, voteDifficulty, localState } = useMapReactions();

  if (!currentLoadedMapObj) return null;

  const map = currentLoadedMapObj;
  const isMapOwner = !!currentUserUid && currentUserUid === currentLoadedMapAuthorUid;
  const userDiff = calculateUserDifficulty(map.diffVotes);
  const evalLabel = userDiff ?? 'None';

  const version = map.version ?? 1;
  const title = `🗺️ ${map.title}${version >= 2 ? ` (ver. ${version})` : ''}`;

  async function handleDeleteMap() {
    if (!window.confirm('정말로 이 맵을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며, 모든 제안과 평가도 함께 삭제됩니다.')) return;
    try {
      await deleteMapFromDB(map.id);
      showNotification('맵이 성공적으로 삭제되었습니다.', '#e74c3c');
      useGameStore.getState().resetEditorState();
    } catch {
      showNotification('맵 삭제 권한이 없거나 오류가 발생했습니다.', '#e74c3c');
    }
  }

  const btnBase: React.CSSProperties = {
    width: '100%', padding: '7px 10px', border: 'none', borderRadius: 6,
    fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'opacity 0.15s',
  };

  return (
    <div className="flex flex-col gap-2 mt-4 pt-3 border-t border-gray-200 text-sm">
      {/* 제목 + 작성자 */}
      <p className="font-bold text-gray-800 truncate text-xs" title={title}>{title}</p>
      <p className="text-xs text-gray-500">{map.author}</p>

      {/* 난이도 배지 */}
      <div className="flex gap-1.5 flex-wrap">
        <span className={`diff-pill diff-${map.difficulty}`} style={{ fontSize: 11 }}>
          {map.difficulty}
        </span>
        <span className={`diff-pill diff-${evalLabel}`} style={{ fontSize: 11 }}>
          {userDiff ?? '평가 부족'}
        </span>
      </div>

      {/* 반응 버튼 */}
      <div className="flex gap-1.5">
        <button
          onClick={() => toggleReaction('reactionOk')}
          style={{
            ...btnBase,
            background: localState.ok ? '#27ae60' : 'transparent',
            color: localState.ok ? 'white' : '#27ae60',
            border: `1.5px solid #27ae60`,
          }}
        >
          ✅ {currentMapReactions.ok}
        </button>
        <button
          onClick={() => toggleReaction('reactionGod')}
          style={{
            ...btnBase,
            background: localState.god ? '#ef4444' : 'transparent',
            color: localState.god ? 'white' : '#ef4444',
            border: `1.5px solid #ef4444`,
          }}
        >
          👍 {currentMapReactions.god}
        </button>
      </div>

      {/* 체감 난이도 투표 */}
      <div className="flex flex-col gap-1">
        <p className="text-xs text-gray-500 font-medium">체감 난이도 투표</p>
        <div className="flex gap-1 flex-wrap">
          {DIFFICULTIES.map(level => (
            <button
              key={level}
              onClick={() => voteDifficulty(level)}
              style={{
                padding: '4px 7px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 5,
                cursor: 'pointer',
                fontFamily: 'inherit',
                border: `1.5px solid ${DIFF_COLORS[level]}`,
                background: localState.diff === level ? DIFF_COLORS[level] : 'transparent',
                color: localState.diff === level ? 'white' : DIFF_COLORS[level],
                transition: 'all 0.15s',
              }}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* 작성자/비작성자 액션 버튼 */}
      <div className="flex flex-col gap-1.5 mt-1">
        {isMapOwner && isMapEditMode ? (
          <>
            <button
              onClick={() => openModal('upload')}
              style={{ ...btnBase, background: '#10b981', color: 'white' }}
            >
              💾 수정 완료 (업로드)
            </button>
            <button
              onClick={() => {
                if (window.confirm('수정한 내용을 모두 버리고 원래 맵으로 돌아가시겠습니까?')) {
                  exitMapEditMode({ restore: true });
                  showNotification('수정이 취소되었습니다.', '#7f8c8d');
                }
              }}
              style={{ ...btnBase, background: 'transparent', color: '#ef4444', border: '1.5px solid #ef4444' }}
            >
              ❌ 수정 취소
            </button>
          </>
        ) : isMapOwner ? (
          <>
            <button
              onClick={() => {
                enterMapEditMode();
                showNotification('✏️ 수정 모드입니다. 그리드를 자유롭게 배치한 뒤 저장하세요.', '#f59e0b');
              }}
              style={{ ...btnBase, background: '#10b981', color: 'white' }}
            >
              ✏️ 맵 수정하기
            </button>
            <button
              onClick={handleDeleteMap}
              style={{ ...btnBase, background: 'transparent', color: '#ef4444', border: '1.5px solid #ef4444' }}
            >
              🗑️ 맵 삭제
            </button>
          </>
        ) : (
          <button
            onClick={() => openModal('suggestion')}
            style={{ ...btnBase, background: '#f59e0b', color: 'white' }}
          >
            내 풀이 제안하기
          </button>
        )}
      </div>
    </div>
  );
}
