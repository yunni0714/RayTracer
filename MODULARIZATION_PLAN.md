# Project Ray - ES6 Module 리팩토링 계획 (v2: Pure Module)

## 변경사항 요약

**v1 → v2 차이점**: `onclick` 속성을 HTML에서 전부 제거하고, 각 모듈이 `addEventListener`로 이벤트를 연결. `window.*` 브릿지 패턴 폐기, 순수 `import`/`export` 통신.

---

## 최종 파일 구조 (7개)

```
RayTracer/
├── index.html              ← CSS + HTML만 (onclick 없음)
├── main.js                 ← 진입점: import & 이벤트리스너 연결
├── firebaseApp.js          ← Firebase 초기화 + DB 함수
├── dragAndDrop.js          ← 게임 핵심 상호작용
├── laserEngine.js          ← 레이저 물리 엔진
├── libraryController.js    ← 도서관 & 커뮤니티
└── uiController.js         ← 단순 UI 제어
```

---

## HTML onclick → addEventListener 마이그레이션 매핑

총 **18개** 인라인 핸들러를 제거하고 `main.js`에서 `addEventListener`로 연결:

| # | HTML id / selector | 기존 onclick | 연결될 모듈 함수 |
|---|--------------------|-------------|-----------------|
| 1 | `#newMapBtn` | `createNewMap()` | `libraryController.createNewMap` |
| 2 | `#libraryToggleBtn` | `toggleLibraryScreen()` | `libraryController.toggleLibraryScreen` |
| 3 | `#modeToggleBtn` | `toggleMode()` | `dragAndDrop.toggleMode` |
| 4 | `#searchInput` | `oninput="applyFilters()"` | `libraryController.applyFilters` |
| 5 | `#sortSelect` | `onchange="loadLibraryMaps()"` | `libraryController.loadLibraryMaps` |
| 6 | `#btnReactOk` | `toggleReaction('ok')` | `() => libraryController.toggleReaction('ok')` |
| 7 | `#btnReactGod` | `toggleReaction('god')` | `() => libraryController.toggleReaction('god')` |
| 8 | `#btnVoteEasy` | `voteDifficulty('Easy')` | `() => libraryController.voteDifficulty('Easy')` |
| 9 | `#btnVoteNormal` | `voteDifficulty('Normal')` | `() => libraryController.voteDifficulty('Normal')` |
| 10 | `#btnVoteHard` | `voteDifficulty('Hard')` | `() => libraryController.voteDifficulty('Hard')` |
| 11 | `#btnVoteInsane` | `voteDifficulty('Insane')` | `() => libraryController.voteDifficulty('Insane')` |
| 12 | `#sugHeaderBtn` | `handleSugHeaderBtnAction()` | `libraryController.handleSugHeaderBtnAction` |
| 13 | `#deleteMapBtn` | `deleteCurrentMap()` | `libraryController.deleteCurrentMap` |
| 14 | `#laserToggleBtn` | `toggleLaser()` | `laserEngine.toggleLaser` |
| 15 | `.actions > button:nth-child(1)` | `clearGrid()` | `dragAndDrop.clearGrid` |
| 16 | `.actions > button:nth-child(2)` | `importData()` | `dragAndDrop.importData` |
| 17 | `.actions > button:nth-child(3)` | `exportData()` | `dragAndDrop.exportData` |
| 18 | `.actions > button.upload-btn` | `document.getElementById('uploadModal').style.display='flex'` | `uiController.openUploadModal` |
| 19 | `#uploadModal button:nth-child(1)` | `closeUploadModal()` | `uiController.closeUploadModal` |
| 20 | `#uploadSubmitBtn` | `packAndUploadMap()` | `uiController.packAndUploadMap` |
| 21 | `#suggestionModal button:nth-child(1)` | `closeSuggestionModal()` | `libraryController.closeSuggestionModal` |
| 22 | `#sugSubmitBtn` | `submitSuggestion()` | `libraryController.submitSuggestion` |

---

## 모듈별 상세 export/import 명세

### `firebaseApp.js`
**imports**: Firebase CDN (firebase-app, firebase-firestore, firebase-auth)
**exports**:

```
export let db, auth;
export function initFirebase()           // 앱 초기화 + onAuthStateChanged 설정
export async function uploadToDB(data)
export async function fetchFromDB(id)
export async function fetchLibraryList(sortBy)
export async function updateMapReactionsInDB(id, type, change)
export async function updateMapDifficultyVoteInDB(id, oldVote, newVote)
export async function updateMapInDB(id, data)
export async function deleteMapFromDB(id)
export async function uploadSuggestionToDB(mapId, data)
export async function fetchSuggestionsFromDB(mapId)
export async function deleteSuggestionFromDB(mapId, sugId)
```

### `laserEngine.js`
**imports**: `{ GRID_SIZE, CELL_SIZE, mapData, SVG_ART }` from `dragAndDrop`
**exports**:

```
export let isLaserOn;
export function resizeCanvas()
export function calculateReflection(inDir, surfaceAngle)
export function simulateLaser()
export function drawLine(x1,y1,x2,y2,stopAtEdge)
export function clearLaser()
export function toggleLaser()
export function refreshLaser()
```

### `dragAndDrop.js`
**imports**: `{ refreshLaser, clearLaser }` from `laserEngine`, `{ showNotification }` from `uiController`
**exports**:

```
export const SVG_ART, GRID_SIZE, CELL_SIZE;
export let mapData, playerInventory, selectedTool, lastActiveTool;
export let isEditorMode, editorMapDataBackup, undoStack;
export function deselectAllTools()
export function restoreTool(toolData)
export function executeRotation(r, c)
export function updateCellVisual(cell, data)
export function saveStateDirectly()
export function undo()
export function refundToInventory(data)
export function clearGrid()
export function exportData()
export function importData()
export function applyMapData(arr)
export function renderInventoryUI()
export function toggleMode()
export function getRotationStep(type)
export function isAdvancedMap()
export function initGridInteractions()
```

### `libraryController.js`
**imports**: Firebase functions from `firebaseApp`, drag & drop functions from `dragAndDrop`, `{ refreshLaser }` from `laserEngine`, `{ showNotification }` from `uiController`
**exports**:

```
export let allLibraryMaps, isLibraryMode;
export let currentLoadedMapId, currentLoadedMapAuthorUid, currentLoadedMapObj;
export let currentMapReactions;
export function toggleLibraryScreen()
export function loadLibraryMaps()
export function applyFilters()
export function renderLibraryCards(list)
export function createMiniGridDOM(mapDataArr, hideInv)
export function calculateUserDifficulty(diffVotes)
export function playMapFromLibrary(mapObj)
export function toggleReaction(type)
export function voteDifficulty(level)
export function updateReactionUI(mapId)
export function updateSugHeaderBtnUI()
export function handleSugHeaderBtnAction()
export function openSuggestionModal()
export function closeSuggestionModal()
export function submitSuggestion()
export function loadSuggestionsForCurrentMap()
export function deleteCurrentMap()
export function createNewMap()
```

### `uiController.js`
**imports**: Firebase + `dragAndDrop` + `libraryController` 함수들
**exports**:

```
export let currentUserUid;
export function showNotification(msg, color)
export function openUploadModal()
export function closeUploadModal()
export function packAndUploadMap()
export function initPasswordEasterEgg()
export function initUrlParamLoader()
export function initTabSwitching()
export function initModifierTools()
```

### `main.js` (진입점)
```js
import { initFirebase } from './firebaseApp.js';
import { resizeCanvas } from './laserEngine.js';
import { initGridInteractions } from './dragAndDrop.js';
import { initPasswordEasterEgg, initUrlParamLoader, initTabSwitching, initModifierTools } from './uiController.js';
// ... 모든 addEventListener 연결 22개
```

---

## HTML 변경사항 (index.html)

1. **L300**: `onclick="createNewMap()"` → 제거
2. **L301**: `onclick="toggleLibraryScreen()"` → 제거
3. **L302**: `onclick="toggleMode()"` → 제거
4. **L309**: `oninput="applyFilters()"` → 제거
5. **L310**: `onchange="loadLibraryMaps()"` → 제거
6. **L334**: `onclick="toggleReaction('ok')"` → 제거
7. **L335**: `onclick="toggleReaction('god')"` → 제거
8. **L339-342**: 4개 `voteDifficulty()` onclick → 제거
9. **L353**: `onclick="handleSugHeaderBtnAction()"` → 제거
10. **L354**: `onclick="deleteCurrentMap()"` → 제거
11. **L374**: `onclick="toggleLaser()"` → 제거
12. **L434**: `onclick="clearGrid()"` → 제거
13. **L435**: `onclick="importData()"` → 제거
14. **L436**: `onclick="exportData()"` → 제거
15. **L437**: `onclick="document.getElementById('uploadModal').style.display='flex'"` → 제거
16. **L462**: `onclick="closeUploadModal()"` → 제거
17. **L463**: `onclick="packAndUploadMap()"` → 제거
18. **L481**: `onclick="closeSuggestionModal()"` → 제거
19. **L482**: `onclick="submitSuggestion()"` → 제거
20. **L487-592**: `<script type="module">` Firebase 블록 제거
21. **L594-2177**: `<script>` 게임 로직 블록 제거
22. `</body>` 직전에 `<script type="module" src="main.js"></script>` 추가

---

## 의존성 그래프 (순환 참조 해결)

```
main.js ──→ firebaseApp.js      (독립)
        ──→ laserEngine.js      ←── dragAndDrop.js (mapData만 import)
        ──→ dragAndDrop.js      ←──→ laserEngine.js (refreshLaser import)
        ──→ uiController.js     ←──→ dragAndDrop.js + libraryController.js
        ──→ libraryController.js ←── firebaseApp + dragAndDrop + laserEngine + uiController
```

**순환 참조 해결 전략**:
- `laserEngine.js` → `dragAndDrop.js` (mapData, SVG_ART, GRID_SIZE, CELL_SIZE)
- `dragAndDrop.js` → `laserEngine.js` (refreshLaser, clearLaser)
- 이 둘은 상호 참조이지만, `laserEngine`의 import는 값(상수/변수 참조)만, `dragAndDrop`의 import는 함수만 사용 → 실제 호출 시점에 이미 양쪽 모두 초기화 완료됨 (ES 모듈 live binding)
- `uiController.js` ↔ `libraryController.js` 사이의 상호 참조는 `main.js`에서 중재: 필요한 콜백을 파라미터로 전달

---

## 구현 순서

| 순서 | 파일 | 설명 |
|------|------|------|
| 1 | `firebaseApp.js` | 가장 독립적, 다른 모듈 의존성 없음 |
| 2 | `laserEngine.js` | dragAndDrop에서 mapData 등만 import |
| 3 | `dragAndDrop.js` | laserEngine에서 refreshLaser import |
| 4 | `uiController.js` | dragAndDrop + firebaseApp 의존 |
| 5 | `libraryController.js` | 모든 모듈 의존 (가장 상위) |
| 6 | `main.js` | 진입점, 모든 이벤트 연결 |
| 7 | `index.html` | script 블록 제거, main.js 참조 추가 |
