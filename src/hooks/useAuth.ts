import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getUserProfile, initRedirectResultHandler, fetchInbox } from '../lib/firebaseService';
import { sanitizeSettings } from '../lib/userSettings';
import { useGameStore } from '../store/gameStore';

export function useAuth(): void {
  const setUser = useGameStore(s => s.setUser);
  const openModal = useGameStore(s => s.openModal);

  useEffect(() => {
    initRedirectResultHandler();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const profile = await getUserProfile(user.uid);
          if (profile?.nickname) {
            setUser({ uid: user.uid, nickname: profile.nickname });
          } else {
            setUser({ uid: user.uid, nickname: null });
            openModal('nickname');
          }
          // 계정 설정 정본을 로컬 위에 덮어쓴다 (없으면 sanitize 가 기본값으로 채움)
          if (profile?.settings) {
            useGameStore.getState().applySettings(sanitizeSettings(profile.settings));
          }
        } catch {
          setUser({ uid: user.uid, nickname: null });
        }

        // 알림함은 부가 기능 — 실패해도 로그인 흐름을 막지 않는다.
        try {
          useGameStore.getState().setInbox(await fetchInbox(user.uid));
        } catch { /* 규칙 미배포/오프라인 — 빈 알림함으로 둔다 */ }
      } else {
        setUser(null);
      }
    });

    return unsubscribe;
  }, [setUser, openModal]);
}
