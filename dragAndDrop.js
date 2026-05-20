// dragAndDrop.js — 게임 핵심 상호작용: 드래그, 회전, 실행취소, 셀 시각화
import { refreshLaser, clearLaser } from './laserEngine.js';

// ═══════════════ SVG 아트 & 상수 ═══════════════
export const SVG_ART = {
    ray: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="none" stroke="#333" stroke-width="8"/><path d="M50 45.67 v-41.03" fill="#040000" stroke="#333" stroke-width="8" stroke-linecap="square"/></svg>`,
    target: `<svg viewBox="0 0 100 100"><path d="M50 12 l38 38 -38 38 -38 -38 38 -38 Z" fill="none" stroke="#333" stroke-width="8" stroke-linejoin="miter"/><path d="M40.5 23 l9 -9 10 9 -10 9 -9 -9 Z" fill="none" stroke="#333" stroke-width="8" stroke-linejoin="miter"/></svg>`,
    mirror: `<svg viewBox="0 0 100 100"><path d="M15 85 L85 15" stroke="#333" stroke-width="10" stroke-linecap="square"/></svg>`,
    half_mirror: `<svg viewBox="0 0 100 100"><path d="M10 80 L70 20 M30 90 L90 30" stroke="#333" stroke-width="8" stroke-linecap="square"/></svg>`,
    block: `<svg viewBox="0 0 100 100"><path d="M15 15 L85 85 M85 15 L15 85" stroke="#333" stroke-width="10" stroke-linecap="square"/></svg>`,
    tunnel: `<svg viewBox="0 0 100 100"><path d="M11.75 20 v60 M88.25 20 v60" fill="none" stroke="#333" stroke-width="10" stroke-linecap="square"/></svg>`,
    single_mirror: `<svg viewBox="0 0 100 100"><path d="M15 85 L85 15 L85 85 Z" fill="none" stroke="#333" stroke-width="10" stroke-linejoin="miter"/></svg>`,
    target_mirror_a: `<svg viewBox="0 0 100 100"><path d="M15 85 l70 -70 v70 h-70 Z" fill="none" stroke="#333" stroke-width="10"/><rect x="65" y="50" width="20" height="18" fill="none" stroke="#333" stroke-width="8"/></svg>`,
    target_mirror_b: `<svg viewBox="0 0 100 100"><path d="M15 85 l70 -70 v70 h-70 Z" fill="none" stroke="#333" stroke-width="10"/><rect x="50" y="65" width="18" height="20" fill="none" stroke="#333" stroke-width="8"/></svg>`,
    mirror_45: `<svg viewBox="0 0 100 100"><path d="M15 50 L85 50" stroke="#333" stroke-width="10" stroke-linecap="square"/></svg>`,
    half_mirror_45: `<svg viewBox="0 0 100 100"><path d="M15 50 L85 50" stroke="#333" stroke-width="8" stroke-dasharray="15 10" stroke-linecap="square"/></svg>`,
    diag_single_mirror_a: `<svg viewBox="0 0 100 100"><path d="M15 50 L85 50 L85 85 L15 85 Z" fill="none" stroke="#333" stroke-width="10" stroke-linejoin="miter"/></svg>`,
    diag_single_mirror_b: `<svg viewBox="0 0 100 100"><path d="M15 50 L85 50 L85 15 L15 15 Z" fill="none" stroke="#333" stroke-width="10" stroke-linejoin="miter"/></svg>`,
    v_mirror: `<svg viewBox="0 0 100 100"><path d="M50 15 L50 85" stroke="#333" stroke-width="10" stroke-linecap="square"/></svg>`,
    v_half_mirror: `<svg viewBox="0 0 100 100"><path d="M50 15 L50 85" stroke="#333" stroke-width="8" stroke-dasharray="15 10" stroke-linecap="square"/></svg>`,
    v_single_mirror: `<svg viewBox="0 0 100 100"><path d="M50 15 L50 85 L85 85 L85 15 Z" fill="none" stroke="#333" stroke-width="10" stroke-linejoin="miter"/></svg>`,
    v_target_mirror_a: `<svg viewBox="0 0 100 100"><path d="M50 15 L50 85 L85 85 L85 15 Z" fill="none" stroke="#333" stroke-width="10" stroke-linejoin="miter"/><rect x="65" y="40" width="20" height="20" fill="none" stroke="#333" stroke-width="8"/></svg>`,
    v_target_mirror_b: `<svg viewBox="0 0 100 100"><path d="M50 15 L50 85 L85 85 L85 15 Z" fill="none" stroke="#333" stroke-width="10" stroke-linejoin="miter"/><rect x="65" y="65" width="20" height="20" fill="none" stroke="#333" stroke-width="8"/></svg>`
};

export const GRID_SIZE = 5;
export const CELL_SIZE = 100;

// ═══════════════ 전역 상태 ═══════════════
export let mapData = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(null));
export let playerInventory = {};
export let editorMapDataBackup = null;
export let isEditorMode = true;

export let selectedTool = null;
export let lastActiveTool = null;

let isModRotatableActive = false;
let isModLockActive = false;
let isModInvActive = false;
let hasPlacedSinceSelection = false;

export let undoStack = [];

// 드래그 상태
let dragSource = null;
let dragGhost = null;

export function cancelDragOperation() {
    if (dragGhost) { dragGhost.remove(); dragGhost = null; }
    dragSource = null;
    if (lastActiveTool) { restoreTool(lastActiveTool); lastActiveTool = null; }
}

// ═══════════════ 알림 (공유 유틸) ═══════════════
export function showNotification(msg, color = "#27ae60") {
    const noti = document.getElementById('notification');
    noti.innerText = msg;
    noti.style.backgroundColor = color;
    noti.style.display = 'block';
    setTimeout(() => { noti.style.display = 'none'; }, 2000);
}

// ═══════════════ 기물 유틸 ═══════════════

export function deselectAllTools() {
    document.querySelectorAll('.tool-item:not(.mod-tool)').forEach(i => i.classList.remove('selected'));
    selectedTool = null;
}

export function restoreTool(toolData) {
    if (!toolData) return;
    deselectAllTools();
    selectedTool = toolData;
    const paletteItem = document.querySelector(`.tool-item[data-tool="${toolData.type}"]`);
    if (paletteItem) paletteItem.classList.add('selected');
    if (toolData.invKey) {
        const invItem = Array.from(document.querySelectorAll('#inventoryGrid .tool-item')).find(
            item => item.innerHTML.includes(SVG_ART[toolData.type])
        );
        if (invItem) invItem.classList.add('selected');
    }
}

export function isAdvancedMap() {
    const advancedTypes = [
        'mirror_45', 'half_mirror_45', 'diag_single_mirror_a', 'v_target_mirror_a',
        'diag_single_mirror_b', 'v_target_mirror_b', 'v_mirror', 'v_half_mirror', 'v_single_mirror'
    ];
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (mapData[r][c] && advancedTypes.includes(mapData[r][c].type)) return true;
        }
    }
    for (let key in playerInventory) {
        if (advancedTypes.includes(playerInventory[key].type) && playerInventory[key].count > 0) return true;
    }
    return false;
}

export function getRotationStep(type) {
    if (['mirror_45', 'half_mirror_45'].includes(type)) return 45;
    if (['ray', 'target'].includes(type)) return isAdvancedMap() ? 45 : 90;
    return 90;
}

export function executeRotation(r, c) {
    let item = mapData[r][c];
    if (!item) return;
    if (item.type === 'block') return;
    let step = getRotationStep(item.type);

    if (step === 90 && item.rotation % 90 !== 0) {
        item.rotation = (Math.floor(item.rotation / 90) * 90 + 90) % 360;
    } else {
        item.rotation = (item.rotation + step) % 360;
    }
}

export function refundToInventory(data) {
    if (!data) return;
    let rot = data.canRotate ? 0 : (data.rotation || 0);
    if (data.type === 'block') rot = 0;

    let key = `${data.type}_${data.canRotate}_${rot}`;
    if (!playerInventory[key]) {
        playerInventory[key] = { count: 0, type: data.type, canRotate: data.canRotate, rotation: rot };
    }
    playerInventory[key].count++;
}

export function updateCellVisual(cell, data) {
    if (!data) { cell.innerHTML = ''; return; }
    let badges = '';
    if (data.isInventory) {
        badges += '<span class="badge-inv" title="인벤토리 지급">🎒</span>';
        if (!data.canRotate) badges += '<span class="badge-lock" title="회전 불가">🔒</span>';
    } else if (data.canRotate) {
        badges += '<span class="badge-rot" title="회전 가능 기물">🔄</span>';
    }

    let svgHtml = SVG_ART[data.type] || '';
    let rot = (data.type === 'block') ? 0 : (data.rotation || 0);

    cell.innerHTML = `
        <div class="item" style="transform: rotate(${rot}deg);">${svgHtml}</div>
        <div class="modifier-icons">${badges}</div>
    `;
}

// ═══════════════ 실행 취소 (Undo) ═══════════════

export function saveStateDirectly() {
    undoStack.push({
        map: JSON.parse(JSON.stringify(mapData)),
        inv: JSON.parse(JSON.stringify(playerInventory))
    });
    if (undoStack.length > 50) undoStack.shift();
}

export function undo() {
    if (undoStack.length === 0) {
        showNotification("되돌릴 작업이 없습니다.", "#e74c3c");
        return;
    }
    const prevState = undoStack.pop();
    mapData = JSON.parse(JSON.stringify(prevState.map));
    playerInventory = JSON.parse(JSON.stringify(prevState.inv));

    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = document.querySelector(`.grid-cell[data-row='${r}'][data-col='${c}']`);
            updateCellVisual(cell, mapData[r][c]);
        }
    }
    if (!isEditorMode) renderInventoryUI();
    refreshLaser();
    showNotification("실행 취소 완료 (Ctrl+Z)", "#2980b9");
}

// ═══════════════ 인벤토리 UI ═══════════════

export function renderInventoryUI() {
    const grid = document.getElementById('inventoryGrid');
    grid.innerHTML = '';
    let hasItems = false;

    for (let key in playerInventory) {
        let data = playerInventory[key];
        if (data.count > 0) {
            hasItems = true;
            let div = document.createElement('div');
            div.className = 'tool-item';
            if (selectedTool && selectedTool.invKey === key) div.classList.add('selected');

            let badges = '';
            if (!data.canRotate) badges += '<span class="badge-lock">🔒</span>';

            div.innerHTML = `
                <div style="width: 80%; height: 80%; display: flex; justify-content: center; align-items: center; pointer-events: none; transform: rotate(${data.rotation}deg);">
                    ${SVG_ART[data.type] || ''}
                </div>
                <div class="modifier-icons" style="top:2px; right:2px;">${badges}</div>
                <div class="inv-count">x${data.count}</div>
            `;

            div.addEventListener('mousedown', function (e) {
                if (e.button !== 0) return;
                let wasSelected = this.classList.contains('selected');
                if (!wasSelected) {
                    deselectAllTools();
                    this.classList.add('selected');
                    selectedTool = { type: data.type, isInvTool: true, invKey: key, canRotate: data.canRotate, rotation: data.rotation };
                }
                dragSource = { origin: 'inventory', type: data.type, invKey: key, canRotate: data.canRotate, rotation: data.rotation, wasSelected: wasSelected };
            });
            grid.appendChild(div);
        }
        else {
            if (selectedTool && selectedTool.invKey === key) {
                deselectAllTools();
                lastActiveTool = null;
            }
        }
    }
    if (!hasItems) {
        grid.innerHTML = `<p style="grid-column: span 3; text-align: center; color: #999; margin: 10px 0;">지급된 기물이 없습니다.</p>`;
        deselectAllTools();
    }
}

// ═══════════════ 에디터/테스트 모드 전환 ═══════════════

export function toggleMode() {
    isEditorMode = !isEditorMode;
    const btn = document.getElementById('modeToggleBtn');
    const body = document.body;
    undoStack = [];

    if (isEditorMode) {
        btn.innerHTML = "🛠️ 현재: 에디터 모드";
        btn.classList.remove('test-mode');
        body.classList.remove('is-test-mode');

        document.getElementById('editorPaletteGroup').style.display = 'block';
        document.getElementById('testModeInventory').style.display = 'none';

        if (editorMapDataBackup) {
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    if (mapData[r][c] && !mapData[r][c].isInventory && editorMapDataBackup[r][c]) {
                        editorMapDataBackup[r][c].rotation = mapData[r][c].rotation;
                    }
                }
            }
            mapData = JSON.parse(JSON.stringify(editorMapDataBackup));
        }
    } else {
        btn.innerHTML = "🎮 현재: 테스트 모드";
        btn.classList.add('test-mode');
        body.classList.add('is-test-mode');

        document.getElementById('editorPaletteGroup').style.display = 'none';
        document.getElementById('testModeInventory').style.display = 'block';

        editorMapDataBackup = JSON.parse(JSON.stringify(mapData));
        playerInventory = {};

        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                let cellData = mapData[r][c];
                if (cellData && cellData.isInventory) {
                    refundToInventory(cellData);
                    mapData[r][c] = null;
                }
            }
        }
        renderInventoryUI();
    }

    deselectAllTools();
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = document.querySelector(`.grid-cell[data-row='${r}'][data-col='${c}']`);
            updateCellVisual(cell, mapData[r][c]);
        }
    }
    refreshLaser();
}

// ═══════════════ 클리어 / 익스포트 / 임포트 ═══════════════

export function clearGrid() {
    const msg = isEditorMode ? "맵의 모든 기물을 삭제하시겠습니까?" : "배치한 모든 기물을 인벤토리로 회수하시겠습니까?";
    if (confirm(msg)) {
        saveStateDirectly();
        if (isEditorMode) {
            mapData = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(null));
            document.querySelectorAll('.grid-cell').forEach(cell => updateCellVisual(cell, null));
            showNotification("맵이 전체 초기화되었습니다.");
            document.getElementById('loadedMapInfo').style.display = 'none';
            document.getElementById('suggestionBoardContainer').style.display = 'none';
            // currentLoadedMapId 등은 libraryController에서 관리 → window 참조로 처리 (main.js에서 연결)
            if (typeof window._setCurrentMapNull === 'function') window._setCurrentMapNull();
        } else {
            let recovered = false;
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    let item = mapData[r][c];
                    if (item && item.isInventory) {
                        refundToInventory(item);
                        mapData[r][c] = null;
                        const cell = document.querySelector(`.grid-cell[data-row='${r}'][data-col='${c}']`);
                        updateCellVisual(cell, null);
                        recovered = true;
                    }
                }
            }
            if (recovered) {
                renderInventoryUI();
                showNotification("배치한 기물을 모두 회수했습니다.");
            } else {
                showNotification("회수할 기물이 없습니다.", "#e74c3c");
            }
        }
        refreshLaser();
    }
}

export function exportData() {
    const exportArray = [];
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (mapData[r][c]) {
                exportArray.push({
                    x: c, y: r, type: mapData[r][c].type,
                    rotation: mapData[r][c].canRotate ? 0 : mapData[r][c].rotation,
                    canMove: mapData[r][c].canMove, canRotate: mapData[r][c].canRotate,
                    isInventory: mapData[r][c].isInventory || false
                });
            }
        }
    }
    document.getElementById('output').value = JSON.stringify(exportArray, null, 2);
}

export function applyMapData(importedArray) {
    saveStateDirectly();
    mapData = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(null));
    playerInventory = {};

    importedArray.forEach(item => {
        if (item.y >= 0 && item.y < GRID_SIZE && item.x >= 0 && item.x < GRID_SIZE) {
            mapData[item.y][item.x] = {
                type: item.type,
                rotation: item.rotation || 0,
                canMove: item.canMove !== undefined ? item.canMove : false,
                canRotate: item.canRotate !== undefined ? item.canRotate : false,
                isInventory: item.isInventory || false
            };
        }
    });

    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = document.querySelector(`.grid-cell[data-row='${r}'][data-col='${c}']`);
            updateCellVisual(cell, mapData[r][c]);
        }
    }
    refreshLaser();
}

export function importData() {
    const jsonString = document.getElementById('output').value;
    if (!jsonString.trim()) { alert("불러올 JSON 데이터를 입력해주세요."); return; }
    try {
        const parsedData = JSON.parse(jsonString);
        if (!isEditorMode) toggleMode();

        const mapArray = Array.isArray(parsedData) ? parsedData : parsedData.mapData;
        if (!mapArray) throw new Error("맵 데이터(배열)를 찾을 수 없습니다.");

        applyMapData(mapArray);

        if (!Array.isArray(parsedData) && parsedData.title) {
            document.getElementById('loadedMapInfo').style.display = 'flex';
            document.getElementById('infoTitle').innerText = `🗺️ ${parsedData.title}`;
            document.getElementById('infoAuthor').innerText = parsedData.author || '알 수 없음';
            const diffSpan = document.getElementById('infoDifficulty');
            const diff = parsedData.difficulty || 'Normal';
            diffSpan.innerText = diff; diffSpan.className = `difficulty-badge diff-${diff}`;

            document.getElementById('suggestionBoardContainer').style.display = 'none';
            if (typeof window._setCurrentMapNull === 'function') window._setCurrentMapNull();
        } else {
            document.getElementById('loadedMapInfo').style.display = 'none';
            document.getElementById('suggestionBoardContainer').style.display = 'none';
            if (typeof window._setCurrentMapNull === 'function') window._setCurrentMapNull();
        }
        showNotification("맵을 성공적으로 불러왔습니다!");
    } catch (error) {
        alert("올바르지 않은 JSON 형식입니다.\n에러: " + error.message);
    }
}

// ═══════════════ 그리드 & 드래그 이벤트 시스템 ═══════════════

export function initGridInteractions() {
    const gridElement = document.getElementById('grid');

    // --- 그리드 셀 생성 ---
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.addEventListener('dragstart', (e) => e.preventDefault());

            // 우클릭: 기물 제거
            cell.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (dragSource) {
                    if (dragGhost) { dragGhost.remove(); dragGhost = null; }
                    dragSource = null;
                    if (lastActiveTool) { restoreTool(lastActiveTool); lastActiveTool = null; }
                    return;
                }
                if (mapData[r][c]) {
                    saveStateDirectly();
                    if (isEditorMode) {
                        mapData[r][c] = null;
                        updateCellVisual(cell, null);
                        refreshLaser();
                    } else if (mapData[r][c].isInventory) {
                        refundToInventory(mapData[r][c]);
                        renderInventoryUI();
                        mapData[r][c] = null;
                        updateCellVisual(cell, null);
                        refreshLaser();
                    }
                }
            });

            // 마우스 다운: 드래그 시작 또는 즉시 배치
            cell.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;

                if (mapData[r][c]) {
                    if (!isEditorMode && !mapData[r][c].canMove && !mapData[r][c].canRotate) return;

                    if (selectedTool) {
                        lastActiveTool = JSON.parse(JSON.stringify(selectedTool));
                        deselectAllTools();
                    }
                    dragSource = { origin: 'grid', r: r, c: c };
                }
                else if (selectedTool) {
                    if (!isEditorMode) {
                        if (selectedTool.isInvTool && playerInventory[selectedTool.invKey] && playerInventory[selectedTool.invKey].count > 0) {
                            mapData[r][c] = {
                                type: selectedTool.type, rotation: selectedTool.rotation,
                                canMove: true, canRotate: selectedTool.canRotate, isInventory: true
                            };
                            playerInventory[selectedTool.invKey].count--;
                            renderInventoryUI();
                            updateCellVisual(cell, mapData[r][c]);
                            refreshLaser();
                            dragSource = { origin: 'grid', r: r, c: c, justPlaced: true };
                            hasPlacedSinceSelection = true;
                        }
                    } else {
                        mapData[r][c] = {
                            type: selectedTool.type, rotation: 0,
                            isInventory: isModInvActive, canMove: isModInvActive,
                            canRotate: isModInvActive ? !isModLockActive : isModRotatableActive
                        };
                        updateCellVisual(cell, mapData[r][c]);
                        refreshLaser();
                        dragSource = { origin: 'grid', r: r, c: c, justPlaced: true };
                        hasPlacedSinceSelection = true;
                    }
                }
            });

            gridElement.appendChild(cell);
        }
    }

    // --- 전역 드래그 이벤트 ---
    document.addEventListener('contextmenu', (e) => {
        if (dragSource) {
            e.preventDefault();
            if (dragGhost) { dragGhost.remove(); dragGhost = null; }
            dragSource = null;
            if (lastActiveTool) { restoreTool(lastActiveTool); lastActiveTool = null; }
        }
    });

    document.addEventListener('mouseleave', () => {
        if (dragSource) {
            if (dragGhost) { dragGhost.remove(); dragGhost = null; }
            dragSource = null;
            if (lastActiveTool) { restoreTool(lastActiveTool); lastActiveTool = null; }
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (dragSource) {
            if (dragSource.origin === 'grid' && !isEditorMode) {
                let cellData = mapData[dragSource.r][dragSource.c];
                if (cellData && !cellData.canMove) return;
            }
            if (!dragGhost) {
                dragGhost = document.createElement('div');
                dragGhost.className = 'drag-ghost';
                let type, rot;
                if (dragSource.origin === 'grid') {
                    let cellData = mapData[dragSource.r][dragSource.c];
                    if (cellData) { type = cellData.type; rot = cellData.rotation || 0; }
                } else if (dragSource.origin === 'inventory') {
                    type = dragSource.type; rot = dragSource.rotation || 0;
                } else {
                    type = dragSource.type; rot = 0;
                }
                if (type && SVG_ART[type]) {
                    dragGhost.innerHTML = `<div style="transform: rotate(${rot}deg); width: 100%; height: 100%;">${SVG_ART[type]}</div>`;
                    document.body.appendChild(dragGhost);
                }
            }
            if (dragGhost) {
                dragGhost.style.left = e.clientX - (dragGhost.offsetWidth / 2) + 'px';
                dragGhost.style.top = e.clientY - (dragGhost.offsetHeight / 2) + 'px';
            }
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (e.button !== 0) return;

        let stateBeforeStr = JSON.stringify({ m: mapData, i: playerInventory });
        let stateBeforeObj = {
            map: JSON.parse(JSON.stringify(mapData)),
            inv: JSON.parse(JSON.stringify(playerInventory))
        };

        if (dragSource) {
            let dropTarget = document.elementFromPoint(e.clientX, e.clientY);
            let dropCell = dropTarget ? dropTarget.closest('.grid-cell') : null;
            let isToolItem = dropTarget ? dropTarget.closest('.tool-item') : null;

            if (dropCell) {
                let r = parseInt(dropCell.dataset.row);
                let c = parseInt(dropCell.dataset.col);

                if (dragSource.origin === 'grid') {
                    if (dragSource.r === r && dragSource.c === c) {
                        // 같은 셀에 드롭
                        if (!dragSource.justPlaced) {
                            if (mapData[r][c]) {
                                if (lastActiveTool) {
                                    if (lastActiveTool.type === mapData[r][c].type) {
                                        if (isEditorMode || mapData[r][c].canRotate) {
                                            executeRotation(r, c);
                                            updateCellVisual(dropCell, mapData[r][c]);
                                            refreshLaser();
                                        }
                                    }
                                    else {
                                        if (isEditorMode) {
                                            mapData[r][c] = {
                                                type: lastActiveTool.type, rotation: 0,
                                                isInventory: isModInvActive, canMove: isModInvActive,
                                                canRotate: isModInvActive ? !isModLockActive : isModRotatableActive
                                            };
                                            updateCellVisual(dropCell, mapData[r][c]);
                                            refreshLaser();
                                        } else {
                                            if (mapData[r][c].isInventory && lastActiveTool.isInvTool &&
                                                playerInventory[lastActiveTool.invKey] && playerInventory[lastActiveTool.invKey].count > 0) {
                                                refundToInventory(mapData[r][c]);
                                                mapData[r][c] = {
                                                    type: lastActiveTool.type, rotation: lastActiveTool.rotation,
                                                    canMove: true, canRotate: lastActiveTool.canRotate, isInventory: true
                                                };
                                                playerInventory[lastActiveTool.invKey].count--;
                                                renderInventoryUI();
                                                updateCellVisual(dropCell, mapData[r][c]);
                                                refreshLaser();
                                            }
                                        }
                                    }
                                }
                                else {
                                    if (isEditorMode && (isModRotatableActive || isModLockActive || isModInvActive)) {
                                        let data = mapData[r][c];
                                        let toggledOff = false;
                                        if (isModInvActive && !isModLockActive) {
                                            if (data.isInventory && data.canRotate) toggledOff = true;
                                            else { data.isInventory = true; data.canMove = true; data.canRotate = true; }
                                        } else if (isModLockActive) {
                                            if (data.isInventory && !data.canRotate) toggledOff = true;
                                            else { data.isInventory = true; data.canMove = true; data.canRotate = false; }
                                        } else if (isModRotatableActive) {
                                            if (!data.isInventory && data.canRotate) toggledOff = true;
                                            else { data.isInventory = false; data.canMove = false; data.canRotate = true; }
                                        }
                                        if (toggledOff) { data.isInventory = false; data.canMove = false; data.canRotate = false; }
                                        updateCellVisual(dropCell, data);
                                    } else {
                                        if (isEditorMode || mapData[r][c].canRotate) {
                                            executeRotation(r, c);
                                            updateCellVisual(dropCell, mapData[r][c]);
                                            refreshLaser();
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        // 다른 셀로 이동 (스왑)
                        let sourceItem = mapData[dragSource.r][dragSource.c];
                        if (!isEditorMode && sourceItem && !sourceItem.canMove) {
                            // 이동 불가
                        } else if (!isEditorMode && mapData[r][c] && !mapData[r][c].canMove) {
                            // 대상 이동 불가
                        } else {
                            let temp = mapData[r][c];
                            mapData[r][c] = mapData[dragSource.r][dragSource.c];
                            mapData[dragSource.r][dragSource.c] = temp;
                            const sourceCell = document.querySelector(`.grid-cell[data-row='${dragSource.r}'][data-col='${dragSource.c}']`);
                            updateCellVisual(sourceCell, mapData[dragSource.r][dragSource.c]);
                            updateCellVisual(dropCell, mapData[r][c]);
                            refreshLaser();
                        }
                    }
                } else if (dragSource.origin === 'palette' && isEditorMode) {
                    mapData[r][c] = {
                        type: dragSource.type, rotation: 0,
                        isInventory: isModInvActive, canMove: isModInvActive,
                        canRotate: isModInvActive ? !isModLockActive : isModRotatableActive
                    };
                    updateCellVisual(dropCell, mapData[r][c]);
                    refreshLaser();
                    hasPlacedSinceSelection = true;
                } else if (dragSource.origin === 'inventory' && !isEditorMode) {
                    if (!mapData[r][c] || mapData[r][c].canMove) {
                        if (mapData[r][c] && mapData[r][c].isInventory) refundToInventory(mapData[r][c]);
                        mapData[r][c] = {
                            type: dragSource.type, rotation: dragSource.rotation,
                            canMove: true, canRotate: dragSource.canRotate, isInventory: true
                        };
                        playerInventory[dragSource.invKey].count--;
                        renderInventoryUI();
                        updateCellVisual(dropCell, mapData[r][c]);
                        refreshLaser();
                        hasPlacedSinceSelection = true;
                    }
                }
            } else {
                // 그리드 밖에 드롭
                if (isToolItem && (dragSource.origin === 'palette' || dragSource.origin === 'inventory')) {
                    if (dragSource.wasSelected) deselectAllTools();
                } else if (dragSource.origin === 'grid') {
                    let r = dragSource.r, c = dragSource.c, sourceItem = mapData[r][c];
                    if (isEditorMode) {
                        mapData[r][c] = null;
                        const sourceCell = document.querySelector(`.grid-cell[data-row='${r}'][data-col='${c}']`);
                        updateCellVisual(sourceCell, null);
                        refreshLaser();
                    } else if (sourceItem && sourceItem.isInventory) {
                        refundToInventory(sourceItem);
                        renderInventoryUI();
                        mapData[r][c] = null;
                        const sourceCell = document.querySelector(`.grid-cell[data-row='${r}'][data-col='${c}']`);
                        updateCellVisual(sourceCell, null);
                        refreshLaser();
                    }
                }
            }

            if (lastActiveTool) {
                if (!lastActiveTool.isInvTool || (playerInventory[lastActiveTool.invKey] && playerInventory[lastActiveTool.invKey].count > 0)) {
                    restoreTool(lastActiveTool);
                }
                lastActiveTool = null;
            }
        }

        if (dragGhost) { dragGhost.remove(); dragGhost = null; }
        dragSource = null;

        let stateAfterStr = JSON.stringify({ m: mapData, i: playerInventory });
        if (stateBeforeStr !== stateAfterStr) {
            undoStack.push(stateBeforeObj);
            if (undoStack.length > 50) undoStack.shift();
        }
    });

    // --- 터치 이벤트 (더블탭 방지) ---
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function (event) {
        if (event.target.tagName === 'TEXTAREA' || event.target.tagName === 'INPUT') return;
        let now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) { event.preventDefault(); }
        lastTouchEnd = now;
    }, { passive: false });

    // --- 키보드 단축키 (Ctrl+Z) ---
    document.addEventListener('keydown', function (e) {
        if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') return;
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            undo();
        }
    });

    // --- 팔레트 탭 전환 ---
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tool-group').forEach(g => g.style.display = 'none');
            this.classList.add('active');
            document.getElementById('group-' + this.dataset.target).style.display = 'grid';
        });
    });

    // --- 팔레트 기물 선택 ---
    document.querySelectorAll('.tool-item:not(.mod-tool)').forEach(item => {
        item.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            if (this.closest('#testModeInventory')) return;

            let wasSelected = this.classList.contains('selected');
            if (!wasSelected) {
                deselectAllTools();
                document.querySelectorAll('.mod-tool').forEach(mod => mod.classList.remove('selected'));
                isModRotatableActive = false;
                isModLockActive = false;
                isModInvActive = false;
                this.classList.add('selected');
                selectedTool = { type: this.dataset.tool };
                hasPlacedSinceSelection = false;
            }
            if (isEditorMode) {
                dragSource = { origin: 'palette', type: selectedTool.type, wasSelected: wasSelected };
            }
        });
    });

    // --- 수정자(modifier) 도구 ---
    document.querySelectorAll('.mod-tool').forEach(item => {
        item.addEventListener('click', function () {
            let modType = this.dataset.mod;
            let isSelected = !this.classList.contains('selected');
            if (modType === 'rotatable') {
                isModRotatableActive = isSelected;
                if (isSelected) {
                    isModInvActive = false;
                    isModLockActive = false;
                    document.querySelector('[data-mod="inv"]').classList.remove('selected');
                    document.querySelector('[data-mod="lock"]').classList.remove('selected');
                }
            } else if (modType === 'inv' || modType === 'lock') {
                if (modType === 'inv') isModInvActive = isSelected;
                if (modType === 'lock') isModLockActive = isSelected;
                if (isSelected) {
                    isModRotatableActive = false;
                    document.querySelector('[data-mod="rotatable"]').classList.remove('selected');
                }
            }
            this.classList.toggle('selected', isSelected);
            if (selectedTool !== null && hasPlacedSinceSelection) {
                deselectAllTools();
            }
        });
    });
}
