import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../../store/gameStore';
import { ConfirmModal } from './ConfirmModal';

// 스토어 confirmState 를 구독해 ConfirmModal 을 렌더한다. 앱에 1회만 마운트.
export function ConfirmHost() {
  const { confirmState, resolveConfirm } = useGameStore(useShallow(s => ({
    confirmState: s.confirmState,
    resolveConfirm: s.resolveConfirm,
  })));

  if (!confirmState) return null;

  return (
    <ConfirmModal
      {...confirmState}
      onConfirm={() => resolveConfirm(true)}
      onCancel={() => resolveConfirm(false)}
    />
  );
}
