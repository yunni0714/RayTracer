# RayTracer — 프로젝트 구조 문서

작업자(사람/AI)가 특정 기능을 수정할 때 **어느 파일을 봐야 하는지** 바로 찾을 수 있도록 정리한 문서.

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [디렉토리 트리](#2-디렉토리-트리)
3. [파일별 역할 상세](#3-파일별-역할-상세)
4. [태스크 → 파일 매핑 인덱스](#4-태스크--파일-매핑-인덱스)
5. [핵심 데이터 모델](#5-핵심-데이터-모델)
6. [Zustand 상태 관리 구조](#6-zustand-상태-관리-구조)
7. [레이저 시뮬레이션 알고리즘](#7-레이저-시뮬레이션-알고리즘)
8. [드래그앤드롭 엔진](#8-드래그앤드롭-엔진)
9. [Firebase 연동 구조](#9-firebase-연동-구조)
10. [E2E 테스트 구조](#10-e2e-테스트-구조)

---

## 1. 프로젝트 개요

**RayTracer**는 레이저 반사 퍼즐 게임 에디터 + 플레이어다.
사용자가 거울/반거울 등 피스를 5×5 그리드에 배치해 레이저를 타겟에 맞추는 퍼즐을 만들고 공유한다.

| 항목 | 내용 |
|------|------|
| 프레임워크 | React 18 + TypeScript 5.6 |
| 번들러 | Vite 6 (base: `/RayTracer/`) |
| 스타일 | Tailwind CSS 3.4 |
| 상태관리 | Zustand 5 |
| 백엔드 | Firebase 10 (Firestore + Google Auth) |
| 라우팅 | React Router DOM 6 |
| 테스트 | Playwright 1.49 (E2E) |

**주요 명령어**

```bash
npm run dev        # 개발 서버 (localhost:5173)
npm run build      # 프로덕션 빌드
npm run preview    # 빌드 결과 미리보기
npm run test:e2e   # Playwright E2E 테스트
npm run lint       # ESLint 검사
```

---

## 2. 디렉토리 트리

```
RayTracer/
├── src/
│   ├── main.tsx                          # 진입점
│   ├── App.tsx                           # 루트 컴포넌트 (auth + URL 맵 로더)
│   ├── vite-env.d.ts
│   │
│   ├── types/
│   │   └── game.ts                      # 전체 타입 정의 (단일 파일)
│   │
│   ├── store/
│   │   └── gameStore.ts                 # Zustand 전역 스토어
│   │
│   ├── lib/
│   │   ├── firebase.ts                  # Firebase 초기화 (db, auth 인스턴스)
│   │   ├── firebaseService.ts           # Auth/User/Maps/Suggestions CRUD
│   │   ├── laserEngine.ts               # 레이저 물리 + 캔버스 렌더링
│   │   └── svgArt.ts                    # SVG 아이콘 맵 + GRID_SIZE/CELL_SIZE 상수
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                   # Firebase auth 리스너
│   │   ├── useGridDragDrop.ts           # 드래그앤드롭 엔진 (378줄)
│   │   ├── useLaserCanvas.ts            # 캔버스 세팅 + 레이저 렌더 트리거
│   │   └── useMapReactions.ts           # 반응/투표 + localStorage 동기화
│   │
│   ├── pages/
│   │   └── EditorPage.tsx               # 메인 페이지 레이아웃 (Header + Board + Panels)
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx               # 로고, 새 맵, 라이브러리/에디터 토글, 인증
│   │   │   └── Notification.tsx         # 토스트 알림 (2초 자동 소멸)
│   │   │
│   │   ├── game/
│   │   │   ├── GameBoard.tsx            # 그리드 + 캔버스 + 설명 컨테이너
│   │   │   ├── GridContainer.tsx        # 5×5 CSS 그리드, useGridDragDrop 연결
│   │   │   ├── GridCell.tsx             # 개별 셀 (SVG 아이콘 + 회전 표시)
│   │   │   └── LaserCanvas.tsx          # 레이저 오버레이 캔버스
│   │   │
│   │   ├── palette/
│   │   │   ├── PalettePanel.tsx         # 툴 탭 (기본/중급/고급), 모디파이어, JSON 가져오기/내보내기
│   │   │   ├── TestModeInventory.tsx    # 인벤토리 표시 (테스트 모드 전용)
│   │   │   └── ToolItem.tsx             # 툴 버튼 (아이콘 + 카운트 배지)
│   │   │
│   │   ├── library/
│   │   │   ├── LibraryScreen.tsx        # 라이브러리 화면 (추천/원본/최근, 검색/정렬)
│   │   │   ├── MapCard.tsx              # 수평 스크롤 맵 카드 (미니 그리드, 제목, 배지, 반응)
│   │   │   ├── MiniGrid.tsx             # 5×5 미니 그리드 렌더러 (v1: pixel, v2: aspect-ratio)
│   │   │   ├── LoadedMapInfo.tsx        # 현재 맵 제목/작성자/난이도/반응, 편집/삭제/제안 버튼
│   │   │   ├── RightSidePanel.tsx       # 탭 패널 (다음 문제 제안, 풀이 제안)
│   │   │   ├── NextMapPanel.tsx         # 미플레이 맵 3개 랜덤 표시
│   │   │   └── SuggestionPanel.tsx      # 풀이 제안 목록, 로드/삭제 (소유권 체크)
│   │   │
│   │   └── modals/
│   │       ├── NicknameModal.tsx         # 닉네임 설정/변경 (2-16자)
│   │       ├── UploadModal.tsx           # 맵 메타데이터 생성/편집 (제목, 난이도, 설명)
│   │       └── SuggestionModal.tsx       # 대안 풀이 제출 (NG 또는 ABCD 카테고리)
│   │
│   └── styles/
│       └── global.css                   # Tailwind + 커스텀 그리드 마커, 애니메이션, 스크롤바
│
├── e2e/
│   ├── helpers.ts                       # Playwright 유틸 (스토어 접근, 셀 좌표, 픽스처)
│   ├── inventory.spec.ts                # 인벤토리 드래그앤드롭 테스트
│   ├── rotation.spec.ts                 # 회전 동작 테스트
│   ├── map-switch.spec.ts               # 맵 전환 테스트
│   └── palette-leak.spec.ts             # 팔레트 선택 유출 테스트
│
├── public/                              # 정적 파일
├── docs/                                # 문서 (별도 내용)
├── scripts/                             # 빌드/유틸 스크립트
│
├── index.html
├── vite.config.ts                       # base: '/RayTracer/', React 플러그인
├── tailwind.config.js                   # 커스텀 컬러, grid-game 5×5 템플릿
├── playwright.config.ts                 # Chrome headless, webServer: npm run dev
├── tsconfig.json / tsconfig.app.json    # TS 설정 (ES2020, strict)
├── eslint.config.js
└── package.json
```

---

## 3. 파일별 역할 상세

### 진입점

#### `src/main.tsx`
- React 루트 생성, `<App />` 마운트
- `window.__rayStore` 노출 (E2E 테스트용, dev/test 환경)

#### `src/App.tsx`
- `useAuth()` 호출 → Firebase auth 리스너 시작
- URL `?mapId=X` 파라미터 감지 → `fetchFromDB()` → `loadMapForPlay()` 자동 로드
- `EditorPage` + 모달(Nickname, Upload, Suggestion) + `Notification` 렌더

---

### `src/types/game.ts` — 모든 타입 정의

프로젝트 전체에서 import하는 단일 타입 소스. 변경 시 전 파일에 영향.

| 타입 | 내용 |
|------|------|
| `PieceType` | 19개 피스 종류 유니온 |
| `Rotation` | 0\|45\|90\|135\|180\|225\|270\|315 |
| `Difficulty` | 'Tutor'\|'Easy'\|'Normal'\|'Hard'\|'Insane' |
| `CellData` | 셀 데이터 (type, rotation, canMove, canRotate, isInventory) |
| `InventoryItem` | 인벤토리 아이템 (count, type, canRotate, rotation) |
| `MapItemDTO` | Firebase 저장/로드용 맵 아이템 (x, y 포함) |
| `MapDocument` | Firestore 맵 도큐먼트 전체 구조 |
| `SuggestionDocument` | 풀이 제안 도큐먼트 |
| `GameMode` | 'editor'\|'test'\|'mapEdit' |
| `GameSnapshot` | Undo 스냅샷 (mapData + playerInventory) |
| `SelectedTool` | 선택된 툴 정보 (type, source, fromRow/Col 등) |
| `ActiveModal` | 'upload'\|'suggestion'\|'nickname'\|'changeNickname'\|null |

---

### `src/store/gameStore.ts` — Zustand 전역 스토어

전체 앱 상태의 단일 소스. 상세는 [§6 상태 관리 구조](#6-zustand-상태-관리-구조) 참조.

**exports**: `useGameStore`, `emptyGrid()`, `invKey()`

**imports**: `types/game`, `lib/svgArt` (GRID_SIZE)

---

### `src/lib/firebase.ts` — Firebase 초기화

- `db`: Firestore 인스턴스
- `auth`: Firebase Auth 인스턴스
- 환경변수 `VITE_FIREBASE_*`에서 설정 로드

**exports**: `db`, `auth`

---

### `src/lib/firebaseService.ts` — Firebase CRUD

Auth, 사용자, 맵, 풀이 제안 모든 Firestore 연산 담당.
상세는 [§9 Firebase 연동 구조](#9-firebase-연동-구조) 참조.

**imports**: `lib/firebase`, `types/game`

---

### `src/lib/laserEngine.ts` — 레이저 물리 + 렌더링

레이저 빔 시뮬레이션과 Canvas 그리기 담당.
상세는 [§7 레이저 시뮬레이션 알고리즘](#7-레이저-시뮬레이션-알고리즘) 참조.

**exports**: `simulateLaser()`, `clearLaser()`, `setupCanvas()`, `calculateReflection()`

**imports**: `types/game`, `lib/svgArt` (GRID_SIZE, CELL_SIZE)

---

### `src/lib/svgArt.ts` — SVG 아이콘 + 그리드 상수

```ts
export const GRID_SIZE = 5;   // 그리드 크기 (행/열 수)
export const CELL_SIZE = 100; // 셀 크기 (px)
export const SVG_ART: Record<PieceType, string>; // 19개 피스 인라인 SVG
```

**핵심**: `GRID_SIZE`와 `CELL_SIZE`를 변경하면 laserEngine, setupCanvas, CSS grid-game 템플릿 모두 영향.

---

### `src/hooks/useAuth.ts` — 인증 상태 리스너

- `onAuthStateChanged` 구독
- 로그인 시 `getUserProfile()` → 닉네임 없으면 NicknameModal 오픈
- `setUser()` 스토어 액션으로 uid/nickname 저장

**imports**: `lib/firebaseService`, `store/gameStore`

---

### `src/hooks/useGridDragDrop.ts` — 드래그앤드롭 엔진 (378줄)

가장 복잡한 훅. 상세는 [§8 드래그앤드롭 엔진](#8-드래그앤드롭-엔진) 참조.

**exports**: `useGridDragDrop(containerRef)`

**imports**: `store/gameStore`, `types/game`, `lib/svgArt`

---

### `src/hooks/useLaserCanvas.ts` — 캔버스 레이저 렌더

- `useEffect`로 캔버스 초기화 (`setupCanvas()`)
- `isLaserOn` + `mapData` 변경 구독 → `simulateLaser()` 또는 `clearLaser()` 호출

**exports**: `useLaserCanvas(canvasRef)`

**imports**: `store/gameStore`, `lib/laserEngine`

---

### `src/hooks/useMapReactions.ts` — 반응/투표 관리

- localStorage 키: `ray_map_states`
- 맵별 ok/god 반응, 난이도 투표 상태 로컬 저장
- Firebase 낙관적 업데이트 (즉시 UI 반영 후 DB 동기화)
- 중복 투표 방지

**imports**: `store/gameStore`, `lib/firebaseService`, `types/game`

---

### `src/pages/EditorPage.tsx` — 메인 페이지 레이아웃

```
Header
├── (라이브러리 모드) LibraryScreen
└── (에디터/테스트 모드)
    ├── GameBoard (GridContainer + LaserCanvas)
    ├── PalettePanel / TestModeInventory
    └── RightSidePanel (LoadedMapInfo + NextMapPanel/SuggestionPanel)
```

**imports**: 거의 모든 컴포넌트

---

### `src/components/game/GridContainer.tsx`

- 5×5 CSS grid 렌더
- `useGridDragDrop()` 호출 → containerRef 연결
- 각 셀 → `GridCell` 컴포넌트

---

### `src/components/game/GridCell.tsx`

- `data-row`, `data-col` 어트리뷰트로 드래그앤드롭 식별
- SVG 아이콘 렌더 (`SVG_ART[cell.type]`)
- rotation CSS transform 적용
- `canRotate` 표시 인디케이터

---

### `src/components/game/LaserCanvas.tsx`

- `<canvas>` 엘리먼트 렌더
- `useLaserCanvas(canvasRef)` 호출

---

### `src/components/palette/PalettePanel.tsx`

- 툴 탭: 기본(ray/target/mirror/block/tunnel) / 중급 / 고급
- 모디파이어 버튼: 회전가능(Mod-R), 고정(Mod-L), 인벤토리(Mod-I)
- JSON 가져오기/내보내기
- 맵 업로드 버튼 → UploadModal
- 이스터에그(`isUnlocked`)로 고급 피스 표시 여부 제어

---

### `src/components/palette/TestModeInventory.tsx`

- 테스트 모드 시 `playerInventory` 표시
- 각 인벤토리 아이템 → `ToolItem` 컴포넌트
- 클릭 → `setSelectedTool()` (source: 'inventory')

---

### `src/components/library/LibraryScreen.tsx`

- 섹션: 추천(featured), 원본(original), 최근(recent)
- `fetchLibraryList()` 호출, 검색/정렬 UI
- 맵 클릭 → `loadMapForPlay()` → 테스트 모드 전환

---

### `src/components/library/LoadedMapInfo.tsx`

- 현재 로드된 맵 제목/작성자/난이도 표시
- 반응 버튼 (ok, god) → `useMapReactions()`
- 맵 소유자: 편집/삭제 버튼
- 비소유자: 풀이 제안 버튼 → SuggestionModal

---

### `src/components/library/RightSidePanel.tsx`

- 탭: "다음 문제" (`NextMapPanel`) / "풀이 제안" (`SuggestionPanel`)
- 맵 로드 시 표시

---

### `src/components/modals/NicknameModal.tsx`

- 첫 로그인 시 자동 오픈
- 2-16자 닉네임 입력 → `createUserProfile()` + `setNickname()`

---

### `src/components/modals/UploadModal.tsx`

- 맵 제목(필수), 난이도(필수), 설명(선택) 입력
- 신규: `uploadToDB()` / 편집: `updateMapInDB()`

---

### `src/components/modals/SuggestionModal.tsx`

- 카테고리: NG(불가 판정) 또는 ABCD(풀이 분류)
- 현재 그리드 상태를 `mapData`로 제출 → `uploadSuggestionToDB()`

---

## 4. 태스크 → 파일 매핑 인덱스

특정 작업 시 반드시 봐야 할 파일을 우선순위 순으로 나열.

| 태스크 | 주 파일 | 보조 파일 |
|--------|--------|----------|
| **새 피스 타입 추가** | `types/game.ts` (PieceType 유니온) | `lib/svgArt.ts` (SVG 추가), `lib/laserEngine.ts` (반사 로직), `components/palette/PalettePanel.tsx` (툴 탭) |
| **레이저 반사 로직 수정** | `lib/laserEngine.ts` | `types/game.ts` (PieceType 확인) |
| **레이저 렌더 스타일 변경** | `lib/laserEngine.ts` (strokeStyle, lineWidth, shadowBlur) | `hooks/useLaserCanvas.ts` |
| **드래그앤드롭 버그** | `hooks/useGridDragDrop.ts` | `store/gameStore.ts` (setCell, swapCells), `components/game/GridCell.tsx` (data-row/col) |
| **셀 클릭/회전 동작** | `hooks/useGridDragDrop.ts` (onClick 핸들러) | `store/gameStore.ts` |
| **Undo/Redo 수정** | `store/gameStore.ts` (saveUndoSnapshot, undo) | `hooks/useGridDragDrop.ts` (Ctrl+Z 핸들러) |
| **인벤토리 시스템 수정** | `store/gameStore.ts` (invKey, buildInventory, adjustInventoryCount) | `hooks/useGridDragDrop.ts`, `components/palette/TestModeInventory.tsx` |
| **에디터↔테스트 모드 전환** | `store/gameStore.ts` (toggleMode, loadMapForPlay) | `hooks/useGridDragDrop.ts` |
| **정답 보기 기능** | `store/gameStore.ts` (showAnswer, hideAnswer) | `components/library/LoadedMapInfo.tsx` |
| **모디파이어(canMove/canRotate/isInventory) 동작** | `hooks/useGridDragDrop.ts` (painter mode) | `store/gameStore.ts` (setModRotatable, setModLock, setModInv) |
| **Firebase 데이터 구조 변경** | `lib/firebaseService.ts` | `types/game.ts` (MapDocument, SuggestionDocument), `store/gameStore.ts` |
| **새 Firestore 컬렉션/쿼리** | `lib/firebaseService.ts` | `lib/firebase.ts` |
| **Google 로그인 수정** | `lib/firebaseService.ts` (signInWithGoogle) | `hooks/useAuth.ts` |
| **닉네임 로직 수정** | `lib/firebaseService.ts` (updateUserNickname) | `components/modals/NicknameModal.tsx`, `hooks/useAuth.ts` |
| **맵 반응(좋아요/신) 수정** | `hooks/useMapReactions.ts` | `lib/firebaseService.ts` (updateMapReactionsInDB), `components/library/LoadedMapInfo.tsx` |
| **난이도 투표 수정** | `hooks/useMapReactions.ts` | `lib/firebaseService.ts` (updateMapDifficultyVoteInDB) |
| **라이브러리 UI 수정** | `components/library/LibraryScreen.tsx` | `components/library/MapCard.tsx`, `components/library/MiniGrid.tsx` |
| **맵 카드 레이아웃** | `components/library/MapCard.tsx` | `components/library/MiniGrid.tsx`, `styles/global.css` (.map-card-v2) |
| **팔레트 툴 추가/수정** | `components/palette/PalettePanel.tsx` | `store/gameStore.ts` (selectedTool), `types/game.ts` |
| **새 모달 추가** | `store/gameStore.ts` (ActiveModal 타입, openModal) | `src/App.tsx` (모달 렌더), `components/modals/` |
| **알림(토스트) 수정** | `components/layout/Notification.tsx` | `store/gameStore.ts` (showNotification) |
| **헤더 수정** | `components/layout/Header.tsx` | `store/gameStore.ts` |
| **그리드 크기 변경** | `lib/svgArt.ts` (GRID_SIZE, CELL_SIZE) | `lib/laserEngine.ts`, `tailwind.config.js` (grid-game), `styles/global.css` |
| **스타일/테마 수정** | `tailwind.config.js` (커스텀 컬러) | `styles/global.css` |
| **JSON 가져오기/내보내기 형식** | `components/palette/PalettePanel.tsx` | `types/game.ts` (MapItemDTO) |
| **URL 기반 맵 로드** | `src/App.tsx` | `lib/firebaseService.ts` (fetchFromDB), `store/gameStore.ts` (loadMapForPlay) |
| **이스터에그 해금** | `store/gameStore.ts` (isUnlocked, setUnlocked) | `components/palette/PalettePanel.tsx` |
| **E2E 테스트 추가** | `e2e/helpers.ts` (유틸 함수) | `e2e/*.spec.ts` (해당 기능 spec) |
| **Playwright 설정 변경** | `playwright.config.ts` | |
| **Vite 빌드 설정** | `vite.config.ts` | |

---

## 5. 핵심 데이터 모델

### PieceType (19종)

```
기본:        ray, target, block, tunnel
직각 거울:   mirror, half_mirror, single_mirror
             target_mirror_a, target_mirror_b
45도 거울:   mirror_45, half_mirror_45
             diag_single_mirror_a, diag_single_mirror_b
수직 거울:   v_mirror, v_half_mirror, v_single_mirror
             v_target_mirror_a, v_target_mirror_b
```

- `mirror` = 전반사 (입사광 전체 반사)
- `half_mirror` = 반투과 (통과 + 반사 두 빔 생성)
- `single_mirror` = 단면 반사 (한쪽에서만 반사, 다른 쪽은 차단)
- `target_mirror_*` = single_mirror + 타겟 역할
- `v_*` = 수직(vertical) 방향 거울 변형

### CellData

```ts
interface CellData {
  type: PieceType;
  rotation: Rotation;   // 0|45|90|135|180|225|270|315
  canMove: boolean;     // 테스트 모드에서 이동 가능 여부
  canRotate: boolean;   // 클릭으로 회전 가능 여부
  isInventory: boolean; // 에디터에서 인벤토리 소스로 표시된 피스
}
```

### MapDocument (Firestore)

```ts
interface MapDocument {
  id: string;
  title: string;
  author: string;        // 닉네임
  authorUid: string;     // Firebase UID
  difficulty: Difficulty;
  description?: string;
  mapData: MapItemDTO[]; // 희소 배열 (null 셀 저장 안 함)
  reactionOk: number;
  reactionGod: number;
  diffVotes: Partial<Record<Difficulty, number>>;
  createdAt: string;     // ISO 8601
  version: number;
}
```

### 인벤토리 키 규칙

```ts
// src/store/gameStore.ts > invKey()
function invKey(type, canRotate, rotation): string {
  let rot = canRotate ? 0 : (rotation || 0);
  if (type === 'block') rot = 0;  // block은 항상 0
  return `${type}_${canRotate}_${rot}`;
}
// 예: "mirror_true_0", "single_mirror_false_90"
```

회전 가능 피스는 rot=0으로 통일 → 다른 회전 값이어도 같은 인벤토리 슬롯으로 분류.

---

## 6. Zustand 상태 관리 구조

`src/store/gameStore.ts` — `useGameStore` 훅으로 접근.

성능 최적화: 부분 구독 시 `useShallow()` 필수.
이벤트 핸들러 내부: stale closure 방지를 위해 `useGameStore.getState()` 직접 호출.

### 상태 분류

| 그룹 | 상태 | 설명 |
|------|------|------|
| 그리드 | `mapData` | 5×5 `(CellData\|null)[][]` |
| 그리드 | `playerInventory` | `Record<invKey, InventoryItem>` |
| 그리드 | `undoStack` | `GameSnapshot[]` (최대 50) |
| 에디터 | `isEditorMode` | true=에디터, false=테스트 |
| 에디터 | `isMapEditMode` | 로드된 맵 편집 중 |
| 에디터 | `selectedTool` | 현재 선택된 툴 |
| 에디터 | `editorMapDataBackup` | 에디터→테스트 전환 시 원본 보존 |
| 정답 | `isAnswerShown` | 정답 보기 모드 |
| 정답 | `answerMapBackup` | 정답 보기 전 상태 저장 |
| 모디파이어 | `isModRotatableActive` | 회전가능 페인터 모드 |
| 모디파이어 | `isModLockActive` | 고정 페인터 모드 |
| 모디파이어 | `isModInvActive` | 인벤토리 페인터 모드 |
| 레이저 | `isLaserOn` | 레이저 표시 여부 |
| 라이브러리 | `isLibraryMode` | 라이브러리 화면 표시 |
| 라이브러리 | `allLibraryMaps` | Firestore에서 가져온 맵 목록 |
| 라이브러리 | `currentLoadedMapObj` | 현재 로드된 맵 도큐먼트 |
| 라이브러리 | `currentMapReactions` | 현재 맵 반응 카운터 |
| 라이브러리 | `suggestions` | 현재 맵 풀이 제안 목록 |
| 인증 | `currentUserUid` | Firebase UID |
| 인증 | `currentUserNickname` | 표시 닉네임 |
| UI | `notification` | 토스트 메시지 |
| UI | `activeModal` | 현재 열린 모달 |
| UI | `isUnlocked` | 고급 피스 이스터에그 해금 |

### 주요 액션 흐름

**에디터 → 테스트 전환** (`toggleMode()`):
1. `editorMapDataBackup` 저장
2. `isInventory=true` 셀 제거 → 그리드 정리
3. `buildInventory()` → `playerInventory` 구성
4. `isEditorMode: false` 설정

**라이브러리 맵 로드** (`loadMapForPlay()`):
- 단일 `set()` 호출로 원자적 업데이트 (중간 상태 방지)
- `isLaserOn: true` 자동 활성화

**정답 보기** (`showAnswer()`):
- 현재 플레이 상태 백업
- `currentLoadedMapObj.mapData`를 그리드에 적용 (원래 정답)

---

## 7. 레이저 시뮬레이션 알고리즘

`src/lib/laserEngine.ts`

### 방향 벡터

```
0°  → 오른쪽 (dx:1, dy:0)
90° → 아래    (dx:0, dy:1)
180°→ 왼쪽   (dx:-1, dy:0)
270°→ 위      (dx:0, dy:-1)
45/135/225/315° → 대각선
```

Ray 피스의 레이저 출발 방향: `(rotation + 270) % 360`

### 시뮬레이션 루프 (BFS)

```
초기화: ray 피스 위치에서 빔 큐 생성
반복:
  빔 = 큐에서 꺼내기
  nextX, nextY = 현재 위치 + 방향 벡터
  → 그리드 벗어남: 경계까지 선 그리고 종료
  → 이미 방문한 (x,y,dir): 무한루프 방지, 스킵
  → 빈 셀 / block: 통과
  → target: 도달 표시 후 종료
  → mirror: 반사 빔 추가
  → half_mirror: 통과 빔 + 반사 빔 모두 추가
  → single_mirror: 입사 방향에 따라 반사 or 차단
  → tunnel: 정렬된 방향만 통과
```

### 반사 공식

```ts
calculateReflection(inDir, surfaceAngle):
  return (2 * surfaceAngle - inDir + 720) % 360
```

### 무한 루프 방지

방문 상태 키: `"x,y,direction"` → `Set<string>`
같은 셀에 같은 방향으로 두 번 진입 시 스킵.

---

## 8. 드래그앤드롭 엔진

`src/hooks/useGridDragDrop.ts` (378줄)

### 핵심 Refs

| Ref | 역할 |
|-----|------|
| `dragSourceRef` | 드래그 시작 정보 (source, row, col, tool) |
| `ghostRef` | 드래그 중 커서 따라다니는 SVG 고스트 엘리먼트 |
| `paintTargetRef` | 모디파이어 페인터 모드의 현재 타겟 |
| `lastActiveToolRef` | 그리드 조작 후 팔레트 선택 복원용 |

### 이벤트 흐름

```
mousedown (셀)
├── 에디터 모드 + 팔레트 툴 선택됨 → 드래그 시작 (source: palette)
├── 에디터 모드 + 셀에 피스 있음 → 드래그 시작 (source: grid)
│   └── 모디파이어 활성 → 페인터 모드 시작
└── 테스트 모드 + 인벤토리 툴 선택됨 → 드래그 시작 (source: inventory)

mousemove
└── 고스트 엘리먼트 커서 위치로 이동

mouseup (셀)
├── 같은 셀 클릭 (드래그 아님)
│   ├── 에디터 모드 → 회전 (canRotate 기물) 또는 모디파이어 적용
│   └── 테스트 모드 → 회전 (canRotate=true)
├── 다른 셀로 드래그
│   ├── palette → 셀에 배치 (saveUndoSnapshot → setCell)
│   ├── grid → 셀 이동 (swapCells) 또는 교환
│   └── inventory → 배치 (adjustInventoryCount -1 → setCell)
└── 우클릭 → 셀 삭제 (에디터: 완전 제거, 테스트: 인벤토리 환급)

keydown (Ctrl/Cmd+Z) → undo()
```

### 45° 피스 자동 감지

팔레트에서 `mirror_45`류 피스를 배치할 때 → rotation 자동 45° 설정.

### 테스트 모드 제약

- `canMove=false` 피스: 이동 불가 (회전만 허용)
- `canRotate=false` 피스: 회전 불가
- 인벤토리에서 꺼내서 배치 시 `adjustInventoryCount(-1)`
- 그리드에서 인벤토리 피스 제거 시 `refundToInventory()`

---

## 9. Firebase 연동 구조

### Firestore 컬렉션 구조

```
users/
  {uid}/
    nickname: string
    createdAt: string

maps/
  {mapId}/
    title, author, authorUid, difficulty, description
    mapData: MapItemDTO[]
    reactionOk, reactionGod
    diffVotes: { Tutor?, Easy?, Normal?, Hard?, Insane? }
    createdAt, version
    
    suggestions/
      {sugId}/
        category: 'NG' | 'ABCD'
        comment: string
        suggesterUid, suggesterNickname
        mapData: MapItemDTO[]
        createdAt
```

### 함수 목록 (`lib/firebaseService.ts`)

| 함수 | 설명 |
|------|------|
| `signInWithGoogle()` | Google 팝업 로그인 (실패 시 리다이렉트 폴백) |
| `signOutUser()` | 로그아웃 |
| `initRedirectResultHandler()` | 리다이렉트 로그인 결과 처리 |
| `getUserProfile(uid)` | 사용자 프로필 조회 |
| `createUserProfile(uid, nickname)` | 최초 로그인 시 프로필 생성 |
| `updateUserNickname(uid, nickname)` | 닉네임 변경 |
| `uploadToDB(data)` | 새 맵 업로드, 생성된 ID 반환 |
| `fetchFromDB(id)` | 맵 단건 조회 |
| `fetchLibraryList(sortBy)` | 맵 목록 조회 (최대 50개, createdAt 또는 reactionGod 정렬) |
| `updateMapReactionsInDB(id, type, change)` | 반응 카운터 +1/-1 |
| `updateMapDifficultyVoteInDB(id, oldVote, newVote)` | 난이도 투표 변경 |
| `updateMapInDB(id, data)` | 맵 메타데이터 수정 |
| `deleteMapFromDB(id)` | 맵 삭제 |
| `uploadSuggestionToDB(mapId, data)` | 풀이 제안 추가 |
| `fetchSuggestionsFromDB(mapId)` | 맵의 풀이 제안 목록 조회 |
| `deleteSuggestionFromDB(mapId, sugId)` | 풀이 제안 삭제 |

---

## 10. E2E 테스트 구조

**프레임워크**: Playwright 1.49 | **브라우저**: Chrome headless

### 파일별 커버리지

| 파일 | 테스트 대상 |
|------|------------|
| `e2e/helpers.ts` | 공통 유틸 (스토어 접근, 셀 좌표, 맵 로드 픽스처) |
| `e2e/inventory.spec.ts` | 인벤토리 피스 배치, 카운트 감소/환급 |
| `e2e/rotation.spec.ts` | 셀 클릭 회전, canRotate=false 제약 |
| `e2e/map-switch.spec.ts` | 라이브러리 맵 전환, 상태 초기화 |
| `e2e/palette-leak.spec.ts` | 맵 전환 후 팔레트 선택 상태 유출 방지 |

### 테스트 패턴

```ts
// e2e/helpers.ts 주요 유틸
loadPlayMap(page, grid, mapDoc)  // window.__rayStore.getState().loadMapForPlay() 호출
cellCenter(page, row, col)       // 그리드 셀 화면 좌표 반환
getCell(page, row, col)          // 스토어에서 셀 데이터 읽기

// 사용 예
await loadPlayMap(page, testGrid, testMapDoc);
const pos = await cellCenter(page, 2, 3);
await page.mouse.click(pos.x, pos.y);
const cell = await getCell(page, 2, 3);
expect(cell.rotation).toBe(90);
```

### 테스트 실행

```bash
npm run test:e2e                    # 전체 실행
npx playwright test inventory       # 특정 파일만
npx playwright test --debug         # 디버그 모드 (브라우저 열림)
npx playwright show-report          # 마지막 결과 리포트 열기
```

---

*최초 작성: 2026-05-28*
