import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getUserProfile, initRedirectResultHandler } from '../lib/firebaseService';
import { sanitizeSettings } from '../lib/userSettings';
import { refreshInbox } from './useInboxRefresh';
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

        // 알림함 초기 적재. refreshInbox 가 실패를 삼키고 스로틀 타임스탬프를
        // useInboxRefresh 와 공유한다 — 로그인 직후 중복 조회 방지.
        await refreshInbox(user.uid, true);
      } else {
        setUser(null);
      }
    });

    return unsubscribe;
  }, [setUser, openModal]);
}
