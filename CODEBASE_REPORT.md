# Project Ray 레벨 에디터 — 코드베이스 상세 분석 보고서

---

## 1. 프로젝트 개요

**Project Ray 레벨 에디터**는 5×5 격자판 위에 레이저 반사 퍼즐 맵을 제작하고 공유하는 웹 애플리케이션이다.
사용자는 거울, 블록, 터널 등의 기물을 배치해 레이저 광선이 표적에 도달하도록 맵을 설계하고, 완성된 맵을 Firebase에 업로드해 다른 유저와 공유할 수 있다.

| 항목 | 내용 |
|------|------|
| 언어 | 순수 ES6 JavaScript (프레임워크 없음) |
| 렌더링 | SVG 인라인 아트 + HTML5 Canvas (레이저) |
| 백엔드 | Firebase Firestore + Anonymous Auth |
| 모듈 시스템 | ES6 Modules (`import`/`export`) |
| 격자 크기 | 5×5 (GRID_SIZE=5, CELL_SIZE=100px) |

---

## 2. 파일 구조 및 역할

```
RayTracer/
├── index.html              ← CSS 인라인 포함, HTML 구조 전용 (onclick 없음)
├── main.js                 ← 진입점: 모든 모듈 import + addEventListener 연결 22개
├── firebaseApp.js          ← Firebase 초기화 + 모든 DB 통신 함수
├── laserEngine.js          ← 레이저 물리 시뮬레이션 + Canvas 그리기
├── dragAndDrop.js          ← 게임 핵심 상호작용 (드래그, 회전, Undo, 셀 시각화)
├── libraryController.js    ← 라이브러리 화면, 평가/투표, 제안 게시판
├── uiController.js         ← 모달, 알림, 업로드, 이스터에그
├── style.css               ← (빈 파일, 실제 CSS는 index.html에 인라인)
└── MODULARIZATION_PLAN.md  ← 모듈화 리팩토링 계획 문서
```

---

## 3. 모듈 의존성 그래프

```
main.js
  ├─→ firebaseApp.js        (독립, 외부 Firebase CDN만 import)
  ├─→ laserEngine.js   ←──── dragAndDrop.js (mapData, GRID_SIZE, CELL_SIZE)
  ├─→ dragAndDrop.js   ──→   laserEngine.js (refreshLaser, clearLaser)
  ├─→ libraryController.js  ←── firebaseApp + dragAndDrop + laserEngine
  └─→ uiController.js  ←──── firebaseApp + dragAndDrop + libraryController
```

### 순환 참조 해결 방식
`laserEngine` ↔ `dragAndDrop` 사이에 상호 import가 존재하지만, ES 모듈 **live binding** 특성으로 실제 호출 시점에 양쪽 모두 초기화가 완료되어 문제 없다.

`libraryController` → `uiController` 방향 참조는 `window` 브릿지로 우회:
```js
// main.js
window._openUploadForEdit = openUploadForEdit;   // uiController → libraryController
window._setCurrentMapNull = resetCurrentMap;     // dragAndDrop → libraryController
```

---

## 4. 각 모듈 상세 분석

### 4-1. `firebaseApp.js` — Firebase 통신 계층

Firebase SDK 10.11.1을 CDN에서 import. **익명 로그인** 기반으로 유저 식별자를 관리한다.
로그인 실패 시 `localStorage`에 임시 UID(`anon_xxxxxxx`)를 폴백으로 저장해 오프라인 상황도 대응한다.

**export 목록:**

| 함수/변수 | 설명 |
|-----------|------|
| `db`, `auth` | Firestore, Auth 인스턴스 |
| `currentUserUid` | 현재 로그인 UID (전역 공유) |
| `initFirebase()` | Auth 초기화 + `onAuthStateChanged` 설정 |
| `onAuthReady(cb)` | Auth 완료 후 실행할 콜백 등록 |
| `uploadToDB(data)` | `maps` 컬렉션에 새 맵 문서 추가 |
| `fetchFromDB(id)` | 특정 맵 문서 조회 |
| `fetchLibraryList(sortBy)` | 최신 50개 맵 목록 조회 (`createdAt` 또는 `reactionGod` 기준 정렬) |
| `updateMapReactionsInDB(id, type, change)` | 반응 수 원자적 증감 (`increment`) |
| `updateMapDifficultyVoteInDB(id, oldVote, newVote)` | 체감 난이도 투표 (이전 투표 -1, 신규 투표 +1) |
| `updateMapInDB(id, data)` | 맵 메타데이터/데이터 수정 |
| `deleteMapFromDB(id)` | 맵 삭제 |
| `uploadSuggestionToDB(mapId, data)` | `maps/{id}/suggestions` 서브컬렉션에 제안 추가 |
| `fetchSuggestionsFromDB(mapId)` | 해당 맵의 모든 제안 조회 (최신순) |
| `deleteSuggestionFromDB(mapId, sugId)` | 제안 삭제 |

---

### 4-2. `dragAndDrop.js` — 게임 핵심 엔진

그리드 셀 생성, 기물 배치/이동/삭제, 드래그&드롭, 회전, Undo, 에디터↔테스트 모드 전환을 담당한다.

#### 4-2-1. 전역 상태

```js
mapData         // 5×5 배열, 각 셀에 { type, rotation, canMove, canRotate, isInventory } 또는 null
playerInventory // 테스트 모드에서 플레이어가 보유한 기물 { [key]: { count, type, canRotate, rotation } }
isEditorMode    // true=에디터, false=테스트
selectedTool    // 현재 선택된 팔레트 기물
lastActiveTool  // 드래그 시작 전 자동 저장되는 이전 선택 도구
undoStack       // 최대 50개 상태 스냅샷 배열
editorMapDataBackup // 테스트 모드 진입 시 에디터 상태 백업
```

#### 4-2-2. 기물 특성 (modifier)

에디터 모드에서 기물을 배치할 때 세 가지 특성을 적용할 수 있다:

| 특성 | 플래그 | 의미 |
|------|--------|------|
| 🔄 회전 가능 | `canRotate=true, isInventory=false` | 고정 배치이지만 회전 가능 |
| 🔒 회전 불가 | `canRotate=false, isInventory=false` | 완전히 고정 |
| 🎒 유저 지급 | `isInventory=true, canMove=true` | 테스트 모드에서 인벤토리로 전환 |

#### 4-2-3. 드래그&드롭 로직

드래그 소스 유형 세 가지:

| origin | 설명 |
|--------|------|
| `'palette'` | 팔레트에서 격자로 새 기물 드래그 |
| `'grid'` | 격자 내 기물 이동 (스왑) |
| `'inventory'` | 테스트 모드 인벤토리에서 격자로 배치 |

같은 셀에 드롭 시 동작:
- 기물을 든 상태 + 같은 타입 → **회전**
- 기물을 든 상태 + 다른 타입 → **덮어쓰기**
- 빈손 상태 + 수정자 활성화 → **특성 토글**
- 빈손 상태 + 아무 수정자 없음 → **회전**

그리드 밖에 드롭 시:
- 에디터 모드: 기물 삭제
- 테스트 모드: 인벤토리 기물이면 회수, 고정 기물은 무시

#### 4-2-4. 회전 규칙

```js
getRotationStep(type):
  - mirror_45, half_mirror_45 → 45도 스텝
  - ray, target (상급 맵) → 45도 스텝
  - ray, target (기본 맵) → 90도 스텝
  - 그 외 모두 → 90도 스텝
```

#### 4-2-5. Undo 시스템

`mouseup` 이벤트에서 `JSON.stringify` 비교로 상태 변경 여부를 감지해 undoStack에 push.
`Ctrl+Z`/`Meta+Z` 단축키로 최대 50단계 되돌리기.

---

### 4-3. `laserEngine.js` — 레이저 물리 시뮬레이션

HTML5 Canvas 위에 레이저 광선을 실시간으로 시뮬레이션한다.
DPR(devicePixelRatio)을 고려해 고해상도 디스플레이를 지원한다.

#### 4-3-1. 방향 벡터 (8방향, 45도 간격)

```
  315  0  45
   270    90
  225 180 135
```

#### 4-3-2. 반사각 계산

```js
calculateReflection(inDir, surfaceAngle) = (2 * surfaceAngle - inDir + 720) % 360
```

이는 입사각 = 반사각 법칙을 표면 법선 없이 표면각으로 직접 계산하는 공식이다.

#### 4-3-3. 기물별 레이저 처리

| 기물 타입 | 처리 방식 |
|-----------|-----------|
| `ray` | 빔 발사 시작점 (270도 + rotation 방향) |
| `target` | 빔 흡수 (통과하지 않음) |
| `block` | 빔 통과 (물리적으로 막지 않음 — 주목할 부분) |
| `mirror` | 단방향 전반사 (surfaceAngle = 135 + rotation) |
| `half_mirror` | 반사 + 투과 (빔 분기, 두 빔 생성) |
| `single_mirror` | 단면 반사경 (앞면만 반사, 뒷면은 차단) |
| `target_mirror_a/b` | 단면 반사경 + 표적 포함 |
| `mirror_45` | 45도 전반사 (surfaceAngle = 337.5 + rotation) |
| `half_mirror_45` | 45도 반투과 |
| `diag_single_mirror_a/b` | 대각선 단면 반사경 |
| `v_mirror` | 수직 전반사 (surfaceAngle = rotation) |
| `v_half_mirror` | 수직 반투과 |
| `v_single_mirror` | 수직 단면 반사경 |
| `v_target_mirror_a/b` | 수직 단면 반사경 + 표적 |
| `tunnel` | 회전에 따라 수평 또는 수직 방향만 통과 허용 |

무한 루프 방지: `visited = new Set()` — `"x,y,dir"` 키로 동일 상태 재방문 차단.

---

### 4-4. `libraryController.js` — 커뮤니티 & 라이브러리

#### 4-4-1. 화면 전환

`isLibraryMode` 플래그로 에디터 스크린 ↔ 라이브러리 스크린을 토글.
라이브러리 진입 시 `loadLibraryMaps()` 자동 호출.

#### 4-4-2. 라이브러리 카드 렌더링

두 레이아웃으로 표시:
1. **그리드 레이아웃** (전체 목록): `auto-fill, minmax(220px, 1fr)`
2. **수평 스크롤 섹션**:
   - "featured" — 갓맵(👍) 수 상위 10개
   - "original" — 최신 등록순 전체

각 카드에는 미니 5×5 그리드 프리뷰(인벤토리 기물 숨김), 제목, 제작자, 날짜, 공식/유저 난이도 배지, ✅/👍 카운트가 표시된다.

#### 4-4-3. 평가 시스템

| 기능 | 로컬 저장소 키 | DB 필드 |
|------|---------------|---------|
| 문제없음(OK) 반응 | `ray_map_states[mapId].ok` | `reactionOk` |
| 갓맵(God) 반응 | `ray_map_states[mapId].god` | `reactionGod` |
| 체감 난이도 투표 | `ray_map_states[mapId].diff` | `diffVotes.{Easy\|Normal\|Hard\|Insane}` |

유저 체감 난이도 = 투표 수가 가장 많은 레벨 (`calculateUserDifficulty`).
투표 수 동점 시 `Object.keys` 순서상 앞선 항목이 선택된다 (Easy 우선).

#### 4-4-4. 제안 게시판

다른 플레이어가 같은 맵에 대해 다른 풀이를 제안할 수 있다:

| 카테고리 | 설명 |
|----------|------|
| `NG` | 기물 줄임 — 더 적은 기물로 클리어 |
| `ABCD` | 복수정답 — 다른 배치 방법으로 클리어 |

제안에는 현재 그리드 상태가 스냅샷으로 저장된다.
"▶️ 이 풀이로 테스트" 버튼으로 제안된 배치를 즉시 테스트할 수 있다.

**삭제 권한**: 맵 제작자 또는 제안 작성자만 삭제 가능.

#### 4-4-5. 맵 수정

맵 제작자(UID 일치)에게만 "✏️ 맵 수정하기" 버튼이 노출된다.
수정 시 제목/제작자/난이도/기물 배치를 모두 업데이트한다.

#### 4-4-6. URL 파라미터 로딩

`?mapId=xxx` 파라미터가 있으면 Auth 완료 후 자동으로 해당 맵을 로드한다.
이를 통해 맵 공유 링크가 동작한다.

---

### 4-5. `uiController.js` — UI 제어

#### 업로드 모달
새 맵 업로드와 기존 맵 수정을 동일한 모달로 처리. `isEditingMap` 플래그로 분기.
업로드 완료 시 `?mapId=xxx` 형식의 공유 URL을 textarea에 출력한다.

#### 이스터에그 (상급 기물 해금)

```js
const SECRET_PASSWORD = "wheresmy8hours";
```

textarea에 비밀번호를 입력하면 `body.unlocked` 클래스가 추가되어
CSS `body.unlocked #group-advanced .tool-item { display: grid; }` 규칙으로
상급 기물 탭이 활성화된다. 비밀번호 문자열은 즉시 지워진다.

---

## 5. Firebase 데이터 모델

### `maps` 컬렉션

```
maps/{docId}
├── title: string
├── author: string
├── difficulty: "Easy" | "Normal" | "Hard" | "Insane"
├── createdAt: ISO8601 string
├── reactionOk: number (increment 사용)
├── reactionGod: number (increment 사용)
├── diffVotes: { Easy: n, Normal: n, Hard: n, Insane: n }
├── authorUid: string (Firebase 익명 UID)
└── mapData: Array<{
        x: 0-4, y: 0-4,
        type: string,
        rotation: 0|45|90|135|180|225|270|315,
        canMove: boolean,
        canRotate: boolean,
        isInventory: boolean
    }>
```

### `maps/{id}/suggestions` 서브컬렉션

```
suggestions/{docId}
├── category: "NG" | "ABCD"
├── comment: string
├── suggesterUid: string
├── createdAt: ISO8601 string
└── mapData: Array<{ x, y, type, rotation, canMove, canRotate, isInventory }>
```

---

## 6. 기물 전체 목록

### 기본 기물 (초급 탭)

| 기물 | data-tool | 설명 |
|------|-----------|------|
| Ray | `ray` | 레이저 발사기 |
| 표적 | `target` | 레이저 수신 표적 |
| 거울 | `mirror` | 전반사 (45도 대각선) |
| 반거울 | `half_mirror` | 반투과 + 반사 |
| 단면거울 | `single_mirror` | 앞면만 반사 |
| 단면 표적거울 A | `target_mirror_a` | 단면거울 + 표적 A |
| 단면 표적거울 B | `target_mirror_b` | 단면거울 + 표적 B |
| 블록 | `block` | 방해물 (레이저는 통과) |
| 터널 | `tunnel` | 지정 방향만 통과 허용 |

### 상급 기물 (이스터에그 해금)

| 기물 | data-tool | 설명 |
|------|-----------|------|
| 45도 거울 | `mirror_45` | 수평/수직 전반사 |
| 45도 반거울 | `half_mirror_45` | 수평/수직 반투과 |
| 45도 단면거울 A | `diag_single_mirror_a` | 대각선 단면 반사 |
| 45도 단면거울 B | `diag_single_mirror_b` | 역대각선 단면 반사 |
| 수직 거울 | `v_mirror` | 수직 전반사 |
| 수직 반거울 | `v_half_mirror` | 수직 반투과 |
| 수직 단면거울 | `v_single_mirror` | 수직 단면 반사 |
| 수직 단면 표적거울 A | `v_target_mirror_a` | 수직 단면거울 + 표적 A |
| 수직 단면 표적거울 B | `v_target_mirror_b` | 수직 단면거울 + 표적 B |

---

## 7. 두 가지 운영 모드

### 에디터 모드 (`isEditorMode = true`)
- 팔레트에서 기물 선택 및 배치
- 수정자 도구로 기물 특성 부여 (회전 가능 / 회전 불가 / 유저 지급)
- 전체 지우기, JSON 불러오기/추출
- 맵 서버 업로드

### 테스트 모드 (`isEditorMode = false`)
- 에디터 팔레트 숨김, 플레이어 인벤토리 노출
- `isInventory=true` 기물은 격자에서 제거되어 인벤토리로 이동
- 인벤토리 기물만 배치/이동/회수 가능
- 고정 기물(`canMove=false`)은 이동 불가
- 모드 종료 시 에디터 백업에서 비인벤토리 기물의 회전 각도만 보존하여 복원

---

## 8. 주요 기술적 특이사항

### 8-1. `block` 기물과 레이저
`laserEngine.js` 97~99행:
```js
else if (item.type === 'block') {
    drawLine(cx, cy, nextX, nextY, false);
    beams.push({ x: nextX, y: nextY, dir: cDir });
}
```
블록은 시각적으로 "장애물"처럼 보이지만 레이저가 **통과**한다. 게임 디자인 의도상 에디터에서 시각적 차단 용도로 쓰이는 것으로 보인다.

### 8-2. 고급 맵 감지에 따른 회전 각도 변경
`isAdvancedMap()` 함수가 현재 맵에 상급 기물이 있는지 확인하고,
상급 맵이면 `ray`와 `target`도 45도 스텝으로 회전한다.

### 8-3. `canRotate` 저장 시 rotation 처리
```js
rotation: mapData[r][c].canRotate ? 0 : mapData[r][c].rotation
```
`canRotate=true`인 기물은 export 시 rotation을 0으로 저장한다.
플레이어가 배치 시 자유롭게 회전할 수 있기 때문에 초기 rotation 값이 의미 없기 때문이다.

### 8-4. `libraryController.js` 자동 이벤트 등록
파일 하단에서 `initLibraryEventListeners()`가 **모듈 로드 즉시 자동 실행**된다.
이로 인해 `main.js`에서도 일부 버튼에 이벤트가 중복 등록되는 구조다
(현재는 동작에 문제 없으나 중복 핸들러 호출 가능성 존재).

### 8-5. 터치 이벤트
더블탭 확대를 방지하기 위해 300ms 이내 연속 `touchend`를 `preventDefault`로 차단한다.
단, `textarea`와 `input` 요소는 제외하여 문자 입력을 보호한다.

---

## 9. 리팩토링 이력 및 현 상태

`MODULARIZATION_PLAN.md`에 따르면 원래 모든 로직이 `index.html`의 `<script>` 블록 (~2000줄)에 있었고,
v2 리팩토링을 통해 7개 ES6 모듈로 분리하는 작업이 완료되었다.

현재 코드는 계획대로 구현된 상태이며, `index.html`에는 더 이상 `onclick` 속성이 없고
`<script type="module" src="main.js"></script>` 단 한 줄만 존재한다.

---

## 10. 제작자가 만들려는 것 — 종합 이해

이 프로젝트는 단순한 에디터가 아닌 **퍼즐 맵 공유 플랫폼**이다:

1. **맵 창작** — 에디터로 레이저 퍼즐 맵을 설계
2. **맵 공유** — Firebase에 업로드 후 URL로 공유
3. **맵 플레이** — 테스트 모드에서 인벤토리 기물을 배치해 레이저를 표적에 맞추는 퍼즐 풀기
4. **커뮤니티** — 맵 평가(문제없음/갓맵), 체감 난이도 투표, 다른 풀이 제안
5. **콘텐츠 큐레이션** — 갓맵 TOP 10, 최신 맵 수평 스크롤 섹션

게임 메커니즘 관점에서는 기본 4방향 반사 거울부터 45도 대각 반사, 반투과, 단면 반사, 터널까지 단계적으로 복잡도가 높아지는 기물 시스템을 구축했고, 상급 기물은 이스터에그로 숨겨두어 개발자/고급 사용자만 접근 가능하게 설계되어 있다.

---

*분석 기준일: 2026-05-20*
