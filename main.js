// main.js — 진입점: 모든 모듈 import, 초기화, 이벤트 리스너 연결
import { initFirebase, onAuthReady } from './firebaseApp.js';
import { resizeCanvas } from './laserEngine.js';
import { SVG_ART, initGridInteractions, toggleMode, clearGrid, importData, exportData } from './dragAndDrop.js';
import { toggleLaser } from './laserEngine.js';
import { toggleLibraryScreen, loadLibraryMaps, applyFilters, toggleReaction,
         voteDifficulty, handleSugHeaderBtnAction, deleteCurrentMap,
         createNewMap, openSuggestionModal, closeSuggestionModal, submitSuggestion,
         updateSugHeaderBtnUI, initUrlParamLoader } from './libraryController.js';
import { openUploadModal, openUploadForEdit, closeUploadModal, packAndUploadMap,
         initPasswordEasterEgg } from './uiController.js';

// ═══════════════ 초기화 시퀀스 ═══════════════

// 1. Canvas 리사이즈
resizeCanvas();

// 2. 그리드 셀, 팔레트, 인벤토리, 드래그 이벤트 등록
initGridInteractions();

// 3. 팔레트 SVG 채우기
document.querySelectorAll('.tool-item[data-tool]').forEach(item => {
    const type = item.dataset.tool;
    if (SVG_ART[type]) { item.innerHTML = SVG_ART[type]; }
});

// 4. 상급 기물 이스터에그
initPasswordEasterEgg();

// 5. Firebase 초기화
initFirebase();

// 6. Auth 완료 후 URL 파라미터 로드 + 제안 헤더 UI
onAuthReady(() => {
    updateSugHeaderBtnUI();
    initUrlParamLoader();
});

// ═══════════════ 이벤트 리스너 (기존 onclick 대체) ═══════════════

// --- 헤더 ---
document.getElementById('newMapBtn').addEventListener('click', createNewMap);
document.getElementById('libraryToggleBtn').addEventListener('click', toggleLibraryScreen);
document.getElementById('modeToggleBtn').addEventListener('click', toggleMode);

// --- 라이브러리 검색/정렬 ---
document.getElementById('searchInput').addEventListener('input', applyFilters);
document.getElementById('sortSelect').addEventListener('change', loadLibraryMaps);

// --- 평가 버튼 ---
document.getElementById('btnReactOk').addEventListener('click', () => toggleReaction('ok'));
document.getElementById('btnReactGod').addEventListener('click', () => toggleReaction('god'));

// --- 난이도 투표 ---
document.getElementById('btnVoteEasy').addEventListener('click', () => voteDifficulty('Easy'));
document.getElementById('btnVoteNormal').addEventListener('click', () => voteDifficulty('Normal'));
document.getElementById('btnVoteHard').addEventListener('click', () => voteDifficulty('Hard'));
document.getElementById('btnVoteInsane').addEventListener('click', () => voteDifficulty('Insane'));

// --- 제안 헤더 ---
document.getElementById('sugHeaderBtn').addEventListener('click', handleSugHeaderBtnAction);
document.getElementById('deleteMapBtn').addEventListener('click', deleteCurrentMap);

// --- 레이저 토글 ---
document.getElementById('laserToggleBtn').addEventListener('click', toggleLaser);

// --- 액션 버튼 (에디터 하단) ---
const actionBtns = document.querySelector('.actions').querySelectorAll('button');
actionBtns[0].addEventListener('click', clearGrid);       // 전체 지우기
actionBtns[1].addEventListener('click', importData);       // JSON 불러오기
actionBtns[2].addEventListener('click', exportData);       // JSON 추출
actionBtns[3].addEventListener('click', openUploadModal);  // 서버에 맵 등록하기

// --- 업로드 모달 ---
const uploadModal = document.getElementById('uploadModal');
uploadModal.querySelectorAll('button')[0].addEventListener('click', closeUploadModal);  // 취소
document.getElementById('uploadSubmitBtn').addEventListener('click', packAndUploadMap);

// --- 제안 모달 ---
const suggestionModal = document.getElementById('suggestionModal');
suggestionModal.querySelectorAll('button')[0].addEventListener('click', closeSuggestionModal);  // 취소
document.getElementById('sugSubmitBtn').addEventListener('click', submitSuggestion);

// --- window 브릿지 (순환 참조 해결) ---
// libraryController → uiController (openUploadForEdit)
window._openUploadForEdit = openUploadForEdit;

// dragAndDrop → libraryController (clearGrid에서 currentLoadedMapId 리셋)
import { resetCurrentMap } from './libraryController.js';
window._setCurrentMapNull = resetCurrentMap;