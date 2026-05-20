// uiController.js — 단순 UI 제어: 모달, 알림, 업로드, 이스터에그, URL 로더
import * as FB from './firebaseApp.js';
import { GRID_SIZE, mapData, showNotification } from './dragAndDrop.js';
import { currentLoadedMapId, currentLoadedMapAuthorUid, currentLoadedMapObj,
    playMapFromLibrary, closeSuggestionModal } from './libraryController.js';

// --- 맵 수정 모드 플래그 ---
export let isEditingMap = false;

// --- 업로드 모달 ---
export function openUploadModal() {
    document.getElementById('uploadModal').style.display = 'flex';
}

export function closeUploadModal() {
    document.getElementById('uploadModal').style.display = 'none';
    isEditingMap = false;
    document.getElementById('uploadModal').querySelector('h3').innerText = "맵 공유하기";
    document.getElementById('uploadSubmitBtn').innerText = "서버에 업로드";
}

export function openUploadForEdit(mapObj) {
    isEditingMap = true;
    document.getElementById('mapTitle').value = mapObj.title || "";
    document.getElementById('mapAuthor').value = mapObj.author || "";
    document.getElementById('mapDifficulty').value = mapObj.difficulty || "Normal";

    document.getElementById('uploadModal').querySelector('h3').innerText = "✏️ 맵 수정하기";
    document.getElementById('uploadSubmitBtn').innerText = "수정 반영하기";
    document.getElementById('uploadModal').style.display = 'flex';
}

// --- 맵 업로드/수정 ---
export async function packAndUploadMap() {
    const title = document.getElementById('mapTitle').value.trim();
    const author = document.getElementById('mapAuthor').value.trim();
    const difficulty = document.getElementById('mapDifficulty').value;

    if (!title || !author) { alert("맵 제목과 제작자 닉네임을 모두 입력해주세요."); return; }

    const mapItems = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (mapData[r][c]) {
                mapItems.push({
                    x: c, y: r, type: mapData[r][c].type,
                    rotation: mapData[r][c].canRotate ? 0 : mapData[r][c].rotation,
                    canMove: mapData[r][c].canMove, canRotate: mapData[r][c].canRotate,
                    isInventory: mapData[r][c].isInventory || false
                });
            }
        }
    }

    const uploadBtn = document.getElementById('uploadSubmitBtn');
    const originalText = uploadBtn.innerText;
    uploadBtn.innerText = "서버 처리 중...";
    uploadBtn.disabled = true;

    try {
        if (isEditingMap && currentLoadedMapId) {
            const updateData = {
                title: title,
                author: author,
                difficulty: difficulty,
                mapData: mapItems
            };
            await FB.updateMapInDB(currentLoadedMapId, updateData);
            showNotification("맵이 성공적으로 수정되었습니다!", "#27ae60");

            currentLoadedMapObj.title = title;
            currentLoadedMapObj.author = author;
            currentLoadedMapObj.difficulty = difficulty;
            currentLoadedMapObj.mapData = mapItems;
            playMapFromLibrary(currentLoadedMapObj);
        } else {
            const packedData = {
                title: title,
                author: author,
                difficulty: difficulty,
                createdAt: new Date().toISOString(),
                reactionOk: 0,
                reactionGod: 0,
                diffVotes: { Easy: 0, Normal: 0, Hard: 0, Insane: 0 },
                authorUid: FB.currentUserUid,
                mapData: mapItems
            };

            const docId = await FB.uploadToDB(packedData);
            const baseUrl = window.location.href.split('?')[0];
            const shareUrl = `${baseUrl}?mapId=${docId}`;

            document.getElementById('output').value = "🚀 맵 공유 링크가 생성되었습니다!\n아래 주소를 복사해서 친구들에게 공유하세요.\n\n" + shareUrl;
            showNotification("서버 업로드 완료! 텍스트 상자의 링크를 확인하세요.", "#8e44ad");
        }
    } catch (error) {
        alert("처리 중 오류가 발생했습니다: " + error.message);
    } finally {
        closeUploadModal();
        uploadBtn.innerText = originalText;
        uploadBtn.disabled = false;
        if (!isEditingMap) {
            document.getElementById('mapTitle').value = "";
            document.getElementById('mapAuthor').value = "";
        }
    }
}

// --- 상급 기물 이스터에그 (비밀번호 해금) ---
const SECRET_PASSWORD = "wheresmy8hours";

export function initPasswordEasterEgg() {
    let isUnlocked = false;
    document.getElementById('output').addEventListener('input', function () {
        if (!isUnlocked && this.value.includes(SECRET_PASSWORD)) {
            document.body.classList.add('unlocked');
            this.value = this.value.replace(SECRET_PASSWORD, '');
            this.placeholder = "JSON을 입력하세요.";
            isUnlocked = true;
            showNotification("팀장님 몰래 상급 기물 탭이 활성화되었습니다!", "#c0392b");
        }
    });
}

// --- 팔레트 기물 SVG 초기화 (DOMContentLoaded) ---
export function initPaletteSVGs() {
    // SVG_ART는 dragAndDrop에서 import. 여기서는 DOM 팔레트 아이템에 SVG 채워넣기
    // SVG_ART import 필요 → 이 함수는 main.js에서 SVG_ART를 import하여 호출
}