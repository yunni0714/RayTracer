import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { IconButton } from '../ui';

// 알림함 진입 버튼 + 미읽음 배지. 에디터 헤더와 어드민 상단바가 공유한다.
// 로그인 상태에서만 렌더된다.
export function InboxButton() {
  const { currentUserUid, inbox, openModal } = useGameStore(useShallow(s => ({
    currentUserUid: s.currentUserUid,
    inbox: s.inbox,
    openModal: s.openModal,
  })));

  if (!currentUserUid) return null;

  const unreadCount = inbox.filter(n => !n.read).length;

  return (
    <div className="relative">
      <IconButton
        variant="secondary"
        onClick={() => openModal('inbox')}
        aria-label="알림함"
        title={unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개` : '알림함'}
      >
        🔔
      </IconButton>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center bg-danger text-white text-[10px] font-bold rounded-full pointer-events-none">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </div>
  );
}
