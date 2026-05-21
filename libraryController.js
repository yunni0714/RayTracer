// libraryController.js — 도서관 & 커뮤니티: 라이브러리 화면, 평가/투표, 제안 게시판
import * as FB from './firebaseApp.js';
import { SVG_ART, GRID_SIZE, CELL_SIZE, mapData, playerInventory, isEditorMode,
    editorMapDataBackup, selectedTool, lastActiveTool, undoStack,
    showNotification, cancelDragOperation, deselectAllTools, restoreTool,
    refundToInventory, updateCellVisual, applyMapData, saveStateDirectly,
    renderInventoryUI, toggleMode, resetAnswerState, resetEditorState,
    enterMapEditMode, exitMapEditMode, isMapEditMode } from './dragAndDrop.js';
import { refreshLaser } from './laserEngine.js';

// ═══════════════ 전역 상태 ═══════════════
export let allLibraryMaps = [];
export let isLibraryMode = false;
export let currentLoadedMapId = null;
export let currentLoadedMapAuthorUid = null;
export let currentLoadedMapObj = null;
export let currentMapReactions = { ok: 0, god: 0 };

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
    let total = (diffVotes.Tutor || 0) + (diffVotes.Easy || 0) + (diffVotes.Normal || 0) + (diffVotes.Hard || 0) + (diffVotes.Insane || 0);
    if (total === 0) return null;
    return Object.keys(diffVotes).reduce((a, b) => diffVotes[a] > diffVotes[b] ? a : b);
}

// ═══════════════ 미니 그리드 DOM 생성 (제안 게시판용) ═══════════════
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

// ═══════════════ 미니 그리드 V2 (카드 디자인용, CSS 클래스 사용) ═══════════════
function createMiniGridV2(mapDataArray) {
    const wrapper = document.createElement('div');
    wrapper.className = 'mini-wrapper';

    const grid = document.createElement('div');
    grid.className = 'mini-grid-v2';

    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'mini-cell-v2';
        grid.appendChild(cell);
    }

    if (mapDataArray && Array.isArray(mapDataArray)) {
        mapDataArray.forEach(item => {
            if (item.isInventory) return;
            if (item.x >= 0 && item.x < 5 && item.y >= 0 && item.y < 5) {
                const index = item.y * 5 + item.x;
                const cell = grid.children[index];
                if (SVG_ART[item.type]) {
                    cell.innerHTML = `<div style="transform: rotate(${item.rotation || 0}deg); width:100%; height:100%; display:flex; justify-content:center; align-items:center;">${SVG_ART[item.type]}</div>`;
                }
            }
        });
    }

    wrapper.appendChild(grid);
    return wrapper;
}

// ═══════════════ 카드 엘리먼트 생성 (.map-card-v2) ═══════════════
function createCardElement(mapObj) {
    const card = document.createElement('div');
    card.className = 'map-card-v2';
    card.addEventListener('click', () => playMapFromLibrary(mapObj));

    // 상단 미니 그리드
    card.appendChild(createMiniGridV2(mapObj.mapData));

    // 메타 정보 (제목, 제작자 • 날짜)
    const creatorDiff = mapObj.difficulty || 'Normal';
    const userDiff = calculateUserDifficulty(mapObj.diffVotes);
    const dateStr = mapObj.createdAt
        ? new Date(mapObj.createdAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })
        : '';
    const okCount = mapObj.reactionOk || 0;
    const godCount = mapObj.reactionGod || 0;

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    meta.innerHTML = `
        <h4 title="${mapObj.title || ''}">${mapObj.title || '제목 없음'}</h4>
        <p class="sub">${mapObj.author || '알 수 없음'} &bull; ${dateStr}</p>
    `;
    card.appendChild(meta);

    // 구분선
    const divider = document.createElement('div');
    divider.className = 'card-divider';
    card.appendChild(divider);

    // 하단: 난이도 배지 + 통계
    const bottom = document.createElement('div');
    bottom.className = 'card-bottom';

    const badgeRow = document.createElement('div');
    badgeRow.className = 'badge-row';

    const officialPill = document.createElement('span');
    officialPill.className = `diff-pill diff-${creatorDiff}`;
    officialPill.textContent = `공식: ${creatorDiff}`;
    badgeRow.appendChild(officialPill);

    const evalLabel = userDiff || 'None';
    const evalPill = document.createElement('span');
    evalPill.className = `diff-pill diff-${evalLabel}`;
    evalPill.textContent = `평가: ${evalLabel}`;
    badgeRow.appendChild(evalPill);

    bottom.appendChild(badgeRow);

    const statRow = document.createElement('div');
    statRow.className = 'stat-row';
    statRow.innerHTML = `
        <span class="stat stat-ok">✅ ${okCount}</span>
        <span class="stat stat-god">👍 ${godCount}</span>
    `;
    bottom.appendChild(statRow);

    card.appendChild(bottom);
    return card;
}

// ═══════════════ 라이브러리 화면 ═══════════════
export function toggleLibraryScreen() {
    isLibraryMode = !isLibraryMode;
    const btn = document.getElementById('libraryToggleBtn');
    const editorScreen = document.getElementById('editorScreen');
    const libScreen = document.getElementById('libraryScreen');

    if (isLibraryMode) {
        if (btn) { btn.innerHTML = "🔙 돌아가기"; btn.classList.add('active'); }
        if (editorScreen) editorScreen.classList.remove('active');
        if (libScreen) libScreen.classList.add('active');
        loadLibraryMaps();
    } else {
        if (btn) { btn.innerHTML = "📚 맵 라이브러리 열기"; btn.classList.remove('active'); }
        if (libScreen) libScreen.classList.remove('active');
        if (editorScreen) editorScreen.classList.add('active');
    }
}

export async function loadLibraryMaps() {
    const sortSelect = document.getElementById('sortSelect');
    const sortBy = sortSelect ? sortSelect.value : 'createdAt';
    const grid = document.getElementById('libraryGrid');
    if (!grid) return;

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

// ── 수평 스크롤 섹션 ──
function renderHorizontalSection(container, title, maps) {
    const section = document.createElement('div');
    section.className = 'library-section';

    const heading = document.createElement('h2');
    heading.className = 'section-heading';
    heading.innerText = title;
    section.appendChild(heading);

    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'horizontal-scroll-container';
    maps.forEach(mapObj => scrollContainer.appendChild(createCardElement(mapObj)));
    section.appendChild(scrollContainer);
    container.appendChild(section);
}

// ── Recent Maps 섹션 (인라인 검색/정렬/새맵 버튼 포함) ──
function renderRecentMapsSection(container, maps) {
    const header = document.createElement('div');
    header.className = 'recent-maps-header';
    header.innerHTML = `
        <h2>recent maps</h2>
        <input id="searchInput" type="text" placeholder="맵 제목, 제작자 이름으로 검색...">
        <select id="sortSelect">
            <option value="createdAt">최신 등록순</option>
            <option value="reactionGod">갓맵(👍)순</option>
        </select>
        <button class="new-map-btn" id="newMapBtnLibrary">✨ 새 맵 만들기</button>
    `;
    container.appendChild(header);

    header.querySelector('#searchInput').addEventListener('input', applyFilters);
    header.querySelector('#sortSelect').addEventListener('change', loadLibraryMaps);
    header.querySelector('#newMapBtnLibrary').addEventListener('click', createNewMap);

    const mainGrid = document.createElement('div');
    mainGrid.className = 'recent-maps-grid';
    maps.forEach(mapObj => mainGrid.appendChild(createCardElement(mapObj)));
    container.appendChild(mainGrid);
}

// ── 전체 라이브러리 렌더링: featured → original → recent maps ──
export function renderLibraryCards(mapsList, isSearch = false) {
    const grid = document.getElementById('libraryGrid');
    if (!grid) return;
    grid.innerHTML = '';
    grid.style.display = 'block';

    if (isSearch) {
        renderRecentMapsSection(grid, mapsList);
        return;
    }

    if (mapsList.length > 0) {
        const featured = [...mapsList]
            .sort((a, b) => (b.reactionGod || 0) - (a.reactionGod || 0))
            .slice(0, 10);
        renderHorizontalSection(grid, "featured", featured);

        const original = [...mapsList].sort((a, b) =>
            new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
        renderHorizontalSection(grid, "original", original);
    }

    renderRecentMapsSection(grid, mapsList);
}

// ═══════════════ 우측 패널 탭 전환 ═══════════════
export function switchRightPanel(tab) {
    const nextMapPanel = document.getElementById('panelNextMap');
    const suggestionPanel = document.getElementById('panelSuggestion');
    if (nextMapPanel) nextMapPanel.style.display = tab === 'next-map' ? 'block' : 'none';
    if (suggestionPanel) suggestionPanel.style.display = tab === 'suggestion' ? 'block' : 'none';
    document.querySelectorAll('.right-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.panel === tab);
    });
}

// ═══════════════ "다음 문제" 패널 렌더링 ═══════════════
export function renderNextMapPanel() {
    const list = document.getElementById('nextMapList');
    if (!list) return;
    const maps = allLibraryMaps.filter(m => m.id !== currentLoadedMapId).slice(0, 20);
    list.innerHTML = '';

    if (maps.length === 0) {
        list.innerHTML = '<p style="color:#94a3b8; font-size:13px; text-align:center; padding:20px 0;">다른 맵이 없습니다.</p>';
        return;
    }

    maps.forEach(mapObj => {
        const card = document.createElement('div');
        card.className = 'next-map-card';

        // 좌측: 미니 그리드 (createMiniGridV2 재사용)
        const gridArea = document.createElement('div');
        gridArea.className = 'next-grid-area';
        gridArea.appendChild(createMiniGridV2(mapObj.mapData));
        card.appendChild(gridArea);

        // 우측: 정보 영역
        const info = document.createElement('div');
        info.className = 'next-info-v2';

        const diff = mapObj.difficulty || 'Normal';
        const userDiff = calculateUserDifficulty(mapObj.diffVotes);
        const evalLabel = userDiff || 'None';
        const dateStr = mapObj.createdAt
            ? new Date(mapObj.createdAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })
            : '';
        const okCount = mapObj.reactionOk || 0;
        const godCount = mapObj.reactionGod || 0;

        info.innerHTML = `
            <h4 title="${mapObj.title || ''}">${mapObj.title || '제목 없음'}</h4>
            <p class="next-sub">${mapObj.author || ''} &bull; ${dateStr}</p>
            ${mapObj.description ? `<p class="next-desc">${mapObj.description}</p>` : ''}
            <div class="next-badge-row">
                <span class="diff-pill diff-${diff}">공식: ${diff}</span>
                <span class="diff-pill diff-${evalLabel}">평가: ${evalLabel}</span>
            </div>
            <div class="next-stat-row">
                <span class="stat stat-ok">✅ ${okCount}</span>
                <span class="stat stat-god">🔥 ${godCount}</span>
            </div>
        `;

        card.appendChild(info);
        card.addEventListener('click', () => playMapFromLibrary(mapObj));
        list.appendChild(card);
    });
}

// ═══════════════ 제안 드로어 제어 (하위 호환) ═══════════════
export function closeSuggestionDrawer() {
    const sugContainer = document.getElementById('suggestionBoardContainer');
    if (sugContainer) sugContainer.classList.remove('drawer-open');
}

// ═══════════════ 맵 플레이 ═══════════════
export function playMapFromLibrary(mapObj) {
    resetAnswerState();
    exitMapEditMode();
    if (isLibraryMode) toggleLibraryScreen();
    if (!isEditorMode) toggleMode();

    if (mapObj.mapData) applyMapData(mapObj.mapData);

    currentLoadedMapId = mapObj.id;
    currentLoadedMapAuthorUid = mapObj.authorUid;
    currentLoadedMapObj = mapObj;
    currentMapReactions.ok = mapObj.reactionOk || 0;
    currentMapReactions.god = mapObj.reactionGod || 0;

    const loadedMapInfo = document.getElementById('loadedMapInfo');
    if (loadedMapInfo) loadedMapInfo.style.display = 'flex';

    const infoTitle = document.getElementById('infoTitle');
    if (infoTitle) {
        const v = mapObj.version || 1;
        infoTitle.innerText = `🗺️ ${mapObj.title}${v >= 2 ? ` (ver. ${v})` : ''}`;
    }

    const infoAuthor = document.getElementById('infoAuthor');
    if (infoAuthor) infoAuthor.innerText = mapObj.author;

    const diffSpan = document.getElementById('infoDifficulty');
    if (diffSpan) {
        const diff = mapObj.difficulty || 'Normal';
        diffSpan.innerText = diff;
        diffSpan.className = `difficulty-badge diff-${diff}`;
    }

    const userDiffSpan = document.getElementById('infoUserDifficulty');
    if (userDiffSpan) {
        const userDiff = calculateUserDifficulty(mapObj.diffVotes);
        if (userDiff) {
            userDiffSpan.innerText = userDiff;
            userDiffSpan.className = `difficulty-badge diff-${userDiff}`;
        } else {
            userDiffSpan.innerText = "평가 부족";
            userDiffSpan.className = `difficulty-badge diff-None`;
        }
    }

    updateReactionUI(mapObj.id);
    updateSugHeaderBtnUI();
    loadSuggestionsForCurrentMap();

    // 우측 패널 표시 및 "다음 문제" 탭 기본 활성화
    const rightPanel = document.getElementById('rightSidePanel');
    if (rightPanel) rightPanel.style.display = 'flex';
    switchRightPanel('next-map');
    renderNextMapPanel();

    showNotification(`[${mapObj.title}] 플레이를 시작합니다!`, "#27ae60");

    if (isEditorMode) toggleMode();
}

// ═══════════════ 평가 & 투표 ═══════════════
export async function toggleReaction(type) {
    if (!currentLoadedMapId) return;
    const btn = type === 'ok' ? document.getElementById('btnReactOk') : document.getElementById('btnReactGod');
    if (!btn || btn.disabled) return;
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

    const countOk = document.getElementById('countOk');
    if (countOk) countOk.innerText = currentMapReactions.ok;

    const countGod = document.getElementById('countGod');
    if (countGod) countGod.innerText = currentMapReactions.god;

    if (btnOk) {
        btnOk.classList.toggle('active', state.ok);
        btnOk.classList.toggle('ok', state.ok);
    }
    if (btnGod) {
        btnGod.classList.toggle('active', state.god);
        btnGod.classList.toggle('god', state.god);
    }

    document.querySelectorAll('.diff-vote-btn').forEach(btn => btn.classList.remove('active'));
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
        startMapEdit();
    } else {
        openSuggestionModal();
    }
}

// ═══════════════ 맵 인플레이스 수정 ═══════════════
export function startMapEdit() {
    if (!currentLoadedMapObj) return;
    resetAnswerState();
    enterMapEditMode();
    showNotification("✏️ 수정 모드입니다. 그리드를 자유롭게 배치한 뒤 저장하세요.", "#f59e0b");
}

export function saveMapEdit() {
    if (typeof window._openUploadForEdit === 'function') {
        window._openUploadForEdit(currentLoadedMapObj);
    }
}

export function cancelMapEdit() {
    if (!confirm("수정한 내용을 모두 버리고 원래 맵으로 돌아갑니다. 계속하시겠습니까?")) return;
    exitMapEditMode({ restore: true });
    if (isEditorMode) toggleMode();
    showNotification("수정이 취소되었습니다.", "#7f8c8d");
}

// ═══════════════ 제안 모달 ═══════════════
export function openSuggestionModal() {
    const modal = document.getElementById('suggestionModal');
    if (modal) modal.style.display = 'flex';
}
export function closeSuggestionModal() {
    const modal = document.getElementById('suggestionModal');
    if (modal) modal.style.display = 'none';
}

export async function submitSuggestion() {
    const catSelect = document.getElementById('sugCategory');
    const commentInput = document.getElementById('sugComment');
    if (!catSelect || !commentInput) return;

    const category = catSelect.value;
    const comment = commentInput.value.trim();
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
    if (btn) { btn.innerText = "등록 중..."; btn.disabled = true; }

    try {
        await FB.uploadSuggestionToDB(currentLoadedMapId, sugData);
        showNotification("새로운 풀이 제안이 등록되었습니다!", "#f39c12");
        closeSuggestionModal();
        loadSuggestionsForCurrentMap();
    } catch (error) {
        alert("제안 등록 실패: " + error.message);
    } finally {
        if (btn) { btn.innerText = "제안 등록"; btn.disabled = false; }
        commentInput.value = "";
    }
}

export async function loadSuggestionsForCurrentMap() {
    if (!currentLoadedMapId) return;
    const listDiv = document.getElementById('suggestionList');
    if (!listDiv) return;

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

        const isMapOwner = !!FB.currentUserUid && FB.currentUserUid === currentLoadedMapAuthorUid;

        sugs.forEach(sug => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';

            // 미니 그리드 (createMiniGridV2 사용 — CSS 클래스 기반, 1:1 비율 보장)
            const gridArea = document.createElement('div');
            gridArea.className = 'sug-grid-area';
            gridArea.appendChild(createMiniGridV2(sug.mapData));
            item.appendChild(gridArea);

            // 카테고리 배지 + 날짜 + 코멘트
            const catBadge = sug.category === 'NG'
                ? '<span style="background:#ef4444;color:white;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:800;">🆖 기물 줄임</span>'
                : '<span style="background:#3b82f6;color:white;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:800;">🔠 복수정답</span>';
            const dateStr = new Date(sug.createdAt).toLocaleDateString();

            const content = document.createElement('div');
            content.className = 'sug-content';
            content.innerHTML = `
                <div class="sug-cat-row">${catBadge}<span style="color:#94a3b8;font-size:11px;">${dateStr}</span></div>
                <p class="sug-comment">${sug.comment}</p>
            `;
            item.appendChild(content);

            // 액션 버튼 (우측 세로 배열)
            const actions = document.createElement('div');
            actions.className = 'sug-actions';

            const testBtn = document.createElement('button');
            testBtn.className = 'sug-test-btn';
            testBtn.innerHTML = "▶ 이 풀이로 테스트";
            testBtn.addEventListener('click', () => {
                cancelDragOperation();
                resetAnswerState();
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
            });
            actions.appendChild(testBtn);

            const canDelete = isMapOwner || FB.currentUserUid === sug.suggesterUid;
            if (canDelete) {
                const delBtn = document.createElement('button');
                delBtn.className = 'sug-del-btn';
                delBtn.innerHTML = "🗑️ 삭제";
                delBtn.addEventListener('click', async () => {
                    if (confirm("이 제안을 삭제하시겠습니까?")) {
                        try {
                            await FB.deleteSuggestionFromDB(currentLoadedMapId, sug.id);
                            showNotification("제안이 삭제되었습니다.", "#e74c3c");
                            loadSuggestionsForCurrentMap();
                        } catch (e) {
                            alert("삭제 권한이 없거나 오류가 발생했습니다.");
                        }
                    }
                });
                actions.appendChild(delBtn);
            }

            item.appendChild(actions);
            listDiv.appendChild(item);
        });
    } catch (e) {
        if (listDiv) listDiv.innerHTML = `<div style="padding: 20px; text-align: center;"><p style="color:#ef4444;">게시판을 불러오는 데 실패했습니다.</p></div>`;
    }
}

// ═══════════════ 맵 삭제 / 새 맵 ═══════════════
export async function deleteCurrentMap() {
    if (!currentLoadedMapId) return;
    if (confirm("정말로 이 맵을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며, 모든 제안과 평가도 함께 삭제됩니다.")) {
        const btn = document.getElementById('deleteMapBtn');
        if (!btn) return;

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
        resetAnswerState();
        exitMapEditMode();
        if (isLibraryMode) toggleLibraryScreen();
        if (!isEditorMode) toggleMode();

        resetEditorState();

        document.querySelectorAll('.grid-cell').forEach(cell => updateCellVisual(cell, null));
        refreshLaser();

        const loadedMapInfo = document.getElementById('loadedMapInfo');
        if (loadedMapInfo) loadedMapInfo.style.display = 'none';

        const rightPanel = document.getElementById('rightSidePanel');
        if (rightPanel) rightPanel.style.display = 'none';

        const answerBtn = document.getElementById('answerBtn');
        if (answerBtn) answerBtn.style.display = 'none';

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

// ═══════════════ 이벤트 리스너 초기화 ═══════════════
export function initLibraryEventListeners() {
    const bindBtn = (id, eventType, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(eventType, fn);
    };

    bindBtn('libraryToggleBtn', 'click', toggleLibraryScreen);
    bindBtn('newMapBtn', 'click', createNewMap);

    // 평가 & 투표
    bindBtn('btnReactOk', 'click', () => toggleReaction('ok'));
    bindBtn('btnReactGod', 'click', () => toggleReaction('god'));
    bindBtn('sugHeaderBtn', 'click', handleSugHeaderBtnAction);
    bindBtn('deleteMapBtn', 'click', deleteCurrentMap);
    bindBtn('saveMapEditBtn', 'click', saveMapEdit);
    bindBtn('cancelMapEditBtn', 'click', cancelMapEdit);

    // 제안 모달
    bindBtn('sugSubmitBtn', 'click', submitSuggestion);
    bindBtn('closeSugModalBtn', 'click', closeSuggestionModal);

    // 난이도 투표
    document.querySelectorAll('.diff-vote-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const diffClass = Array.from(e.currentTarget.classList).find(c => c.startsWith('diff-'));
            if (diffClass) voteDifficulty(diffClass.replace('diff-', ''));
        });
    });

    // 우측 패널 탭
    document.querySelectorAll('.right-tab').forEach(btn => {
        btn.addEventListener('click', () => switchRightPanel(btn.dataset.panel));
    });
}

initLibraryEventListeners();
