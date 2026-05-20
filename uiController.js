// libraryController.js — 도서관 & 커뮤니티: 라이브러리 화면, 평가/투표, 제안 게시판
import * as FB from './firebaseApp.js';
import { SVG_ART, GRID_SIZE, CELL_SIZE, mapData, playerInventory, isEditorMode,
    editorMapDataBackup, selectedTool, lastActiveTool, undoStack,
    showNotification, cancelDragOperation, deselectAllTools, restoreTool,
    refundToInventory, updateCellVisual, applyMapData, saveStateDirectly,
    renderInventoryUI, toggleMode } from './dragAndDrop.js';
import { refreshLaser } from './laserEngine.js';

// ═══════════════ 전역 상태 ═══════════════
export let allLibraryMaps = [];
export let isLibraryMode = false;
export let currentLoadedMapId = null;
export let currentLoadedMapAuthorUid = null;
export let currentLoadedMapObj = null;
export let currentMapReactions = { ok: 0, god: 0 };

// clearGrid에서 호출할 리셋 함수 (window._setCurrentMapNull 우회용)
export function resetCurrentMap() {
    currentLoadedMapId = null;
    currentLoadedMapAuthorUid = null;
    currentLoadedMapObj = null;
}

// ═══════════════ 로컬 평가 상태 ═══════════════
function getMapLocalState(mapId) {
    const state = JSON.parse(localStorage.getItem('ray_map_states') || '{}');
    return state[mapId] || { ok: false, god: false, diff: null };
}
function saveMapLocalState(mapId, stateData) {
    const state = JSON.parse(localStorage.getItem('ray_map_states') || '{}');
    state[mapId] = stateData;
    localStorage.setItem('ray_map_states', JSON.stringify(state));
}

// ═══════════════ 유저 체감 난이도 계산 ═══════════════
export function calculateUserDifficulty(diffVotes) {
    if (!diffVotes) return null;
    let total = diffVotes.Easy + diffVotes.Normal + diffVotes.Hard + diffVotes.Insane;
    if (total === 0) return null;
    return Object.keys(diffVotes).reduce((a, b) => diffVotes[a] > diffVotes[b] ? a : b);
}

// ═══════════════ 미니 그리드 DOM 생성 ═══════════════
export function createMiniGridDOM(mapDataArray, hideInventory = false) {
    const miniGrid = document.createElement('div');
    miniGrid.className = 'mini-grid';
    miniGrid.style.cssText = 'width: 100%; aspect-ratio: 1 / 1; display: grid; grid-template-columns: repeat(5, 1fr); grid-template-rows: repeat(5, 1fr); border-bottom: 1px solid #f0f0f0; background-color: #fafafa; box-sizing: border-box;';

    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'mini-cell';
        cell.style.cssText = 'border: 1px solid #eee; box-sizing: border-box;';
        miniGrid.appendChild(cell);
    }
    if (mapDataArray && Array.isArray(mapDataArray)) {
        mapDataArray.forEach(item => {
            if (hideInventory && item.isInventory) return;
            if (item.x >= 0 && item.x < 5 && item.y >= 0 && item.y < 5) {
                const index = item.y * 5 + item.x;
                const cell = miniGrid.children[index];
                if (SVG_ART[item.type]) {
                    cell.innerHTML = `<div style="transform: rotate(${item.rotation || 0}deg); width:100%; height:100%; display:flex; justify-content:center; align-items:center;">${SVG_ART[item.type]}</div>`;
                }
            }
        });
    }
    return miniGrid;
}

// ═══════════════ 라이브러리 화면 ═══════════════
export function toggleLibraryScreen() {
    isLibraryMode = !isLibraryMode;
    const btn = document.getElementById('libraryToggleBtn');
    const editorScreen = document.getElementById('editorScreen');
    const libScreen = document.getElementById('libraryScreen');
    const modeBtn = document.getElementById('modeToggleBtn');
    const newMapBtn = document.getElementById('newMapBtn');

    if (isLibraryMode) {
        btn.innerHTML = "🔙 돌아가기";
        btn.classList.add('active');
        editorScreen.classList.remove('active');
        libScreen.classList.add('active');
        modeBtn.style.display = 'none';
        newMapBtn.style.display = 'inline-block';
        loadLibraryMaps();
    } else {
        btn.innerHTML = "📚 맵 라이브러리 열기";
        btn.classList.remove('active');
        libScreen.classList.remove('active');
        editorScreen.classList.add('active');
        modeBtn.style.display = 'inline-block';
        newMapBtn.style.display = 'none';
    }
}

export async function loadLibraryMaps() {
    const sortSelect = document.getElementById('sortSelect');
    const sortBy = sortSelect ? sortSelect.value : 'recent';
    const grid = document.getElementById('libraryGrid');
    grid.innerHTML = '<p style="text-align: center; width: 100%; color: #7f8c8d; font-weight: bold; padding: 40px 0;">맵 데이터를 불러오는 중입니다...</p>';
    try {
        allLibraryMaps = await FB.fetchLibraryList(sortBy);
        renderLibraryCards(allLibraryMaps);
    } catch (e) {
        grid.innerHTML = `<p style="color:red; text-align:center; padding: 40px 0;">오류가 발생했습니다: ${e.message}</p>`;
    }
}

export function applyFilters() {
    const searchInput = document.getElementById('searchInput');
    const q = searchInput ? searchInput.value.toLowerCase() : '';
    const filtered = allLibraryMaps.filter(map =>
        (map.title && map.title.toLowerCase().includes(q)) ||
        (map.author && map.author.toLowerCase().includes(q))
    );
    renderLibraryCards(filtered, q !== '');
}

// 카드 DOM을 생성하는 헬퍼 함수 (고정 너비 속성을 제거하여 유연하게 대처)
function createCardElement(mapObj) {
    const card = document.createElement('div');
    card.className = 'map-card';

    // 기본 카드 디자인 (너비 관련 속성은 렌더링 함수에서 부여)
    card.style.cssText = 'background-color: #ffffff; border-radius: 14px; box-shadow: 0 4px 14px rgba(0,0,0,0.06); overflow: hidden; cursor: pointer; transition: all 0.25s ease; display: flex; flex-direction: column;';
    card.onclick = () => playMapFromLibrary(mapObj);

    // 호버 효과
    card.onmouseover = () => {
        card.style.transform = 'translateY(-6px)';
        card.style.boxShadow = '0 12px 28px rgba(0,0,0,0.12)';
    };
    card.onmouseout = () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '0 4px 14px rgba(0,0,0,0.06)';
    };

    const miniGrid = createMiniGridDOM(mapObj.mapData, true);

    const okCount = mapObj.reactionOk || 0;
    const godCount = mapObj.reactionGod || 0;
    const creatorDiff = mapObj.difficulty || 'Normal';
    const userDiff = calculateUserDifficulty(mapObj.diffVotes);
    const dateStr = mapObj.createdAt ? new Date(mapObj.createdAt).toLocaleDateString() : '';

    card.innerHTML = `
        <div class="card-meta" style="padding: 16px 16px 12px 16px;">
            <h4 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 800; color: #1e293b; letter-spacing: -0.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${mapObj.title}">${mapObj.title || '제목 없음'}</h4>
            <p style="margin: 0; font-size: 12px; font-weight: 500; color: #64748b;">${mapObj.author || '알 수 없음'} <span style="color: #cbd5e1; margin: 0 4px;">|</span> ${dateStr}</p>
        </div>
        <div class="card-actions" style="padding: 0 16px 16px 16px; display: flex; flex-direction: column; gap: 10px; margin-top: auto;">
            <div style="display: flex; gap: 6px;">
                <span class="difficulty-badge diff-${creatorDiff}" style="padding: 4px 8px; font-size: 11px; font-weight: 700; border-radius: 6px; color: white;">공식: ${creatorDiff}</span>
                ${userDiff ? `<span class="difficulty-badge diff-${userDiff}" style="padding: 4px 8px; font-size: 11px; font-weight: 700; border-radius: 6px; color: white; border: 1px dashed rgba(255,255,255,0.7);">유저: ${userDiff}</span>` : ''}
            </div>
            <div class="static-stats" style="width: 100%; display: flex; justify-content: flex-end; gap: 12px; font-size: 13px; font-weight: 700;">
                <span style="color:#10b981; display:flex; align-items:center; gap:3px;">✅ ${okCount}</span>
                <span style="color:#f43f5e; display:flex; align-items:center; gap:3px;">👍 ${godCount}</span>
            </div>
        </div>
    `;
    card.insertBefore(miniGrid, card.firstChild);
    return card;
}

// 라이브러리 화면 렌더링 (안정적인 Grid & Flex 하이브리드 적용)
export function renderLibraryCards(mapsList, isSearch = false) {
    const grid = document.getElementById('libraryGrid');
    grid.innerHTML = '';
    grid.style.display = 'block'; // 내부에서 직접 레이아웃을 짤 것이므로 껍데기는 block으로 해제

    if (mapsList.length === 0) {
        grid.innerHTML = '<p style="text-align: center; width: 100%; color: #64748b; font-weight: 500; padding: 60px 0;">검색 결과나 등록된 맵이 없습니다.</p>';
        return;
    }

    // 1. 상단: 모든 맵을 보여주는 반응형 그리드 (사진 1 구현)
    const mainContainer = document.createElement('div');
    // 안전한 cssText를 사용하고, CSS Grid를 활용하여 화면 크기에 맞게 카드가 꽉 차도록 예쁘게 정렬합니다.
    mainContainer.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; margin-bottom: 50px;';

    mapsList.forEach(mapObj => {
        const card = createCardElement(mapObj);
        card.style.width = '100%'; // 상단 그리드에서는 부모 셀에 100% 꽉 차게!
        mainContainer.appendChild(card);
    });
    grid.appendChild(mainContainer);

    // 2. 하단: 검색 중이 아닐 때만 넷플릭스 스타일 가로 스크롤 섹션 (사진 2 구현)
    if (!isSearch) {
        // 구분선
        const divider = document.createElement('hr');
        divider.style.cssText = 'border: 0; height: 1px; background-color: #e2e8f0; margin: 0 0 40px 0;';
        grid.appendChild(divider);

        // 행(Row) 생성 헬퍼 함수
        const createRow = (title, maps) => {
            const section = document.createElement('div');
            section.className = 'library-section';
            section.style.marginBottom = '45px';

            const heading = document.createElement('h2');
            heading.innerText = title;
            heading.style.cssText = 'font-size: 24px; margin-bottom: 16px; font-weight: 800; color: #0f172a; text-transform: capitalize; padding-left: 4px; letter-spacing: -0.5px;';
            section.appendChild(heading);

            const scrollContainer = document.createElement('div');
            scrollContainer.className = 'horizontal-scroll-container';
            // 가로 스크롤 전용 속성 (안전한 cssText 사용)
            scrollContainer.style.cssText = 'display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px; padding-right: 50px; scroll-snap-type: x mandatory; scroll-behavior: smooth;';
            // 스크롤바 숨김 (인라인)
            scrollContainer.style.scrollbarWidth = 'none';
            scrollContainer.style.msOverflowStyle = 'none';

            maps.forEach(mapObj => {
                const card = createCardElement(mapObj);
                // 하단 스크롤 영역에서는 카드의 너비를 220px로 단단하게 고정!
                card.style.width = '220px';
                card.style.flex = '0 0 auto';
                card.style.scrollSnapAlign = 'start';
                scrollContainer.appendChild(card);
            });

            section.appendChild(scrollContainer);
            grid.appendChild(section);
        };

        const featuredMaps = [...mapsList].sort((a, b) => (b.reactionGod || 0) - (a.reactionGod || 0)).slice(0, 10);
        const originalMaps = [...mapsList].sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA; // 최신순 안전 정렬
        });

        if (featuredMaps.length > 0) createRow("featured", featuredMaps);
        if (originalMaps.length > 0) createRow("original", originalMaps);
    }
}

// ═══════════════ 반응형 제안 패널 (드로어) 제어 ═══════════════
export function closeSuggestionDrawer() {
    const sugContainer = document.getElementById('suggestionBoardContainer');
    if (sugContainer) {
        sugContainer.classList.remove('drawer-open');
    }
}

// ═══════════════ 맵 플레이 ═══════════════
export function playMapFromLibrary(mapObj) {
    if (isLibraryMode) toggleLibraryScreen();
    if (!isEditorMode) toggleMode();

    if (mapObj.mapData) applyMapData(mapObj.mapData);

    currentLoadedMapId = mapObj.id;
    currentLoadedMapAuthorUid = mapObj.authorUid;
    currentLoadedMapObj = mapObj;
    currentMapReactions.ok = mapObj.reactionOk || 0;
    currentMapReactions.god = mapObj.reactionGod || 0;

    document.getElementById('loadedMapInfo').style.display = 'flex';
    document.getElementById('infoTitle').innerText = `🗺️ ${mapObj.title}`;
    document.getElementById('infoAuthor').innerText = mapObj.author;

    const diffSpan = document.getElementById('infoDifficulty');
    const diff = mapObj.difficulty || 'Normal';
    diffSpan.innerText = diff;
    diffSpan.className = `difficulty-badge diff-${diff}`;

    const userDiffSpan = document.getElementById('infoUserDifficulty');
    const userDiff = calculateUserDifficulty(mapObj.diffVotes);
    if (userDiff) {
        userDiffSpan.innerText = userDiff;
        userDiffSpan.className = `difficulty-badge diff-${userDiff}`;
    } else {
        userDiffSpan.innerText = "평가 부족";
        userDiffSpan.className = `difficulty-badge diff-None`;
    }

    updateReactionUI(mapObj.id);

    // 드로어 열기
    const sugContainer = document.getElementById('suggestionBoardContainer');
    if(sugContainer) {
        sugContainer.style.display = '';
        sugContainer.classList.add('drawer-open');
    }

    updateSugHeaderBtnUI();
    loadSuggestionsForCurrentMap();

    showNotification(`[${mapObj.title}] 플레이를 시작합니다!`, "#27ae60");

    if (isEditorMode) toggleMode();
}

// ═══════════════ 평가 & 투표 ═══════════════
export async function toggleReaction(type) {
    if (!currentLoadedMapId) return;
    const btn = type === 'ok' ? document.getElementById('btnReactOk') : document.getElementById('btnReactGod');
    if (btn.disabled) return;
    btn.disabled = true;

    const state = getMapLocalState(currentLoadedMapId);
    const isAdding = !state[type];
    const dbType = type === 'ok' ? 'reactionOk' : 'reactionGod';

    try {
        await FB.updateMapReactionsInDB(currentLoadedMapId, dbType, isAdding ? 1 : -1);
        state[type] = isAdding;
        saveMapLocalState(currentLoadedMapId, state);

        if (isAdding) currentMapReactions[type]++;
        else currentMapReactions[type]--;

        updateReactionUI(currentLoadedMapId);
        showNotification(isAdding ? "평가를 반영했습니다." : "평가를 취소했습니다.");
    } catch (e) {
        alert("서버 통신 실패: " + e.message);
    } finally {
        btn.disabled = false;
    }
}

export async function voteDifficulty(diffLevel) {
    if (!currentLoadedMapId) return;
    const state = getMapLocalState(currentLoadedMapId);
    if (state.diff === diffLevel) return;

    const oldVote = state.diff;
    document.querySelectorAll('.diff-vote-btn').forEach(b => b.disabled = true);

    try {
        await FB.updateMapDifficultyVoteInDB(currentLoadedMapId, oldVote, diffLevel);
        state.diff = diffLevel;
        saveMapLocalState(currentLoadedMapId, state);
        updateReactionUI(currentLoadedMapId);
        showNotification("체감 난이도 투표가 완료되었습니다!");
    } catch (e) {
        alert("투표 실패: " + e.message);
    } finally {
        document.querySelectorAll('.diff-vote-btn').forEach(b => b.disabled = false);
    }
}

export function updateReactionUI(mapId) {
    const state = getMapLocalState(mapId);
    const btnOk = document.getElementById('btnReactOk');
    const btnGod = document.getElementById('btnReactGod');
    document.getElementById('countOk').innerText = currentMapReactions.ok;
    document.getElementById('countGod').innerText = currentMapReactions.god;

    btnOk.classList.toggle('active', state.ok);
    btnOk.classList.toggle('ok', state.ok);
    btnGod.classList.toggle('active', state.god);
    btnGod.classList.toggle('god', state.god);

    document.querySelectorAll('.diff-vote-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (state.diff) {
        const activeBtn = document.querySelector(`.diff-vote-btn.diff-${state.diff}`);
        if (activeBtn) activeBtn.classList.add('active');
    }
}

// ═══════════════ 제안 헤더 UI ═══════════════
export function updateSugHeaderBtnUI() {
    const btn = document.getElementById('sugHeaderBtn');
    const delBtn = document.getElementById('deleteMapBtn');
    const headerTitle = document.getElementById('suggestionHeaderTitle');
    if (!btn || !headerTitle) return;

    if (currentLoadedMapAuthorUid && FB.currentUserUid === currentLoadedMapAuthorUid) {
        btn.innerHTML = "✏️ 맵 수정하기";
        btn.style.cssText = "background-color: #10b981; border: none; color: #fff;";
        if (delBtn) delBtn.style.display = 'inline-block';
        headerTitle.innerHTML = `💡 제안 관리 및 맵 수정 (<span id="sugCount">0</span>건)`;
    } else {
        btn.innerHTML = "내 풀이 제안하기";
        btn.style.cssText = "background-color: #f59e0b; border: none; color: #fff;";
        if (delBtn) delBtn.style.display = 'none';
        headerTitle.innerHTML = `💡 다른 풀이 제안 (<span id="sugCount">0</span>건)`;
    }
}

export function handleSugHeaderBtnAction() {
    if (!FB.currentUserUid) {
        alert("로그인 정보를 확인 중입니다. 잠시 후 시도해주세요.");
        return;
    }

    if (currentLoadedMapAuthorUid && FB.currentUserUid === currentLoadedMapAuthorUid) {
        if (typeof window._openUploadForEdit === 'function') {
            window._openUploadForEdit(currentLoadedMapObj);
        }
    } else {
        openSuggestionModal();
    }
}

// ═══════════════ 제안 모달 ═══════════════
export function openSuggestionModal() {
    document.getElementById('suggestionModal').style.display = 'flex';
}
export function closeSuggestionModal() {
    document.getElementById('suggestionModal').style.display = 'none';
}

export async function submitSuggestion() {
    const category = document.getElementById('sugCategory').value;
    const comment = document.getElementById('sugComment').value.trim();
    if (!comment) { alert("코멘트(설명)를 입력해주세요."); return; }

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

    const sugData = {
        category: category, comment: comment, suggesterUid: FB.currentUserUid,
        createdAt: new Date().toISOString(), mapData: mapItems
    };

    const btn = document.getElementById('sugSubmitBtn');
    btn.innerText = "등록 중..."; btn.disabled = true;

    try {
        await FB.uploadSuggestionToDB(currentLoadedMapId, sugData);
        showNotification("새로운 풀이 제안이 등록되었습니다!", "#f39c12");
        closeSuggestionModal();
        loadSuggestionsForCurrentMap();
    } catch (error) {
        alert("제안 등록 실패: " + error.message);
    } finally {
        btn.innerText = "제안 등록"; btn.disabled = false;
        document.getElementById('sugComment').value = "";
    }
}

export async function loadSuggestionsForCurrentMap() {
    if (!currentLoadedMapId) return;
    const listDiv = document.getElementById('suggestionList');
    listDiv.innerHTML = '<div style="padding: 30px; text-align: center;"><p style="color:#94a3b8; font-size:14px; font-weight: 500;">불러오는 중...</p></div>';

    try {
        const sugs = await FB.fetchSuggestionsFromDB(currentLoadedMapId);

        const countSpan = document.getElementById('sugCount');
        if (countSpan) countSpan.innerText = sugs.length;

        listDiv.innerHTML = '';
        if (sugs.length === 0) {
            listDiv.innerHTML = '<div style="padding: 40px 20px; text-align: center; background: #f8fafc; border-radius: 12px; margin-top: 15px;"><p style="color:#64748b; font-size:14px; font-weight: 500; line-height: 1.6; margin: 0;">아직 등록된 제안이 없습니다.<br>첫 번째로 풀이를 뽐내보세요!</p></div>';
            return;
        }

        sugs.forEach(sug => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.style.cssText = 'display: flex; flex-direction: column; gap: 16px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: border-color 0.2s;';

            item.onmouseover = () => item.style.borderColor = '#cbd5e1';
            item.onmouseout = () => item.style.borderColor = '#e2e8f0';

            const topRow = document.createElement('div');
            topRow.style.cssText = 'display: flex; gap: 16px;';

            const miniGridWrapper = document.createElement('div');
            miniGridWrapper.style.cssText = 'width: 84px; flex-shrink: 0;';
            const miniGrid = createMiniGridDOM(sug.mapData, false);
            miniGrid.style.borderRadius = '8px';
            miniGrid.style.overflow = 'hidden';
            miniGrid.style.border = '1px solid #f1f5f9';
            miniGridWrapper.appendChild(miniGrid);

            const content = document.createElement('div');
            content.style.cssText = "flex: 1; display: flex; flex-direction: column; justify-content: center;";

            let catBadge = sug.category === 'NG'
                ? '<span style="background:#ef4444;color:white;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:800;letter-spacing:-0.5px;">🆖 기물 줄임</span>'
                : '<span style="background:#3b82f6;color:white;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:800;letter-spacing:-0.5px;">🔠 복수정답</span>';

            content.innerHTML = `
                <div style="margin-bottom:10px; display: flex; align-items: center; gap: 8px;">
                    ${catBadge} 
                    <span style="color:#94a3b8;font-size:11px;font-weight:500;">${new Date(sug.createdAt).toLocaleDateString()}</span>
                </div>
                <p style="margin:0; font-size: 14px; font-weight:700; color:#1e293b; line-height: 1.5; word-break: keep-all;">${sug.comment}</p>
            `;

            topRow.appendChild(miniGridWrapper);
            topRow.appendChild(content);

            const actions = document.createElement('div');
            actions.style.cssText = "display:flex; gap:12px; width: 100%; border-top: 1px dashed #e2e8f0; padding-top: 14px;";

            const testBtn = document.createElement('button');
            testBtn.innerHTML = "▶️ 이 풀이로 테스트";
            testBtn.style.cssText = "flex: 1; padding:10px; border:none; background:#10b981; color:white; border-radius:8px; cursor:pointer; font-weight:700; font-size:13px; transition: background 0.2s;";
            testBtn.onmouseover = () => testBtn.style.background = "#059669";
            testBtn.onmouseout = () => testBtn.style.background = "#10b981";
            testBtn.onclick = () => {
                cancelDragOperation();
                applyMapData(sug.mapData);

                if (!isEditorMode && editorMapDataBackup) {
                    playerInventory = {};
                    for (let r = 0; r < GRID_SIZE; r++) {
                        for (let c = 0; c < GRID_SIZE; c++) {
                            if (editorMapDataBackup[r][c] && editorMapDataBackup[r][c].isInventory) {
                                refundToInventory(editorMapDataBackup[r][c]);
                            }
                        }
                    }

                    for (let r = 0; r < GRID_SIZE; r++) {
                        for (let c = 0; c < GRID_SIZE; c++) {
                            let cellItem = mapData[r][c];
                            if (cellItem && cellItem.isInventory) {
                                let rot = cellItem.canRotate ? 0 : (cellItem.rotation || 0);
                                if (cellItem.type === 'block') rot = 0;
                                let key = `${cellItem.type}_${cellItem.canRotate}_${rot}`;

                                if (playerInventory[key] && playerInventory[key].count > 0) {
                                    playerInventory[key].count--;
                                } else {
                                    mapData[r][c] = null;
                                    const cell = document.querySelector(`.grid-cell[data-row='${r}'][data-col='${c}']`);
                                    updateCellVisual(cell, null);
                                }
                            }
                        }
                    }
                    renderInventoryUI();
                    refreshLaser();
                }
                showNotification("제안된 풀이를 불러왔습니다. 확인해보세요!", "#27ae60");
                closeSuggestionDrawer();
            };
            actions.appendChild(testBtn);

            if (FB.currentUserUid === currentLoadedMapAuthorUid || FB.currentUserUid === sug.suggesterUid) {
                const delBtn = document.createElement('button');
                delBtn.innerHTML = "🗑️";
                delBtn.title = "삭제하기";
                delBtn.style.cssText = "padding:10px 16px; border:1px solid #f87171; background:transparent; color:#ef4444; border-radius:8px; cursor:pointer; font-size:13px; transition: all 0.2s;";
                delBtn.onmouseover = () => { delBtn.style.background = "#ef4444"; delBtn.style.color = "#fff"; };
                delBtn.onmouseout = () => { delBtn.style.background = "transparent"; delBtn.style.color = "#ef4444"; };
                delBtn.onclick = async () => {
                    if (confirm("이 제안을 삭제하시겠습니까?")) {
                        try {
                            await FB.deleteSuggestionFromDB(currentLoadedMapId, sug.id);
                            showNotification("제안이 삭제되었습니다.", "#e74c3c");
                            loadSuggestionsForCurrentMap();
                        } catch (e) {
                            alert("삭제 권한이 없거나 오류가 발생했습니다.");
                        }
                    }
                };
                actions.appendChild(delBtn);
            }

            item.appendChild(topRow);
            item.appendChild(actions);
            listDiv.appendChild(item);
        });
    } catch (e) {
        listDiv.innerHTML = `<div style="padding: 20px; text-align: center;"><p style="color:#ef4444;">게시판을 불러오는 데 실패했습니다.</p></div>`;
    }
}

// ═══════════════ 맵 삭제 / 새 맵 ═══════════════
export async function deleteCurrentMap() {
    if (!currentLoadedMapId) return;
    if (confirm("정말로 이 맵을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며, 모든 제안과 평가도 함께 삭제됩니다.")) {
        const btn = document.getElementById('deleteMapBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = "삭제 중...";
        btn.disabled = true;
        try {
            await FB.deleteMapFromDB(currentLoadedMapId);
            showNotification("맵이 성공적으로 삭제되었습니다.", "#e74c3c");
            createNewMap();
        } catch (error) {
            alert("맵 삭제 권한이 없거나 오류가 발생했습니다: " + error.message);
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

export function createNewMap() {
    if (confirm("진행 중인 맵이 모두 초기화되고 빈 에디터로 돌아갑니다. 새로 만드시겠습니까?")) {
        if (isLibraryMode) toggleLibraryScreen();
        if (!isEditorMode) toggleMode();

        mapData.length = 0;
        for (let i = 0; i < GRID_SIZE; i++) {
            mapData.push(Array(GRID_SIZE).fill(null));
        }
        playerInventory = {};
        editorMapDataBackup = null;

        document.querySelectorAll('.grid-cell').forEach(cell => updateCellVisual(cell, null));
        refreshLaser();

        document.getElementById('loadedMapInfo').style.display = 'none';
        closeSuggestionDrawer();

        currentLoadedMapId = null;
        currentLoadedMapAuthorUid = null;
        currentLoadedMapObj = null;

        const url = new URL(window.location);
        url.searchParams.delete('mapId');
        window.history.pushState({}, '', url);
        showNotification("새로운 맵이 생성되었습니다!", "#e67e22");
        updateSugHeaderBtnUI();
    }
}

// ═══════════════ URL 파라미터 자동 로드 ═══════════════
export function initUrlParamLoader() {
    const urlParams = new URLSearchParams(window.location.search);
    const mapId = urlParams.get('mapId');
    if (mapId) {
        setTimeout(async () => {
            try {
                showNotification("서버에서 맵을 불러오는 중...", "#f39c12");
                const mapDoc = await FB.fetchFromDB(mapId);
                if (mapDoc) {
                    playMapFromLibrary(mapDoc);
                } else {
                    alert("존재하지 않거나 삭제된 맵입니다.");
                }
            } catch (e) {
                alert("맵 불러오기 실패: " + e.message);
            }
        }, 500);
    }
}