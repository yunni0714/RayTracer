// firebaseApp.js — Firebase 초기화 및 모든 DB 통신 함수
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, collection, addDoc, doc, getDoc, getDocs, setDoc,
    query, orderBy, limit, updateDoc, increment, deleteDoc }
    from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
    getRedirectResult, signOut, onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBdf2slxxy1fXM-lQ-iL87-2p-uea3nFi8",
    authDomain: "raytracer-d3bcb.firebaseapp.com",
    projectId: "raytracer-d3bcb",
    storageBucket: "raytracer-d3bcb.firebasestorage.app",
    messagingSenderId: "43284198744",
    appId: "1:43284198744:web:df7be53aed930973ac212d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// --- 전역 공유: 현재 유저 정보 ---
export let currentUserUid = null;
export let currentUserNickname = null;

// 외부에서 nickname 갱신이 필요할 때 사용하는 setter
export function setCurrentUserNickname(nickname) {
    currentUserNickname = nickname;
}

// --- 인증 상태 콜백 ---
let onAuthReadyCallback = null;
export function onAuthReady(cb) {
    onAuthReadyCallback = cb;
}

// --- 구글 로그인 ---
export async function signInWithGoogle() {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (err) {
        if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
            await signInWithRedirect(auth, googleProvider);
        } else {
            console.error("구글 로그인 오류:", err);
            throw err;
        }
    }
}

// --- 로그아웃 ---
export async function signOutUser() {
    await signOut(auth);
}

// --- 유저 프로필 (Firestore users/{uid}) ---
export async function getUserProfile(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
}

export async function createUserProfile(uid, nickname) {
    await setDoc(doc(db, "users", uid), {
        nickname,
        createdAt: new Date().toISOString()
    });
}

export async function updateUserNickname(uid, nickname) {
    await updateDoc(doc(db, "users", uid), { nickname });
}

// --- 헤더 로그인 UI 갱신 ---
function updateHeaderAuthUI(loggedIn, nickname) {
    const loginBtn = document.getElementById('loginBtn');
    const userMenu = document.getElementById('userMenu');
    const userNicknameEl = document.getElementById('userNickname');
    if (loginBtn) loginBtn.style.display = loggedIn ? 'none' : 'inline-block';
    if (userMenu) userMenu.style.display = loggedIn ? 'flex' : 'none';
    if (userNicknameEl) userNicknameEl.innerText = nickname ? `👤 ${nickname}` : '👤';
}

// --- Firebase 초기화 ---
export function initFirebase() {
    // 리디렉션 로그인 후 결과 처리 (팝업 차단 시 사용됨)
    getRedirectResult(auth).catch(() => {});

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserUid = user.uid;
            try {
                const profile = await getUserProfile(user.uid);
                if (profile && profile.nickname) {
                    currentUserNickname = profile.nickname;
                    updateHeaderAuthUI(true, currentUserNickname);
                } else {
                    // 최초 로그인: 닉네임 설정 모달 표시
                    updateHeaderAuthUI(true, null);
                    const modal = document.getElementById('nicknameModal');
                    if (modal) modal.style.display = 'flex';
                }
            } catch (e) {
                updateHeaderAuthUI(true, null);
            }
        } else {
            currentUserUid = null;
            currentUserNickname = null;
            updateHeaderAuthUI(false, null);
            // 닉네임 모달 닫기 (로그아웃 시)
            const modal = document.getElementById('nicknameModal');
            if (modal) modal.style.display = 'none';
        }
        // auth 상태 변화 시 외부 콜백 알림 (맵 소유권 UI 갱신 등)
        if (typeof window._onAuthChange === 'function') window._onAuthChange(!!user);
        if (onAuthReadyCallback) {
            onAuthReadyCallback();
            onAuthReadyCallback = null; // 최초 1회만 실행
        }
    });
}

// --- DB CRUD 함수들 ---

export async function uploadToDB(data) {
    const docRef = await addDoc(collection(db, "maps"), data);
    return docRef.id;
}

export async function fetchFromDB(id) {
    const docRef = doc(db, "maps", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
    return null;
}

export async function fetchLibraryList(sortBy = "createdAt") {
    const q = query(collection(db, "maps"), orderBy(sortBy, "desc"), limit(50));
    const querySnapshot = await getDocs(q);
    let maps = [];
    querySnapshot.forEach((doc) => { maps.push({ id: doc.id, ...doc.data() }); });
    return maps;
}

export async function updateMapReactionsInDB(id, type, change) {
    const docRef = doc(db, "maps", id);
    await updateDoc(docRef, { [type]: increment(change) });
}

export async function updateMapDifficultyVoteInDB(id, oldVote, newVote) {
    const docRef = doc(db, "maps", id);
    const updates = {};
    if (oldVote) updates[`diffVotes.${oldVote}`] = increment(-1);
    if (newVote) updates[`diffVotes.${newVote}`] = increment(1);
    await updateDoc(docRef, updates);
}

export async function updateMapInDB(id, data) {
    const docRef = doc(db, "maps", id);
    await updateDoc(docRef, data);
}

export async function deleteMapFromDB(id) {
    const docRef = doc(db, "maps", id);
    await deleteDoc(docRef);
}

export async function uploadSuggestionToDB(mapId, data) {
    const sugRef = collection(db, "maps", mapId, "suggestions");
    await addDoc(sugRef, data);
}

export async function fetchSuggestionsFromDB(mapId) {
    const sugRef = collection(db, "maps", mapId, "suggestions");
    const q = query(sugRef, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    let sugs = [];
    snap.forEach(d => sugs.push({ id: d.id, ...d.data() }));
    return sugs;
}

export async function deleteSuggestionFromDB(mapId, sugId) {
    await deleteDoc(doc(db, "maps", mapId, "suggestions", sugId));
}
