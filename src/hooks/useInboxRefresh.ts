import { useEffect } from 'react';
import { fetchInbox } from '../lib/firebaseService';
import { useGameStore } from '../store/gameStore';

// 알림함 자동 갱신.
//
// onSnapshot(실시간 구독)은 쓰지 않는다 — 코드베이스 전체가 일회성 getDocs 컨벤션이고,
// 리스너 해제를 놓치면 로그아웃 후에도 남의 inbox 경로를 구독해 permission-denied 가
// 반복된다. 대신 "시간이 흘렀을 법한" 자연스러운 시점에 다시 조회하는 근사치로 간다.

const THROTTLE_MS = 60_000;
let lastFetch = 0;

/** 테스트에서 모듈 상태를 초기화하기 위한 훅. 런타임 호출부 없음. */
export function __resetInboxThrottle(): void {
  lastFetch = 0;
}

// force=true 면 스로틀 무시 (로그인 직후 · 알림함 모달 열림).
// 실패는 조용히 삼킨다 — 알림은 부가 기능이라 본 동작을 막으면 안 된다.
export async function refreshInbox(uid: string, force = false): Promise<void> {
  if (!force && Date.now() - lastFetch < THROTTLE_MS) return;
  lastFetch = Date.now();
  try {
    useGameStore.getState().setInbox(await fetchInbox(uid));
  } catch { /* 규칙 미배포 / 오프라인 — 기존 알림함 유지 */ }
}

export function useInboxRefresh(): void {
  const uid = useGameStore(s => s.currentUserUid);
  const isLibraryMode = useGameStore(s => s.isLibraryMode);

  // ① 탭 포커스 복귀 — 자리를 비웠다 돌아왔다 = 시간이 흘렀다 (주력 신호)
  useEffect(() => {
    if (!uid) return;
    const onWake = () => { if (!document.hidden) void refreshInbox(uid); };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [uid]);

  // ② 라이브러리 진입 — 로비에 왔다 = 둘러보는 중 (보조 신호).
  // 편집↔플레이 토글은 클릭 한 번이라 너무 잦고 알림 발생과 무관해서 제외한다.
  useEffect(() => {
    if (uid && isLibraryMode) void refreshInbox(uid);
  }, [uid, isLibraryMode]);
}
