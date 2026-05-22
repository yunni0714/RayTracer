import { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';

export function Notification() {
  const notification = useGameStore(s => s.notification);
  const clearNotification = useGameStore(s => s.clearNotification);

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(clearNotification, 2000);
    return () => clearTimeout(timer);
  }, [notification, clearNotification]);

  if (!notification) return null;

  return (
    <div
      className="fixed bottom-5 right-5 px-4 py-3 rounded-lg text-white font-medium text-sm shadow-lg notification-enter z-50"
      style={{ backgroundColor: notification.color }}
    >
      {notification.message}
    </div>
  );
}
