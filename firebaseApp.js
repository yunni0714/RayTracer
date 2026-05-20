// firebaseApp.js — Firebase 초기화 및 모든 DB 통신 함수
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, collection, addDoc, doc, getDoc, getDocs, query, orderBy, limit, updateDoc, increment, deleteDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";

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

// --- 임시 UID 폴백 (익명 로그인 실패 시) ---
function getFallbackUid() {
    let uid = localStorage.getItem('ray_fallback_uid');
    if (!uid) {
        uid = 'anon_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('ray_fallback_uid', uid);
    }
    return uid;
}

// --- 전역 공유: 현재 유저 UID ---
export let currentUserUid = null;

// --- onAuthStateChanged 콜백을 외부에서 주입받기 위한 저장소 ---
let onAuthReadyCallback = null;

export function onAuthReady(cb) {
    onAuthReadyCallback = cb;
}

// --- Firebase 인증 초기화 ---
export function initFirebase() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUserUid = user.uid;
            if (onAuthReadyCallback) onAuthReadyCallback();
        } else {
            signInAnonymously(auth).catch((error) => {
                currentUserUid = getFallbackUid();
                if (error.code === 'auth/configuration-not-found' || error.code === 'auth/operation-not-allowed') {
                    setTimeout(() => {
                        alert("🚨 [안내] 파이어베이스 익명 로그인이 꺼져있어 임시 ID로 동작합니다.");
                    }, 1000);
                }
                if (onAuthReadyCallback) onAuthReadyCallback();
            });
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
