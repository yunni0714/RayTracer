# libraryController.js — UI 규격 명세서

바닐라 JS 원본 `libraryController.js` (35.8 KB)의 전체 UI 구조, 요소 ID, CSS 클래스, 색상/크기 규격, 인터랙션 흐름을 정리한 문서.  
React 재구현 시 참고용.

---

## 1. 전역 상태 변수

| 변수 | 타입 | 역할 |
|---|---|---|
| `allLibraryMaps` | Array | Firebase에서 불러온 전체 맵 목록 |
| `isLibraryMode` | boolean | 라이브러리 화면 활성 여부 |
| `currentLoadedMapId` | string | 현재 플레이 중인 맵 ID |
| `currentLoadedMapAuthorUid` | string | 현재 맵 작성자 UID |
| `currentLoadedMapObj` | object | 현재 맵 전체 데이터 |
| `currentMapReactions` | `{ ok: number, god: number }` | 현재 맵 반응 카운트 |

---

## 2. localStorage 스키마

키: `'ray_map_states'`  
값: `Record<mapId, { ok: boolean, god: boolean, diff: string | null }>`

```js
// 예시
{
  "abc123": { ok: true, god: false, diff: "Hard" },
  "xyz789": { ok: false, god: true, diff: null }
}
```

---

## 3. DOM 요소 ID 전체 목록

| ID | 역할 | 표시 조건 |
|---|---|---|
| `'editorScreen'` | 에디터/게임 화면 컨테이너 | `class="active"` 토글로 표시/숨김 |
| `'libraryScreen'` | 라이브러리 화면 컨테이너 | `class="active"` 토글로 표시/숨김 |
| `'libraryToggleBtn'` | 라이브러리 열기/닫기 버튼 | 항상 표시 |
| `'libraryGrid'` | 라이브러리 카드 렌더링 영역 | `display: block` |
| `'searchInput'` | 맵 제목·작성자 검색 입력 | recent maps 섹션 내 |
| `'sortSelect'` | 정렬 선택 드롭다운 | recent maps 섹션 내 |
| `'newMapBtnLibrary'` | "✨ 새 맵 만들기" 버튼 (라이브러리 내) | recent maps 섹션 내 |
| `'newMapBtn'` | "새 맵 만들기" 버튼 (에디터 헤더) | 항상 표시 |
| `'loadedMapInfo'` | 맵 정보 패널 | 맵 로드 시 `display: flex` |
| `'infoTitle'` | 맵 제목 표시 | `loadedMapInfo` 내 |
| `'infoAuthor'` | 작성자명 표시 | `loadedMapInfo` 내 |
| `'infoDifficulty'` | 공식 난이도 배지 | `loadedMapInfo` 내 |
| `'infoUserDifficulty'` | 체감 난이도 배지 | `loadedMapInfo` 내 |
| `'btnReactOk'` | ✅ OK 반응 버튼 | `loadedMapInfo` 내 |
| `'btnReactGod'` | 👍 GOD 반응 버튼 | `loadedMapInfo` 내 |
| `'countOk'` | OK 반응 수 표시 | `btnReactOk` 내 |
| `'countGod'` | GOD 반응 수 표시 | `btnReactGod` 내 |
| `'rightSidePanel'` | 우측 420px 탭 패널 | 맵 로드 시 `display: flex` |
| `'panelNextMap'` | "다음 문제" 탭 콘텐츠 | 탭 전환으로 표시/숨김 |
| `'panelSuggestion'` | "풀이 제안" 탭 콘텐츠 | 탭 전환으로 표시/숨김 |
| `'nextMapList'` | 다음 맵 카드 목록 컨테이너 | `panelNextMap` 내 |
| `'suggestionHeaderTitle'` | 제안 패널 헤더 제목 | `panelSuggestion` 내 |
| `'sugHeaderBtn'` | 제안하기/수정하기 버튼 | `panelSuggestion` 내 |
| `'sugCount'` | 제안 건수 span | 헤더 제목 내 |
| `'deleteMapBtn'` | "🗑️ 맵 삭제" 버튼 | 작성자만 표시 |
| `'saveMapEditBtn'` | "💾 수정 완료" 버튼 | 수정 모드 진입 시 |
| `'cancelMapEditBtn'` | "❌ 수정 취소" 버튼 | 수정 모드 진입 시 |
| `'suggestionList'` | 제안 목록 컨테이너 | `panelSuggestion` 내 |
| `'suggestionModal'` | 풀이 제안 모달 | `display: flex` / `none` |
| `'sugCategory'` | 제안 카테고리 select | 제안 모달 내 |
| `'sugComment'` | 제안 코멘트 입력 | 제안 모달 내 |
| `'sugSubmitBtn'` | "제안 등록" 제출 버튼 | 제안 모달 내 |
| `'closeSugModalBtn'` | 제안 모달 닫기 버튼 | 제안 모달 내 |
| `'answerBtn'` | 정답 보기 버튼 | 맵 로드 시만 표시 |
| `'modeToggleBtn'` | 에디터/테스트 모드 전환 버튼 | 맵 플레이 중 `display: none` |
| `'suggestionBoardContainer'` | 제안 게시판 서랍 컨테이너 | `class="drawer-open"` 토글 |

---

## 4. 라이브러리 화면 구조

### 4-1. 토글 동작

| 상태 | `libraryToggleBtn` 텍스트 | 표시되는 화면 |
|---|---|---|
| 비활성 | "📚 맵 라이브러리 열기" | `editorScreen.active` |
| 활성 | "🔙 돌아가기" | `libraryScreen.active` |

### 4-2. 3섹션 레이아웃

**검색 중이 아닐 때 순서:**
1. **Featured** — `reactionGod ≥ 3`인 맵, god 수 내림차순 상위 10개
2. **Original** — `author === "RayOriginal"`, 최신 등록 순
3. **Recent Maps** — 검색/정렬 UI + 전체 맵 그리드

**검색 중일 때:** Featured/Original 섹션 숨김, Recent Maps만 표시 (필터 결과)

### 4-3. Recent Maps 헤더 UI

```
[recent maps (h2)] [검색 input             ] [정렬 select] [✨ 새 맵 만들기]
```

- 검색 placeholder: `"맵 제목, 제작자 이름으로 검색..."`
- 정렬 옵션: `"최신 등록순"` (value=`createdAt`) / `"갓맵(👍)순"` (value=`reactionGod`)
- 새 맵 버튼 ID: `'newMapBtnLibrary'`, class: `'new-map-btn'`

---

## 5. 맵 카드 `.map-card-v2`

### 구조 (위→아래)

```
div.map-card-v2  (cursor: pointer)
  div.mini-wrapper
    div.mini-grid-v2  (5×5 썸네일, 인벤토리 기물 숨김)
  div.card-meta
    h4  (맵 제목 or "제목 없음", truncate)
    p.sub  ("{author} • {YY/MM/DD}")
  div.card-divider
  div.card-bottom
    div.badge-row
      span.diff-pill.diff-{creatorDiff}  "공식: {creatorDiff}"
      span.diff-pill.diff-{evalLabel}    "평가: {evalLabel}"
    div.stat-row
      span.stat.stat-ok   "✅ {reactionOk}"
      span.stat.stat-god  "👍 {reactionGod}"
```

- `evalLabel`: 체감 난이도 최다 득표값, 없으면 `"None"`
- 날짜 포맷: `new Date(createdAt).toLocaleDateString('ko-KR', { year:'2-digit', month:'2-digit', day:'2-digit' })`
- 클릭: `playMapFromLibrary(mapObj)`

### 난이도 색상 (`.diff-{level}`)

| 값 | 색상 |
|---|---|
| Tutor | `#3498db` |
| Easy | `#2ecc71` |
| Normal | `#f39c12` |
| Hard | `#e67e22` |
| Insane | `#e74c3c` |
| None | background `#cbd5e1`, color `#475569` |

---

## 6. 맵 로드 — `playMapFromLibrary(mapObj)`

실행 순서:
1. `resetAnswerState()`, `exitMapEditMode()` 호출
2. 라이브러리 모드 종료 → 에디터 화면 전환
3. 그리드에 맵 데이터 적용 (isInventory 기물은 playerInventory로 분리)
4. `loadedMapInfo` → `display: flex`
5. `infoTitle`: `🗺️ {title}{version ≥ 2 ? ' (ver. N)' : ''}`
6. `infoDifficulty` / `infoUserDifficulty` 배지 업데이트
7. 반응 UI, 제안 헤더 UI 업데이트
8. `rightSidePanel` → `display: flex`
9. `modeToggleBtn` → `display: none`
10. 알림: `"[{title}] 플레이를 시작합니다!"` 색상 `#27ae60`

---

## 7. 우측 패널 탭

```
div#rightSidePanel  (display: flex, width: 420px)
  div.right-tab-buttons  (width: 40px, 세로 탭 버튼 열)
    button.right-tab[data-panel="next-map"]   "다\n음\n문\n제"
    button.right-tab[data-panel="suggestion"] "풀\n이\n제\n안"
  div.right-panel-content  (flex: 1)
    div#panelNextMap
    div#panelSuggestion
```

- 활성 탭: `class="active"` 추가
- 전환: `switchRightPanel(tab)` — 비활성 탭 `display: none`, 활성 탭 표시

---

## 8. 다음 문제 패널 (`#panelNextMap`)

### 다음 맵 추천 알고리즘

현재 맵 제외 → 전체 맵에서 무작위 3개 선택 (Fisher-Yates shuffle 적용).  
`ray_map_states`에 플레이 기록이 있는 맵(=반응/투표한 맵)을 후순위로 배치.

### 카드 구조 `.next-map-card`

```
div.next-map-card  (display: flex, gap: 14px, cursor: pointer)
  div.next-grid-area  (width: 44%)
    [mini-grid-v2, 인벤토리 숨김]
  div.next-info-v2  (flex: 1)
    h4  (15px, font-weight: 800, #1e293b, title 속성 포함)
    p.next-sub  (11px, #94a3b8)  "{author} • {YY/MM/DD}"
    p.next-desc  (12px, #64748b, 설명 있을 때만 표시)
    div.next-badge-row
      span.diff-pill.diff-{diff}      "공식: {diff}"
      span.diff-pill.diff-{evalLabel} "평가: {evalLabel}"
    div.next-stat-row
      span.stat.stat-ok   "✅ {reactionOk}"
      span.stat.stat-god  "🔥 {reactionGod}"  ← god은 🔥 이모지 사용
```

- 빈 상태: `color: #94a3b8; font-size: 13px; text-align: center; padding: 20px 0;` "다른 맵이 없습니다."
- 클릭: `playMapFromLibrary(mapObj)`

---

## 9. 반응 버튼 (OK / GOD)

### 버튼 상태

| 상태 | `btnReactOk` 스타일 | `btnReactGod` 스타일 |
|---|---|---|
| 비활성 | 기본 border 스타일 | 기본 border 스타일 |
| 활성 | `class="active ok"` 추가 | `class="active god"` 추가 |

### 동작 흐름 `toggleReaction(type)`

1. 미로그인 → 알림 "로그인 후 평가할 수 있습니다." `#e74c3c`
2. 버튼 `disabled = true`
3. localStorage에서 현재 상태 읽기
4. 같은 값이면 취소, 다른 값이면 추가 → Firebase `updateMapReactionsInDB()` 호출
5. localStorage 저장
6. `countOk` / `countGod` 텍스트 업데이트
7. 버튼 `disabled = false`
8. 알림: 추가 시 "평가를 반영했습니다." / 취소 시 "평가를 취소했습니다."

---

## 10. 체감 난이도 투표

class: `'diff-vote-btn'`, 각 버튼에 `class="diff-{level}"` 추가로 색상 지정

| 난이도 | 색상 |
|---|---|
| Tutor | `#3498db` |
| Easy | `#2ecc71` |
| Normal | `#f39c12` |
| Hard | `#e67e22` |
| Insane | `#e74c3c` |

### 동작 흐름 `voteDifficulty(diffLevel)`

1. 미로그인 → 알림 "로그인 후 투표할 수 있습니다." `#e74c3c`
2. 모든 `.diff-vote-btn` `disabled = true`
3. Firebase `updateMapDifficultyVoteInDB()` 호출
4. localStorage에 투표값 저장
5. 활성 버튼 `class="active"` 표시
6. 모든 버튼 `disabled = false`
7. 알림: "체감 난이도 투표가 완료되었습니다!"

---

## 11. 제안 헤더 — 작성자 vs 비작성자 분기

### 비작성자 (일반 플레이어)

| 요소 | 값 |
|---|---|
| 헤더 제목 | `💡 다른 풀이 제안 ({N}건)` |
| `sugHeaderBtn` 텍스트 | `"내 풀이 제안하기"` |
| `sugHeaderBtn` 스타일 | `background-color: #f59e0b; border: none; color: #fff;` |
| `deleteMapBtn` | `display: none` |

### 작성자

| 요소 | 값 |
|---|---|
| 헤더 제목 | `💡 제안 관리 및 맵 수정 ({N}건)` |
| `sugHeaderBtn` 텍스트 | `"✏️ 맵 수정하기"` |
| `sugHeaderBtn` 스타일 | `background-color: #10b981; border: none; color: #fff;` |
| `deleteMapBtn` | `display: inline-block` |

---

## 12. 제안 목록 패널 (`#suggestionList`)

### 각 제안 아이템 `.suggestion-item`

```
div.suggestion-item  (display: flex, gap: 12px)
  div.sug-grid-area  (width: 38%)
    [mini-grid-v2, 인벤토리 포함]
  div.sug-content  (flex: 1)
    div.sug-cat-row  (flex, gap: 8px, flex-wrap)
      [카테고리 배지들]
      span  (color: #94a3b8, 11px)  날짜
    p.sug-comment  (12px, font-weight: 600, #1e293b)  코멘트 내용
  div.sug-actions  (flex-col, align-self: center)
    button.sug-test-btn  "▶ 이 풀이로 테스트"
    button.sug-del-btn   "🗑️ 삭제"  (조건부 표시)
```

### 카테고리 배지

| 카테고리 값 | 배지 텍스트 | 색상 |
|---|---|---|
| `"NG"` | `🆖 기물 줄임` | `background: #ef4444; color: white` |
| `"ABCD"` | `🔠 복수정답` | `background: #3b82f6; color: white` |

배지 공통 스타일: `padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800;`

### 삭제 버튼 표시 조건

`currentUserUid === currentLoadedMapAuthorUid` (작성자) **OR** `currentUserUid === sug.suggesterUid` (제안자 본인)

### 상태 메시지

| 상태 | 표시 내용 |
|---|---|
| 로딩 중 | `color: #94a3b8; font-size: 14px; font-weight: 500;` "불러오는 중..." |
| 빈 상태 | `color: #64748b; font-size: 14px; font-weight: 500; line-height: 1.6;` "아직 등록된 제안이 없습니다. 첫 번째로 풀이를 뽐내보세요!" |
| 에러 | `color: #ef4444;` "게시판을 불러오는 데 실패했습니다." |

### "▶ 이 풀이로 테스트" 동작

1. 제안 mapData를 그리드에 적용 (인벤토리 기물 포함, 분리 없이 그대로)
2. playerInventory를 빈 객체로 초기화
3. 레이저 갱신
4. 알림: "제안된 풀이를 불러왔습니다. 확인해보세요!" `#27ae60`

---

## 13. 맵 수정 모드

### 진입 — `startMapEdit()`

1. `resetAnswerState()`, `enterMapEditMode()` 호출
2. 알림: "✏️ 수정 모드입니다. 그리드를 자유롭게 배치한 뒤 저장하세요." `#f59e0b`
3. `saveMapEditBtn`, `cancelMapEditBtn` 버튼 표시

### 저장 — `saveMapEdit()`

- `window._openUploadForEdit(currentLoadedMapObj)` 호출 → UploadModal을 현재 맵 편집 모드로 열기

### 취소 — `cancelMapEdit()`

- confirm: "수정한 내용을 모두 버리고 원래 맵으로 돌아갑니다. 계속하시겠습니까?"
- `exitMapEditMode({ restore: true })` → 원본 그리드 복원
- 에디터 모드로 전환
- 알림: "수정이 취소되었습니다." `#7f8c8d`

---

## 14. 맵 삭제 — `deleteCurrentMap()`

1. confirm: "정말로 이 맵을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며, 모든 제안과 평가도 함께 삭제됩니다."
2. `deleteMapBtn` 텍스트 → "삭제 중...", `disabled = true`
3. Firebase `deleteMapFromDB()` 호출
4. 알림: "맵이 성공적으로 삭제되었습니다." `#e74c3c`
5. `createNewMap()` 호출 (빈 에디터로 초기화)

---

## 15. 새 맵 만들기 — `createNewMap()`

1. confirm: "진행 중인 맵이 모두 초기화되고 빈 에디터로 돌아갑니다. 새로 만드시겠습니까?"
2. `resetAnswerState()`, `exitMapEditMode()` 호출
3. 전체 셀 초기화 (`updateCellVisual(cell, null)` 25회)
4. 레이저 갱신
5. 숨김 처리:
   - `loadedMapInfo` → `display: none`
   - `rightSidePanel` → `display: none`
   - `answerBtn` → `display: none`
   - `modeToggleBtn` → `display: ''` (재표시)
6. URL에서 `mapId` 파라미터 제거
7. 알림: "새로운 맵이 생성되었습니다!" `#e67e22`
8. 제안 헤더 UI 초기화

---

## 16. URL mapId 자동 로드 — `initUrlParamLoader()`

1. URL 쿼리에서 `mapId` 파라미터 읽기
2. 없으면 종료
3. **500ms 딜레이** 후 실행 (Firebase Auth 완료 대기)
4. 알림: "서버에서 맵을 불러오는 중..." `#f39c12`
5. Firebase `fetchFromDB(mapId)` 호출
6. 성공: `playMapFromLibrary(mapObj)`
7. 실패: `alert("해당 맵을 찾을 수 없습니다.")`

---

## 17. 이벤트 리스너 바인딩 목록

`initLibraryEventListeners()` 에서 등록 (파일 로드 시 즉시 실행)

| 이벤트 소스 | 이벤트 | 핸들러 |
|---|---|---|
| `'libraryToggleBtn'` | click | `toggleLibraryScreen()` |
| `'newMapBtn'` | click | `createNewMap()` |
| `'btnReactOk'` | click | `toggleReaction('ok')` |
| `'btnReactGod'` | click | `toggleReaction('god')` |
| `'sugHeaderBtn'` | click | `handleSugHeaderBtnAction()` |
| `'deleteMapBtn'` | click | `deleteCurrentMap()` |
| `'saveMapEditBtn'` | click | `saveMapEdit()` |
| `'cancelMapEditBtn'` | click | `cancelMapEdit()` |
| `'sugSubmitBtn'` | click | `submitSuggestion()` |
| `'closeSugModalBtn'` | click | `closeSuggestionModal()` |
| 모든 `.diff-vote-btn` | click | `voteDifficulty(btn의 diff-{level} 클래스에서 추출)` |
| 모든 `.right-tab` | click | `switchRightPanel(btn.dataset.panel)` |

---

## 18. CSS 클래스 전체 목록

### 그리드 관련
- `.mini-grid` — 구버전 5×5 썸네일 (inline style 방식)
- `.mini-cell` — 구버전 셀
- `.mini-grid-v2` — 신버전 5×5 썸네일 (CSS class 방식)
- `.mini-cell-v2` — 신버전 셀 (`box-shadow: inset 0 0 0 1px #e2e8f0`)
- `.mini-wrapper` — mini-grid-v2 래퍼

### 맵 카드
- `.map-card-v2` — 카드 루트 (`cursor: pointer`, hover: `translateY(-4px)`)
- `.card-meta` — 제목/작성자/날짜 영역
- `.card-divider` — 구분선
- `.card-bottom` — 하단 배지+통계 영역
- `.badge-row` — 난이도 배지 행
- `.stat-row` — 반응 수치 행

### 라이브러리 섹션
- `.library-section` — Featured / Original 섹션 컨테이너
- `.section-heading` — 섹션 h2 제목
- `.horizontal-scroll-container` — 수평 스크롤 카드 열
- `.recent-maps-header` — Recent Maps 헤더 바
- `.recent-maps-grid` — Recent Maps 카드 그리드
- `.new-map-btn` — "✨ 새 맵 만들기" 버튼

### 공통 배지
- `.diff-pill` — 난이도 알약 배지
- `.diff-{Tutor|Easy|Normal|Hard|Insane|None}` — 난이도별 색상
- `.difficulty-badge` — 맵 정보 패널의 난이도 배지
- `.stat` — 통계 값 공통
- `.stat-ok` — OK 수치 (`color: #27ae60`)
- `.stat-god` — GOD 수치 (`color: #ef4444`)

### 우측 패널
- `.right-tab` — 수직 탭 버튼 (active 시 `class="active"` 추가)
- `.right-panel-content` — 탭 콘텐츠 영역

### 다음 맵 패널
- `.next-map-card` — 다음 맵 카드 (`hover: translateX(2px)`)
- `.next-grid-area` — 썸네일 영역 (width 44%)
- `.next-info-v2` — 정보 영역
- `.next-sub` — 부제 (작성자·날짜)
- `.next-desc` — 설명 (조건부)
- `.next-badge-row` — 난이도 배지 행
- `.next-stat-row` — 통계 행

### 제안 게시판
- `.suggestion-item` — 제안 카드 루트
- `.sug-grid-area` — 썸네일 영역 (width 38%)
- `.sug-content` — 텍스트 콘텐츠 영역
- `.sug-cat-row` — 카테고리 배지 행
- `.sug-comment` — 코멘트 본문
- `.sug-actions` — 버튼 영역 (세로 배치)
- `.sug-test-btn` — "▶ 이 풀이로 테스트" 버튼
- `.sug-del-btn` — "🗑️ 삭제" 버튼
- `.drawer-open` — 제안 게시판 서랍 열림 상태

### 상태
- `.active` — 버튼/탭 활성 상태
- `.ok` — OK 반응 활성 (btnReactOk)
- `.god` — GOD 반응 활성 (btnReactGod)
- `.diff-vote-btn` — 체감 난이도 투표 버튼

---

## 19. 알림 메시지 & 색상 레퍼런스

| 상황 | 메시지 | 색상 |
|---|---|---|
| 맵 플레이 시작 | `"[{title}] 플레이를 시작합니다!"` | `#27ae60` |
| 이 풀이로 테스트 | `"제안된 풀이를 불러왔습니다. 확인해보세요!"` | `#27ae60` |
| 반응 추가 | `"평가를 반영했습니다."` | 기본 |
| 반응 취소 | `"평가를 취소했습니다."` | 기본 |
| 미로그인 반응 | `"로그인 후 평가할 수 있습니다."` | `#e74c3c` |
| 난이도 투표 완료 | `"체감 난이도 투표가 완료되었습니다!"` | 기본 |
| 미로그인 투표 | `"로그인 후 투표할 수 있습니다."` | `#e74c3c` |
| 제안 등록 완료 | `"새로운 풀이 제안이 등록되었습니다!"` | `#f39c12` |
| 제안 삭제 | `"제안이 삭제되었습니다."` | `#e74c3c` |
| 맵 삭제 완료 | `"맵이 성공적으로 삭제되었습니다."` | `#e74c3c` |
| 맵 생성 | `"새로운 맵이 생성되었습니다!"` | `#e67e22` |
| 수정 모드 진입 | `"✏️ 수정 모드입니다. 그리드를 자유롭게 배치한 뒤 저장하세요."` | `#f59e0b` |
| 수정 취소 | `"수정이 취소되었습니다."` | `#7f8c8d` |
| URL 맵 로드 중 | `"서버에서 맵을 불러오는 중..."` | `#f39c12` |
| 미로그인 제안 | `"로그인 후 풀이를 제안할 수 있습니다."` | `#e74c3c` |
| 미로그인 제안헤더 | `"로그인 후 이용할 수 있습니다."` | `#e74c3c` |
