import {
  collection, addDoc, doc, getDoc, getDocs,
  setDoc, query, orderBy, limit, updateDoc, increment, deleteDoc,
} from 'firebase/firestore';
import {
  GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut,
} from 'firebase/auth';
import { db, auth } from './firebase';
import type {
  MapDocument, SuggestionDocument, NotificationDocument, Difficulty,
} from '../types/game';

const googleProvider = new GoogleAuthProvider();

// ── Auth ────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<void> {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
      await signInWithRedirect(auth, googleProvider);
    } else {
      throw err;
    }
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function initRedirectResultHandler(): void {
  getRedirectResult(auth).catch((err) => {
    console.error('[auth] redirect sign-in failed:', err);
  });
}

// ── User Profile ────────────────────────────────────────

export interface UserProfile {
  nickname: string;
  createdAt: string;
  /** 계정 설정 — 검증은 lib/userSettings.ts 의 sanitizeSettings() 가 한다 */
  settings?: Record<string, unknown>;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function createUserProfile(uid: string, nickname: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { nickname, createdAt: new Date().toISOString() });
}

export async function updateUserNickname(uid: string, nickname: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { nickname });
}

// 프로필 문서가 아직 없을 수도 있으므로 merge setDoc (updateDoc 은 문서 부재 시 실패).
// rules 의 users/{userId} 는 소유자에게 create/update 를 모두 열어 둔다.
export async function updateUserSettings(
  uid: string, settings: Record<string, unknown>,
): Promise<void> {
  await setDoc(doc(db, 'users', uid), { settings }, { merge: true });
}

// ── Maps CRUD ───────────────────────────────────────────

export async function uploadToDB(data: Omit<MapDocument, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'maps'), data);
  return ref.id;
}

export async function fetchFromDB(id: string): Promise<MapDocument | null> {
  const snap = await getDoc(doc(db, 'maps', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } as MapDocument : null;
}

export async function fetchLibraryList(sortBy: 'createdAt' | 'reactionGod' = 'createdAt'): Promise<MapDocument[]> {
  const q = query(collection(db, 'maps'), orderBy(sortBy, 'desc'), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as MapDocument);
}

export async function updateMapReactionsInDB(
  id: string, type: 'reactionOk' | 'reactionGod', change: 1 | -1,
): Promise<void> {
  await updateDoc(doc(db, 'maps', id), { [type]: increment(change) });
}

export async function updateMapDifficultyVoteInDB(
  id: string, oldVote: Difficulty | null, newVote: Difficulty | null,
): Promise<void> {
  const updates: Record<string, ReturnType<typeof increment>> = {};
  if (oldVote) updates[`diffVotes.${oldVote}`] = increment(-1);
  if (newVote) updates[`diffVotes.${newVote}`] = increment(1);
  await updateDoc(doc(db, 'maps', id), updates);
}

export async function updateMapInDB(id: string, data: Partial<Omit<MapDocument, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'maps', id), data as Record<string, unknown>);
}

export async function deleteMapFromDB(id: string): Promise<void> {
  await deleteDoc(doc(db, 'maps', id));
}

// 어드민 목록 — fetchLibraryList() 는 limit(50) 이라 관리 화면엔 부족하다.
export async function fetchAllMapsForAdmin(): Promise<MapDocument[]> {
  const q = query(collection(db, 'maps'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as MapDocument);
}

// 맵 + 하위 제안 전부 삭제. 서브컬렉션은 문서 삭제로 자동 정리되지 않으므로 먼저 지운다.
// 중간 실패 시 일부만 지워질 수 있다 — 호출부에서 목록 새로고침을 안내할 것.
export async function deleteMapWithSuggestions(mapId: string): Promise<void> {
  const snap = await getDocs(collection(db, 'maps', mapId, 'suggestions'));
  for (const s of snap.docs) {
    await deleteDoc(doc(db, 'maps', mapId, 'suggestions', s.id));
  }
  await deleteDoc(doc(db, 'maps', mapId));
}

// ── Suggestions ─────────────────────────────────────────

export async function uploadSuggestionToDB(
  mapId: string, data: Omit<SuggestionDocument, 'id'>,
): Promise<void> {
  await addDoc(collection(db, 'maps', mapId, 'suggestions'), data);
}

export async function fetchSuggestionsFromDB(mapId: string): Promise<SuggestionDocument[]> {
  const q = query(collection(db, 'maps', mapId, 'suggestions'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as SuggestionDocument);
}

export async function deleteSuggestionFromDB(mapId: string, sugId: string): Promise<void> {
  await deleteDoc(doc(db, 'maps', mapId, 'suggestions', sugId));
}

// ── 알림함 (users/{uid}/inbox) ──────────────────────────
// 소유자만 읽고/읽음처리/삭제한다. 생성은 "그 맵의 실제 소유자에게 보내는
// 제안 알림"만 firestore.rules 가 허용한다 (맵 문서를 get() 해 검증).
// 규칙 미배포 상태에서는 create 가 거부되므로 **호출부는 실패를 삼켜야 한다** —
// 알림은 부가 기능이고 풀이 제안 등록 자체를 막으면 안 된다.

export async function createSuggestionNotification(
  ownerUid: string, data: Omit<NotificationDocument, 'id'>,
): Promise<void> {
  await addDoc(collection(db, 'users', ownerUid, 'inbox'), data);
}

export async function fetchInbox(uid: string, max = 30): Promise<NotificationDocument[]> {
  const q = query(
    collection(db, 'users', uid, 'inbox'), orderBy('createdAt', 'desc'), limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as NotificationDocument);
}

export async function markNotificationRead(uid: string, notifId: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'inbox', notifId), { read: true });
}

export async function deleteNotification(uid: string, notifId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'inbox', notifId));
}

// ── 기물 config (어드민 오버레이) ───────────────────────
// 쓰기는 firestore.rules 의 관리자 화이트리스트로 강제된다.

export async function fetchPieceConfig(): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(db, 'config', 'pieces'));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}

// ── 라이브러리 카탈로그 config (어드민 오버레이) ─────────
// 쓰기 권한 강제는 firestore.rules 의 config/{docId} 규칙.

export async function fetchCatalogConfig(): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(db, 'config', 'catalog'));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}

// config/pieces 와 같은 read-modify-write — setDoc(merge) 의 깊은 병합이
// 지운 조건/필드를 되살리기 때문에 엔트리 서브트리를 통째로 교체한다.
export async function saveCatalogEntry(id: string, entry: Record<string, unknown>): Promise<void> {
  const ref = doc(db, 'config', 'catalog');
  const snap = await getDoc(ref);
  const data = (snap.exists() ? snap.data() : { version: 2 }) as Record<string, unknown>;
  // UI 가 만든 객체의 undefined 는 setDoc 이 거부한다 — JSON 왕복으로 제거
  const cleaned = JSON.parse(JSON.stringify(entry)) as Record<string, unknown>;
  const catalogs = { ...(data.catalogs as Record<string, unknown> | undefined), [id]: cleaned };
  await setDoc(ref, { ...data, version: 2, catalogs });
}

export async function deleteCatalogEntry(id: string): Promise<void> {
  const ref = doc(db, 'config', 'catalog');
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as Record<string, unknown>;
  const catalogs = { ...(data.catalogs as Record<string, unknown> | undefined) };
  delete catalogs[id];
  await setDoc(ref, { ...data, version: 2, catalogs });
}

// 복수 엔트리 부분 패치 (순서 일괄 변경 등)
export async function saveCatalogPatch(patch: Record<string, Record<string, unknown>>): Promise<void> {
  const ref = doc(db, 'config', 'catalog');
  const snap = await getDoc(ref);
  const data = (snap.exists() ? snap.data() : { version: 2 }) as Record<string, unknown>;
  const current = { ...(data.catalogs as Record<string, Record<string, unknown>> | undefined) };
  for (const [id, entryPatch] of Object.entries(patch)) {
    current[id] = JSON.parse(JSON.stringify({ ...current[id], ...entryPatch })) as Record<string, unknown>;
  }
  await setDoc(ref, { ...data, version: 2, catalogs: current });
}

export async function savePieceConfigEntry(
  pieceType: string, entry: Record<string, unknown>,
): Promise<void> {
  // setDoc(merge:true) 는 중첩 맵을 깊은 병합해 지운 face(satisfy 포함)가
  // 부활하고, updateDoc 필드 경로 방식은 실패 사례가 있어 read-modify-write 로
  // 엔트리 서브트리를 통째 교체한다. 어드민 전용 문서라 쓰기 경합은 사실상 없다.
  const ref = doc(db, 'config', 'pieces');
  const snap = await getDoc(ref);
  const data = (snap.exists() ? snap.data() : { version: 1 }) as Record<string, unknown>;
  // UI 가 만든 객체에 남은 undefined 값은 setDoc 이 거부한다 — JSON 왕복으로 제거
  const cleaned = JSON.parse(JSON.stringify(entry)) as Record<string, unknown>;
  const pieces = { ...(data.pieces as Record<string, unknown> | undefined), [pieceType]: cleaned };
  await setDoc(ref, { ...data, pieces });
}

export async function deletePieceConfigEntry(pieceType: string): Promise<void> {
  const ref = doc(db, 'config', 'pieces');
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as Record<string, unknown>;
  const pieces = { ...(data.pieces as Record<string, unknown> | undefined) };
  delete pieces[pieceType];
  await setDoc(ref, { ...data, pieces });
}

// 임의 부분 패치 (folders 교체, 복수 기물 folderId 일괄 머지 등)
export async function savePieceConfigPatch(patch: Record<string, unknown>): Promise<void> {
  await setDoc(doc(db, 'config', 'pieces'), { version: 2, ...patch }, { merge: true });
}
