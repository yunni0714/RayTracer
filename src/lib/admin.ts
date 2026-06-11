// 관리자 UID 화이트리스트 — 어드민 패널 진입 게이트(UI 노출 제어).
//
// ⚠️ 이 목록은 UI 숨김일 뿐이다. 실제 권한 강제는 firestore.rules 의
//    isAdmin() — 두 목록을 반드시 동기화할 것.
//
// TODO(maker): 본인 Firebase Auth UID 를 추가할 것.
//   (로그인 후 콘솔에서 useGameStore.getState().currentUserUid 또는
//    Firebase Console > Authentication 에서 확인)
export const ADMIN_UIDS: string[] = [
   'gy0yLjz0wLgZsFnC2f4ZOB1nTa53',
];

export function isAdminUid(uid: string | null): boolean {
  return !!uid && ADMIN_UIDS.includes(uid);
}
