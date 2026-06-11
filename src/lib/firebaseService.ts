import {
  collection, addDoc, doc, getDoc, getDocs,
  setDoc, query, orderBy, limit, updateDoc, increment, deleteDoc, deleteField,
} from 'firebase/firestore';
import {
  GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut,
} from 'firebase/auth';
import { db, auth } from './firebase';
import type { MapDocument, SuggestionDocument, Difficulty } from '../types/game';

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

// ── 기물 config (어드민 오버레이) ───────────────────────
// 쓰기는 firestore.rules 의 관리자 화이트리스트로 강제된다.

export async function fetchPieceConfig(): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(db, 'config', 'pieces'));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}

export async function savePieceConfigEntry(
  pieceType: string, entry: Record<string, unknown>,
): Promise<void> {
  await setDoc(
    doc(db, 'config', 'pieces'),
    { version: 1, pieces: { [pieceType]: entry } },
    { merge: true },
  );
}

export async function deletePieceConfigEntry(pieceType: string): Promise<void> {
  await updateDoc(doc(db, 'config', 'pieces'), { [`pieces.${pieceType}`]: deleteField() });
}

// 임의 부분 패치 (folders 교체, 복수 기물 folderId 일괄 머지 등)
export async function savePieceConfigPatch(patch: Record<string, unknown>): Promise<void> {
  await setDoc(doc(db, 'config', 'pieces'), { version: 2, ...patch }, { merge: true });
}
