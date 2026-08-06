import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { fetchFromDB, markNotificationRead, deleteNotification } from '../../lib/firebaseService';
import { refreshInbox } from '../../hooks/useInboxRefresh';
import { mapDocToGrid } from '../../lib/mapGrid';
import { Modal, Button, IconButton, Pill, cx } from '../ui';
import { SUGGESTION_CATEGORY_LABELS, type NotificationDocument } from '../../types/game';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: '2-digit', month: '2-digit', day: '2-digit',
    });
  } catch {
    return '';
  }
}

export function InboxModal() {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const {
    inbox, currentUserUid, closeModal, patchNotification, removeNotification,
    loadMapForPlay, setLibraryMode, showNotification, requestConfirm,
  } = useGameStore(useShallow(s => ({
    inbox: s.inbox,
    currentUserUid: s.currentUserUid,
    closeModal: s.closeModal,
    patchNotification: s.patchNotification,
    removeNotification: s.removeNotification,
    loadMapForPlay: s.loadMapForPlay,
    setLibraryMode: s.setLibraryMode,
    showNotification: s.showNotification,
    requestConfirm: s.requestConfirm,
  })));

  // 열자마자 최신 상태로 (스로틀 무시). 수동 새로고침 버튼을 대체한다 —
  // 자동 갱신을 놓쳐도 모달을 닫았다 다시 열면 강제 조회된다.
  useEffect(() => {
    if (currentUserUid) void refreshInbox(currentUserUid, true);
  }, [currentUserUid]);

  // 읽음은 낙관적으로 먼저 반영한다 — 실패해도 다음 조회에서 원상복구된다.
  function markRead(n: NotificationDocument) {
    if (n.read || !currentUserUid) return;
    patchNotification(n.id, { read: true });
    markNotificationRead(currentUserUid, n.id).catch(() => { /* 다음 조회에서 정정 */ });
  }

  async function openMap(n: NotificationDocument) {
    markRead(n);
    setBusy(true);
    try {
      const map = await fetchFromDB(n.mapId);
      if (!map) {
        showNotification('맵을 찾을 수 없습니다. 삭제되었을 수 있습니다.', '#e74c3c');
        return;
      }
      loadMapForPlay(mapDocToGrid(map), map);
      setLibraryMode(false);
      closeModal();
      navigate('/'); // 어드민 상단바에서 열었을 수도 있다 — 보드가 있는 화면으로
    } catch {
      showNotification('맵을 불러오지 못했습니다.', '#e74c3c');
    } finally {
      setBusy(false);
    }
  }

  async function remove(n: NotificationDocument) {
    if (!currentUserUid) return;
    if (!(await requestConfirm({ message: '이 알림을 삭제할까요?', danger: true }))) return;
    removeNotification(n.id);
    deleteNotification(currentUserUid, n.id).catch(() => {
      showNotification('알림 삭제에 실패했습니다.', '#e74c3c');
    });
  }

  const unread = inbox.filter(n => !n.read).length;

  return (
    <Modal
      title={`🔔 알림함${unread > 0 ? ` (${unread})` : ''}`}
      onClose={closeModal}
      width="lg"
      footer={<Button variant="primary" onClick={closeModal}>닫기</Button>}
    >
      {inbox.length === 0 ? (
        <p className="text-sm text-ink-muted py-6 text-center">
          아직 받은 알림이 없습니다.<br />
          내가 올린 맵에 다른 사람이 풀이를 제안하면 여기에 쌓입니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto">
          {inbox.map(n => (
            <li
              key={n.id}
              className={cx(
                'flex items-center gap-3 px-3 py-2.5 rounded-tile border transition-colors',
                n.read ? 'bg-surface border-line' : 'bg-primary-soft border-primary',
              )}
            >
              <span
                className={cx('w-2 h-2 rounded-full shrink-0', n.read ? 'bg-transparent' : 'bg-primary')}
                aria-label={n.read ? undefined : '읽지 않음'}
              />

              <button
                type="button"
                onClick={() => markRead(n)}
                className="flex-1 min-w-0 text-left"
              >
                <p className="text-sm text-ink truncate">
                  <strong className="font-bold">{n.fromNickname}</strong>
                  {' 님이 '}
                  <strong className="font-bold">「{n.mapTitle}」</strong>
                  {' 에 풀이를 제안했습니다'}
                </p>
                <span className="flex items-center gap-2 mt-1">
                  {n.suggestionCategory && (
                    <Pill tone={n.suggestionCategory === 'NG' ? 'danger' : 'info'}>
                      {SUGGESTION_CATEGORY_LABELS[n.suggestionCategory]}
                    </Pill>
                  )}
                  <span className="text-xs text-ink-muted">{formatDate(n.createdAt)}</span>
                </span>
              </button>

              <Button variant="secondary" onClick={() => openMap(n)} disabled={busy}>
                ▶ 맵으로
              </Button>
              <IconButton
                variant="ghost"
                aria-label="알림 삭제"
                title="알림 삭제"
                className="!text-danger"
                onClick={() => remove(n)}
              >
                🗑
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
