import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { useMapReactions } from '../../hooks/useMapReactions';
import { deleteMapFromDB } from '../../lib/firebaseService';
import { Button, Pill, cx, type PillTone } from '../ui';
import type { Difficulty } from '../../types/game';

const DIFFICULTIES: Difficulty[] = ['Tutor', 'Easy', 'Normal', 'Hard', 'Insane'];

const DIFF_TONE: Record<Difficulty, PillTone> = {
  Tutor: 'tutor', Easy: 'easy', Normal: 'normal', Hard: 'hard', Insane: 'insane',
};

// 난이도 투표 칩 — 토큰 var 색으로 활성/비활성 표현
const DIFF_VAR: Record<Difficulty, string> = {
  Tutor: '--diff-tutor', Easy: '--diff-easy', Normal: '--diff-normal',
  Hard: '--diff-hard', Insane: '--diff-insane',
};

function calculateUserDifficulty(diffVotes: Partial<Record<Difficulty, number>> | undefined | null): Difficulty | null {
  if (!diffVotes) return null;
  const entries = Object.entries(diffVotes) as [Difficulty, number][];
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

export function LoadedMapInfo() {
  const {
    currentLoadedMapObj, currentUserUid, currentLoadedMapAuthorUid,
    currentMapReactions, openModal, showNotification,
    isMapEditMode, enterMapEditMode, exitMapEditMode, requestConfirm,
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
    requestConfirm: s.requestConfirm,
  })));

  const { toggleReaction, voteDifficulty, localState } = useMapReactions();

  if (!currentLoadedMapObj) return null;

  const map = currentLoadedMapObj;
  const isMapOwner = !!currentUserUid && currentUserUid === currentLoadedMapAuthorUid;
  const userDiff = calculateUserDifficulty(map.diffVotes);

  const version = map.version ?? 1;
  const title = `🗺️ ${map.title}${version >= 2 ? ` (ver. ${version})` : ''}`;

  async function handleDeleteMap() {
    if (!(await requestConfirm({ message: '정말로 이 맵을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며, 모든 제안과 평가도 함께 삭제됩니다.', danger: true }))) return;
    try {
      await deleteMapFromDB(map.id);
      showNotification('맵이 성공적으로 삭제되었습니다.', '#e74c3c');
      useGameStore.getState().resetEditorState();
    } catch {
      showNotification('맵 삭제 권한이 없거나 오류가 발생했습니다.', '#e74c3c');
    }
  }

  return (
    <div className="flex flex-col gap-2 pt-3 border-t border-line text-sm">
      {/* 제목 + 작성자 */}
      <p className="font-bold text-ink truncate text-xs" title={title}>{title}</p>
      <p className="text-xs text-ink-muted">{map.author}</p>

      {/* 난이도 배지 */}
      <div className="flex gap-1.5 flex-wrap">
        <Pill tone={DIFF_TONE[map.difficulty]}>{map.difficulty}</Pill>
        <Pill tone={userDiff ? DIFF_TONE[userDiff] : 'none'}>{userDiff ?? '평가 부족'}</Pill>
      </div>

      {/* 반응 버튼 */}
      <div className="flex gap-1.5">
        <Button
          variant="secondary"
          block
          className={cx('!text-xs !border !border-success', localState.ok
            ? '!bg-success !text-white'
            : '!bg-transparent !text-success')}
          onClick={() => toggleReaction('reactionOk')}
        >
          ✅ {currentMapReactions.ok}
        </Button>
        <Button
          variant="secondary"
          block
          className={cx('!text-xs !border !border-danger', localState.god
            ? '!bg-danger !text-white'
            : '!bg-transparent !text-danger')}
          onClick={() => toggleReaction('reactionGod')}
        >
          👍 {currentMapReactions.god}
        </Button>
      </div>

      {/* 체감 난이도 투표 */}
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">체감 난이도 투표</p>
        <div className="flex gap-1 flex-wrap">
          {DIFFICULTIES.map(level => (
            <Button
              key={level}
              variant="secondary"
              className="!text-[11px] !px-1.5 !py-1 !border"
              style={{
                borderColor: `var(${DIFF_VAR[level]})`,
                background: localState.diff === level ? `var(${DIFF_VAR[level]})` : 'transparent',
                color: localState.diff === level ? 'white' : `var(${DIFF_VAR[level]})`,
              }}
              onClick={() => voteDifficulty(level)}
            >
              {level}
            </Button>
          ))}
        </div>
      </div>

      {/* 작성자/비작성자 액션 버튼 */}
      <div className="flex flex-col gap-1.5 mt-1">
        {isMapOwner && isMapEditMode ? (
          <>
            <Button variant="success" block onClick={() => openModal('upload')}>
              💾 수정 완료 (업로드)
            </Button>
            <Button
              variant="secondary"
              block
              className="!bg-transparent !text-danger !border !border-danger"
              onClick={async () => {
                if (await requestConfirm({ message: '수정한 내용을 모두 버리고 원래 맵으로 돌아가시겠습니까?' })) {
                  exitMapEditMode({ restore: true });
                  showNotification('수정이 취소되었습니다.', '#7f8c8d');
                }
              }}
            >
              ❌ 수정 취소
            </Button>
          </>
        ) : isMapOwner ? (
          <>
            <Button
              variant="success"
              block
              onClick={() => {
                enterMapEditMode();
                showNotification('✏️ 수정 모드입니다. 그리드를 자유롭게 배치한 뒤 저장하세요.', '#f59e0b');
              }}
            >
              ✏️ 맵 수정하기
            </Button>
            <Button
              variant="secondary"
              block
              className="!bg-transparent !text-danger !border !border-danger"
              onClick={handleDeleteMap}
            >
              🗑️ 맵 삭제
            </Button>
          </>
        ) : (
          <Button variant="warning" block onClick={() => openModal('suggestion')}>
            내 풀이 제안하기
          </Button>
        )}
      </div>
    </div>
  );
}
