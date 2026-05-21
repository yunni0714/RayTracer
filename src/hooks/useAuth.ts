import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getUserProfile, initRedirectResultHandler } from '../lib/firebaseService';
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
        } catch {
          setUser({ uid: user.uid, nickname: null });
        }
      } else {
        setUser(null);
      }
    });

    return unsubscribe;
  }, [setUser, openModal]);
}
