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
9. [기물 config 오버레이 (어드민)](#9-기물-config-오버레이-어드민)
10. [Firebase 연동 구조](#10-firebase-연동-구조)
11. [테스트 구조](#11-테스트-구조)

---

## 1. 프로젝트 개요

**RayTracer (Project Ray)** 는 레이저 반사 퍼즐 게임 에디터 + 플레이어다.
사용자가 거울/게이트 등 기물을 NxN(5~9) 그리드에 배치해 레이저를 표적에 맞추는 퍼즐을 만들고 공유한다.
관리자는 별도 어드민 페이지(`/admin`)에서 기물의 동작/SVG/라벨/폴더를 Firestore config로 실시간 오버라이드하고 커스텀 기물도 만들 수 있다.

| 항목 | 내용 |
|------|------|
| 프레임워크 | React 18 + TypeScript 5.6 |
| 번들러 | Vite 6 (base: `/RayTracer/`) |
| 스타일 | Tailwind CSS 3.4 + CSS 변수 토큰 (다크모드 `darkMode: 'class'`) |
| 상태관리 | Zustand 5 |
| 라우팅 | React Router DOM 6 (`/` 에디터, `/admin/:tab` 어드민 셸) |
| 백엔드 | Firebase 10 (Firestore + Google Auth) |
| 테스트 | Vitest 4 (단위) + Playwright 1.49 (E2E) |
| 배포 | GitHub Pages (`.github/workflows/deploy.yml`) |

**주요 명령어**

```bash
npm run dev        # 개발 서버 (localhost:5173)
npm run build      # tsc -b + vite build
npm run preview    # 빌드 결과 미리보기
npm run test       # Vitest 단위 테스트
npm run test:e2e   # Playwright E2E 테스트
npm run lint       # ESLint 검사
```

---

## 2. 디렉토리 트리

```
RayTracer/
├── src/
│   ├── main.tsx                          # 진입점 (BrowserRouter, DEV에서 window.__rayStore 노출)
│   ├── App.tsx                           # 라우트 + 부팅 훅 (auth/theme/URL 맵 로더/기물 config 로더)
│   ├── vite-env.d.ts
│   │
│   ├── types/
│   │   └── game.ts                      # 전체 타입 정의 (단일 파일)
│   │
│   ├── store/
│   │   └── gameStore.ts                 # Zustand 전역 스토어 (+ emptyGrid, invKey, DEFAULT_GRID_SIZE)
│   │
│   ├── lib/
│   │   ├── firebase.ts                  # Firebase 초기화 (db, auth 인스턴스)
│   │   ├── firebaseService.ts           # Auth/User/Maps/Suggestions/PieceConfig CRUD
│   │   ├── laserEngine.ts               # 면별 behavior 스키마 + 순수 계산 + 캔버스 렌더
│   │   ├── artClip.ts                   # 빔-아트 클리핑 (SVG 래스터 알파 샘플링, 렌더 보조)
│   │   ├── pieceConfig.ts               # 기물 config 오버레이 (Firestore config/pieces 머지)
│   │   ├── catalogConfig.ts             # 카탈로그 정의/스키마 + 오버레이 (Firestore config/catalog 머지)
│   │   ├── catalogRules.ts              # 카탈로그 규칙 평가 (조건 AND, 고정/제외, 정렬, limit)
│   │   ├── adminMaps.ts                 # 어드민 맵 검색/정렬/통계/회전(단일·일괄) 순수 로직
│   │   ├── mapCategory.ts               # 맵 카테고리 판정 (기물 폴더 등급 파생)
│   │   ├── pieceActions.ts              # 기물 조작 (회전/삭제/회수/특성 토글) + 라벨
│   │   ├── svgArt.ts                    # 빌트인 SVG 29종 + getSvgArt() 오버라이드 접근자
│   │   └── admin.ts                     # 관리자 UID 화이트리스트 (UI 게이트)
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                   # Firebase auth 리스너
│   │   ├── useTheme.ts                  # theme → <html>.dark + localStorage 동기화
│   │   ├── useGridDragDrop.ts           # 드래그앤드롭 엔진 (Pointer Events)
│   │   ├── useLaserCanvas.ts            # 캔버스 세팅(dpr/리사이즈) + 레이저 렌더 트리거
│   │   └── useMapReactions.ts           # 반응/난이도투표 + localStorage 동기화
│   │
│   ├── pages/
│   │   ├── EditorPage.tsx               # 메인 L1 셸 (Header + 3-존 + StatusBar + 모달 호스트)
│   │   └── admin/                       # 어드민 (관리자 전용)
│   │       ├── AdminLayout.tsx          # 어드민 셸 — 관리자 게이트 + 상단바 + 탭 라우팅(/admin/:tab)
│   │       ├── PiecesTab.tsx            # [기물] 면별 behavior 에디터, 폴더/커스텀 기물 CRUD
│   │       ├── MapMasterTab.tsx         # [맵 마스터] 서브탭 셸 (/admin/mapmaster/:sub) + 맵 목록 로드
│   │       ├── useAdminMaps.ts          # └ 맵 목록 상태 훅 (조회/재조회/로컬 patch·remove)
│   │       ├── MapsTab.tsx              # └ [맵·제안 관리] 목록(2열 카드)·검색·정렬·선택·일괄 회전 진입
│   │       ├── AdminMapRow.tsx          # └   맵 카드 — 메타 편집(+제안 2단)/회전 편집/소유권 이전/영구 삭제
│   │       ├── MapSuggestionsPanel.tsx  # └   맵별 풀이 제안 조회/삭제 (메타 편집 패널 오른쪽 열)
│   │       ├── MapRotationEditor.tsx    # └   기물 각도 편집 (NxN 그리드 클릭 선택 + 같은 기물 전체)
│   │       ├── BulkRotationModal.tsx    # └   일괄 회전 — 스코프(선택/검색/전체) × 기물 타입 다중 선택
│   │       ├── StatsTab.tsx             # └ [통계] 반응 합계·난이도 분포·Top 5
│   │       ├── CatalogTab.tsx           # [카탈로그] 3열 — 목록 / 메타·규칙·큐레이션 편집 / 미리보기
│   │       ├── CatalogRuleEditor.tsx    # └ 조건 카드 리스트(AND) + 정렬 + 상위 N개
│   │       ├── CatalogCurationPanel.tsx # └ 고정/제외 맵 목록
│   │       ├── CatalogPreviewPanel.tsx  # └ 미리보기 전용 열 (썸네일 그리드 + 순위·📌 표시)
│   │       └── MapPickerModal.tsx       # └ 맵 검색·다중 선택 모달
│   │
│   ├── components/
│   │   ├── ui/                          # 공용 프리미티브 (토큰 기반, 다크 자동 대응)
│   │   │   ├── Button.tsx / IconButton.tsx
│   │   │   ├── Field.tsx                # Label, TextInput, TextArea, Select
│   │   │   ├── Modal.tsx / ConfirmModal.tsx / ConfirmHost.tsx
│   │   │   ├── Pill.tsx                 # Pill, DifficultyPill
│   │   │   ├── Tabs.tsx                 # folder / segment 변형
│   │   │   ├── cx.ts                    # className 결합 유틸
│   │   │   └── index.ts                 # 배럴
│   │   │
│   │   ├── layout/
│   │   │   ├── Header.tsx               # 로고, 새 맵, 라이브러리 토글, [편집|플레이], 어드민 링크, 테마, 인증
│   │   │   ├── StatusBar.tsx            # 하단 상태바 (기물 수/그리드/타겟 명중·해결/실행취소/레이저 토글)
│   │   │   ├── InspectorPanel.tsx       # 우 존(편집): 맵 통계 + 그리드 크기(5~9) + 선택 기물
│   │   │   └── Notification.tsx         # 토스트 알림 (2초 자동 소멸)
│   │   │
│   │   ├── game/
│   │   │   ├── GameBoard.tsx            # 보드 래퍼 (GridContainer + LaserCanvas + PiecePopover + 도움말)
│   │   │   ├── GridContainer.tsx        # NxN CSS 그리드, useGridDragDrop 연결
│   │   │   ├── GridCell.tsx             # 개별 셀 (SVG + 회전 + 🎒/🔒/🔄 특성 배지)
│   │   │   ├── LaserCanvas.tsx          # 레이저 오버레이 캔버스
│   │   │   ├── PiecePopover.tsx         # 선택 기물 플로팅 미니 메뉴 (데스크탑 전용)
│   │   │   ├── PenLayer.tsx             # 필기 오버레이 (테스트 모드 전용, 그리드 밖 우클릭→방사형 3색/지우개)
│   │   │   └── SelectedPieceInfo.tsx    # 선택 기물 정보+편집 (인스펙터/모바일 시트 공용)
│   │   │
│   │   ├── palette/
│   │   │   ├── PalettePanel.tsx         # 기물 폴더 탭(config 연동), 특성 덧칠, JSON 가져오기/내보내기, 맵 등록
│   │   │   ├── TestModeInventory.tsx    # 인벤토리 표시 (테스트 모드 전용)
│   │   │   └── ToolItem.tsx             # 툴 타일 (아이콘 + 카운트/🔒 배지)
│   │   │
│   │   ├── library/
│   │   │   ├── LibraryScreen.tsx        # 라이브러리 (카탈로그 5종, 검색/정렬, 미리보기 패널)
│   │   │   ├── MapCard.tsx              # 맵 카드 (미니 그리드, 제목, 카테고리/난이도 배지, 반응, 호버 글로우)
│   │   │   ├── MapCategoryBadge.tsx     # 맵 카테고리 배지 (mapData 에서 계산, pieceConfigRev 구독)
│   │   │   ├── MiniGrid.tsx             # NxN 미니 그리드 렌더러 (v1: pixel, v2: aspect-ratio). 회전형 고정 기물은 0도 렌더(정답 은닉), revealRotation prop으로 opt-out
│   │   │   ├── LoadedMapInfo.tsx        # 로드 맵 정보/반응/난이도투표, 소유자 수정·삭제, 풀이 제안
│   │   │   ├── RightSidePanel.tsx       # 수직 탭 패널 (다음 문제 / 풀이 제안)
│   │   │   ├── NextMapPanel.tsx         # 미플레이 우선 랜덤 3개 추천
│   │   │   └── SuggestionPanel.tsx      # 풀이 제안 목록, 테스트 로드/삭제 (소유권 체크)
│   │   │
│   │   └── modals/
│   │       ├── NicknameModal.tsx         # 닉네임 설정/변경 (2-16자, set/change 모드)
│   │       ├── UploadModal.tsx           # 맵 업로드/수정 (제목, 난이도, 설명, gridSize/version 저장)
│   │       └── SuggestionModal.tsx       # 풀이 제안 제출 (NG / ABCD)
│   │
│   └── styles/
│       └── global.css                   # 디자인 토큰 (:root/.dark) + 카드/미니그리드/배지 CSS
│
├── tests/                               # Vitest 단위 테스트
│   ├── laserEngine.test.ts              # 반사 공식, 기본 빔, 거울, 승리 판정, NxN
│   ├── groupA.test.ts                   # 무상태 기믹 기물 6종
│   ├── groupB.test.ts                   # 조건부/상태형 기물 5종 (고정점 루프)
│   ├── gridSize.test.ts                 # emptyGrid/setGridSize 리사이즈
│   ├── pieceConfig.test.ts              # config 검증/머지/커스텀/폴더/hidden/손상 방어
│   ├── catalogConfig.test.ts            # 카탈로그 스키마 v2 검증/머지/레거시 rule 승격/손상 방어
│   ├── catalogRules.test.ts             # 조건 13종 매칭, AND, 고정/제외 우선순위, 빌트인 회귀
│   ├── adminMaps.test.ts                # 어드민 검색/정렬/통계 집계/회전 델타/일괄 회전 계획
│   ├── mapCategory.test.ts              # 맵 카테고리 판정 + 폴더 오버라이드 반영
│   ├── loadMapForPlay.test.ts           # 플레이 로드 회전 정규화 / 원본 백업 불변식
│   ├── penUndo.test.ts                  # undo 스택 필기(pen) 통합 — 획/전체지우기 되돌리기
│   └── mapEditSave.test.ts              # 맵 수정 저장 시 인벤토리 기물 보존 (getAuthoredGrid)
│
├── e2e/                                 # Playwright E2E
│   ├── helpers.ts                       # 유틸 (스토어 접근, 셀 좌표, 맵 픽스처)
│   ├── inventory.spec.ts                # 인벤토리 배치/환수
│   ├── rotation.spec.ts                 # 회전 (우클릭/팝오버, canRotate 제약, 드래그 이동)
│   ├── map-switch.spec.ts               # 맵 전환 원자성
│   ├── palette-leak.spec.ts             # 팔레트 선택 테스트 모드 누수 방지
│   └── piece-popover.spec.ts            # 팝오버 (도구 해제 우선, 특성 토글, Esc)
│
├── docs/
│   ├── DESIGN.md                        # UI 디자인 시스템 확정본 (L1 셸, 토큰)
│   ├── HANDOFF.md                       # 세션 인수인계 (작업 이력)
│   ├── FEATURE_PIECES_GRID.md           # 기믹 기물 + NxN 그리드 트랙 기록
│   └── PIECE_TAXONOMY.md                # 기물 분류 멘탈 모델 (사용자 정본)
│
├── scripts/
│   └── migrate-author-uid.mjs           # 익명 UID → 구글 UID 일괄 마이그레이션 (firebase-admin, 1회용)
│
├── public/
│   ├── favicon.svg
│   └── 404.html                         # GitHub Pages SPA 폴백 (sessionStorage 리다이렉트)
│
├── .github/workflows/deploy.yml         # main 푸시 → 빌드(VITE_FIREBASE_* 시크릿) → Pages 배포
├── firestore.rules                      # Firestore 보안 규칙 (admin.ts와 UID 동기화 필수)
├── ADMIN.html                           # 독립 정적 관리자 툴 (레거시/백업 — /admin/mapmaster 로 이식됨)
├── PIECE_EDITOR.html                    # 독립 정적 기물 SVG 에디터 (100×100 그리드 드로잉 → svgArt.ts/config 용 SVG 문자열, 빌드 무관)
├── index.html                           # SPA 리다이렉트 복원 + 첫 페인트 전 다크 테마 적용
├── vite.config.ts                       # base: '/RayTracer/', React 플러그인
├── vitest.config.ts                     # tests/**/*.test.ts 만 (e2e 분리)
├── playwright.config.ts                 # Chrome headless, webServer: npm run dev
├── tailwind.config.js                   # darkMode:'class', 시맨틱 토큰 → var() 매핑
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── eslint.config.js
├── CLAUDE.md                            # AI/작업자 메인터넌스 지침
└── package.json
```

---

## 3. 파일별 역할 상세

### 진입점

#### `src/main.tsx`
- React 루트 생성, `<BrowserRouter>` + `<App />` 마운트
- DEV 환경에서만 `window.__rayStore` 노출 (Playwright E2E용)

#### `src/App.tsx`
- 부팅 훅 4종: `useTheme()`, `useAuth()`, `useUrlMapLoader()`, `usePieceConfigLoader()`
- `useUrlMapLoader`: URL `?mapId=X` → `fetchFromDB()` → `loadMapForPlay()` 자동 로드 (gridSize 반영)
- `usePieceConfigLoader`: 부팅 시 1회 `loadPieceConfig()` → 성공 시 `bumpPieceConfigRev()`
- `useCatalogConfigLoader`: 부팅 시 1회 `loadCatalogConfig()` → 성공 시 `bumpCatalogConfigRev()`
- 라우트: `/` → `EditorPage`, `/admin` · `/admin/:tab` · `/admin/:tab/:sub` → `AdminLayout`, `*` → `EditorPage`

---

### `src/types/game.ts` — 모든 타입 정의

프로젝트 전체에서 import하는 단일 타입 소스.

| 타입 | 내용 |
|------|------|
| `PieceType` | 빌트인 29개 피스 유니온 (기본 18 + Group A 6 + Group B 5) |
| `AnyPieceType` | `string` — 빌트인 또는 config 커스텀 id. 저장·렌더 경계 타입 |
| `Rotation` | 0\|45\|90\|135\|180\|225\|270\|315 |
| `Difficulty` | 'Tutor'\|'Easy'\|'Normal'\|'Hard'\|'Insane' |
| `CellData` | 셀 데이터 (type, rotation, canMove, canRotate, isInventory) |
| `InventoryItem` | 인벤토리 아이템 (count, type, canRotate, rotation) |
| `MapItemDTO` | 저장/로드용 맵 아이템 (x, y 포함, 희소 배열 요소) |
| `MapDocument` | Firestore 맵 도큐먼트 (`gridSize?` — 없으면 5 하위호환) |
| `SuggestionDocument` | 풀이 제안 도큐먼트 |
| `GameMode` | 'editor'\|'test'\|'mapEdit' |
| `GameSnapshot` | Undo 스냅샷 (mapData + playerInventory) |
| `SelectedTool` | 선택 툴 (type, source: palette/grid/inventory, inventoryKey 등) |

---

### `src/store/gameStore.ts` — Zustand 전역 스토어

전체 앱 상태의 단일 소스. 상세는 [§6](#6-zustand-상태-관리-구조).

**exports**: `useGameStore`, `emptyGrid(size?)`, `invKey()`, `DEFAULT_GRID_SIZE`, `ActiveModal`

---

### `src/lib/firebase.ts` — Firebase 초기화
- `db` (Firestore), `auth` (Auth) 인스턴스. 환경변수 `VITE_FIREBASE_*`에서 설정 로드.

### `src/lib/firebaseService.ts` — Firebase CRUD
Auth / 사용자 / 맵 / 풀이 제안 / **기물 config** 전체 Firestore 연산. 상세는 [§10](#10-firebase-연동-구조).

### `src/lib/laserEngine.ts` — 레이저 엔진 (계산/렌더 분리)
- `computeLaser(mapData)`: 순수 계산 — `BeamSegment[]` + 셀별 incidence + 승리 판정(`solved`)
- `drawSegments(ctx, segments, cellSize)`: 캔버스 그리기만
- `simulateLaser(ctx, canvas, mapData)`: 둘을 잇는 래퍼
- 면별 behavior 스키마: `PieceBehaviorDef` / `FaceSpec` / `FaceEffect` (kind: pass/block/absorb/reflect/split/reverse)
- `DEFAULT_DEFS`: 빌트인 29종 코드 기본 def. `setBehaviorOverrides()`로 config 오버라이드 주입
- 접근자: `getBehavior(type)` (미지 타입 → PASSIVE 통과 폴백), `getBehaviorDef()`, `isTargetType()`
- 상세는 [§7](#7-레이저-시뮬레이션-알고리즘)

### `src/lib/pieceConfig.ts` — 기물 config 오버레이
Firestore `config/pieces` 문서를 코드 기본값 위에 머지하는 레이어. 상세는 [§9](#9-기물-config-오버레이-어드민).

**exports**: `loadPieceConfig()`, `applyPieceConfig()`, `resetPieceConfig()`, `getFolders()`, `getPieceFolder()`, `getPieceDefaults()`, `getCustomTypes()`, `isPieceHidden()`, `sanitizeSvg()`, `PALETTE_ORDER`, `DEFAULT_FOLDERS`, `isValidCustomTypeId()` 등

### `src/lib/catalogConfig.ts` — 카탈로그 정의 + 오버레이
Firestore `config/catalog` 문서를 코드 기본값 위에 머지. `pieceConfig.ts` 와 같은 모델 (미존재/손상 시 silent fallback, `loadCatalogConfig()` 는 throw 하지 않는다).
- `CatalogDef`: `id/label/emoji/order/hidden` + `conditions[]`(AND) + `sort` + `limit` + `pinnedMapIds`/`excludedMapIds`
- `CatalogCondition` 13종 — `author`·`reaction`·`difficulty`·`category`·`recent`·`gridSize`·`pieceCount`·`containsPiece`·`titleContains` + **로그인 사용자 기준** `mine`·`played`·`reacted`·`voted`(`USER_CONDITION_KINDS`)
- `DEFAULT_CATALOGS`: 빌트인 5종(추천·원본·최근·명예의전당·내 맵). **직접 읽지 말고 `getCatalogs()`/`getCatalog()` 접근자 사용**
- 손상 방어: 조건 하나가 깨져도 그 조건만 버리고 나머지는 살린다. v1 단일 `rule` 문서는 `conditions`/`sort`/`limit` 로 자동 승격
- **라이브러리(`LibraryScreen`)와 어드민(`CatalogTab`)이 이 정의를 공유한다** — 하드코딩 필터 없음

**exports**: `getCatalogs()`, `getCatalog()`, `getBuiltinCatalog()`, `getCatalogOverrides()`, `getCustomCatalogIds()`, `applyCatalogConfig()`, `loadCatalogConfig()`, `resetCatalogConfig()`, `sanitizeCondition()`, `isBuiltinCatalogId()`, `isValidCatalogId()`, `DEFAULT_CATALOGS`

### `src/lib/catalogRules.ts` — 카탈로그 규칙 평가 (순수)
카탈로그 정의 + 맵 목록 + 사용자 컨텍스트 → 보여줄 맵. 라이브러리와 어드민 미리보기가 같은 함수를 쓴다.
- 평가 순서 **고정**: ① `excludedMapIds` 제거(최우선) → ② `conditions` AND → ③ `pinnedMapIds` 추가 → ④ `sort`(기본 createdAt desc, 고정 맵은 맨 앞) → ⑤ `limit`
- `CatalogContext = { uid, mapStates, now? }`. `mapStates` = `localStorage['ray_map_states']` (`getAllMapStates()`), 키 존재 = 플레이한 맵
- `needsLogin(catalog)` 이 true 인데 비로그인이면 결과가 비고 라이브러리가 "로그인하면 표시됩니다" 를 띄운다
- `category` 조건은 `computeMapCategory()` 재사용 — 기물 폴더가 바뀌면 카탈로그 결과도 바뀐다

**exports**: `selectCatalogMaps()`, `matchesCondition()`, `needsLogin()`, `sortMapsBy()`, `describeCondition()`, `describeCatalog()`

### `src/lib/mapCategory.ts` — 맵 카테고리 (기물 등급 파생)
맵에 쓰인 기물 등급에서 자동 판정하는 값. 작성자가 고르지 않고 `mapData` 에서 계산하므로 DB 필드가 없다.
- 초급만 `basic` / 중급 포함 `logic` / 상급 포함 `advanced` / 중급+상급 `advanced_logic`
- 등급 출처 = `getPieceFolder()` — 어드민이 폴더를 옮기면 카테고리도 바뀐다. 기본 3폴더 밖(커스텀 폴더·커스텀 기물)은 중급 취급
- 인벤토리(유저 지급) 기물도 포함. 빈 맵은 `basic`
- **exports**: `computeMapCategory()`, `getPieceTier()`, `CATEGORY_LABELS`, 타입 `MapCategory`/`PieceTier`
- 색은 `--cat-*` 토큰 + `Pill` 톤 4종(`catBasic`/`catLogic`/`catAdvanced`/`catAdvancedLogic`), 카드 호버 글로우는 `[data-category]` CSS 규칙

### `src/lib/pieceActions.ts` — 기물 조작 + 라벨
PiecePopover / SelectedPieceInfo / useGridDragDrop이 공유하는 조작 함수 모음.
- `rotatePiece()` (rotationStep 반영 — ray/target은 상급 맵에서 45° 동적 규칙), `deletePiece()`, `refundPiece()`, `toggleRotateLock()`, `toggleUserSupply()`, `clearTraits()`
- `PIECE_LABELS` (빌트인 한글 라벨) + `getPieceLabel()` (config 오버라이드 접근자)
- `NON_ROTATABLE` (block, high_block, omni_target — 방향성 없음)

### `src/lib/svgArt.ts` — SVG 아이콘
- `SVG_ART`: 빌트인 29종 인라인 SVG
- `getSvgArt(type)`: config 오버라이드 → 빌트인 → `PLACEHOLDER_SVG`(점선 ?) 순 폴백. **직접 인덱싱 금지, 항상 이 접근자 사용**
- `GRID_SIZE`/`CELL_SIZE`: **레거시 상수** — 런타임은 `mapData.length` 사용. e2e 헬퍼/기본값 호환용으로만 유지

### `src/lib/admin.ts` — 관리자 화이트리스트
- `ADMIN_UIDS` + `isAdminUid()`. **UI 숨김일 뿐 — 실제 권한 강제는 `firestore.rules` `isAdmin()`. 두 목록 반드시 동기화.**

---

### hooks

#### `src/hooks/useAuth.ts`
- `onAuthStateChanged` 구독, 로그인 시 `getUserProfile()` → 닉네임 없으면 NicknameModal 자동 오픈

#### `src/hooks/useTheme.ts`
- 스토어 `theme` → `<html>.dark` 클래스 + localStorage `ray-theme` 동기화 (첫 페인트는 index.html 인라인 스크립트가 처리)

#### `src/hooks/useGridDragDrop.ts`
- Pointer Events 기반 드래그앤드롭 엔진 (마우스+터치 통합). 상세는 [§8](#8-드래그앤드롭-엔진)

#### `src/hooks/useLaserCanvas.ts`
- `setupCanvas()` (dpr 배율 백킹스토어) + ResizeObserver 재설정
- `isLaserOn`/`mapData`/`theme` 변경 시 `simulateLaser()` 또는 `clearLaser()` (레이저 색이 테마 토큰 `--laser`를 따름)

#### `src/hooks/useMapReactions.ts`
- localStorage 키 `ray_map_states` — 맵별 ok/god 반응 + 난이도 투표 상태
- Firebase 낙관적 업데이트, 중복 투표 방지, 로그인 필수

---

### pages

#### `src/pages/EditorPage.tsx` — 메인 L1 셸

```
Header
├── (라이브러리 모드) LibraryScreen
└── (에디터/테스트 모드)
    ├── 좌 존 (lg+): PalettePanel(편집) / TestModeInventory(플레이)
    ├── 중앙: GameBoard (GridContainer + LaserCanvas + PiecePopover)
    ├── 우 존 (lg+): InspectorPanel(편집) / 정답보기 + SelectedPieceInfo
    │                + LoadedMapInfo + RightSidePanel(플레이)
    ├── 모바일(lg 미만): 좌·우 존을 하단 시트 탭(🧰 팔레트·🎒 인벤토리 / ℹ️ 정보)으로
    └── StatusBar
+ 모달 호스트 (Nickname set/change, Upload, Suggestion) + Notification + ConfirmHost
```

- 모바일에서 기물 선택 시 자동으로 '정보' 탭 전환

#### `src/pages/admin/AdminLayout.tsx` — 어드민 셸 (관리자 전용, 비관리자는 `/`로 리다이렉트)
- 관리자 게이트(`isAdminUid`) + 상단바(`← 에디터로`) + 탭 바(`Tabs variant="folder"`) + `Notification`/`ConfirmHost` 를 여기 한 번만 마운트
- 탭 상태는 URL 이 단일 진실: `/admin/:tab` (`pieces` · `mapmaster` · `catalog`). `/admin` 및 알 수 없는 슬러그 → `/admin/pieces` 로 `replace` 리다이렉트
- 새 어드민 기능은 `admin/` 하위에 탭 컴포넌트로 추가하고 `AdminLayout` 의 `TABS` 배열에 등록 (상단바/토스트/확인창을 다시 만들지 말 것)
- ⚠️ 게이트는 UI 숨김일 뿐 — 실제 쓰기 권한 강제는 `firestore.rules`

#### `src/pages/admin/PiecesTab.tsx` — [기물] 탭 (면별 behavior 에디터)
- 좌: 폴더별 기물 목록 — 폴더 CRUD(추가/이름변경/순서/삭제), 기물 드래그로 폴더 할당, 새 커스텀 기물 생성
- 우: 선택 기물 편집 — 라벨/폴더/SVG(미리보기)/배치 기본 특성/면별 효과 그리드(3×3, UI 4종: 통과·정지·반사·분기 + 🎯충족 + 8방향 반사 화살표)/fallback/회전 단위/조건부(트리거 그룹, init, negate)/사출(emit)
- 저장 = Firestore `config/pieces` 머지 → `applyPieceConfig()` 로컬 즉시 재적용
- 삭제: 빌트인 = `hidden` 토글(팔레트 숨김, 복구 가능), 커스텀 = config 엔트리 완전 제거

#### `src/pages/admin/MapMasterTab.tsx` — [맵 마스터] 탭 (서브탭 셸)
- 맵 관련 관리 기능 묶음. 서브탭 바는 `Tabs variant="segment"` (바깥 폴더탭과 구분)
- 서브탭도 URL 이 단일 진실: `/admin/mapmaster/:sub` (`maps` · `stats`). 누락·미지 슬러그 → `maps` 로 `replace`
  (구 `suggestions` 링크도 미지 슬러그로 `maps` 폴백 — 제안 관리는 맵 카드에 흡수됐다)
- 본문은 `MapsTab`/`StatsTab` 을 그대로 렌더

#### `src/pages/admin/{MapsTab,AdminMapRow,MapSuggestionsPanel,MapRotationEditor,BulkRotationModal}.tsx` — [맵·제안 관리] 서브탭
- `MapsTab`: 새로고침 / 제목·작성자 검색 / 정렬(최신·🌟·👍) + 로딩·빈·에러 상태
  - 카드는 `grid xl:grid-cols-2` 2열 — 카드가 가로로 늘어나 비어 보이지 않게. 펼친 카드만 `xl:col-span-2`
  - 체크박스 다중 선택(`목록 전체 선택`/`선택 해제`) + `🎛 일괄 회전` → `BulkRotationModal`
- `AdminMapRow`: 썸네일(`MiniGrid revealRotation`, gridSize 반영) · 제목/id/작성자/authorUid/난이도/생성일/기물 수/반응, 액션 4종
  - 메타 편집(제목≤50·난이도·작성자≤30·설명) → `updateMapInDB()`.
    **열면 좌(요약+폼) / 우(`MapSuggestionsPanel`) 2단** — 구 [제안 관리] 서브탭의 맵 드롭다운을 대체
  - 소유권 이전 → `Modal` + UID 입력(`내 UID 넣기` 버튼) → `updateMapInDB({authorUid})`
  - 영구 삭제 → `requestConfirm(danger)` → `deleteMapWithSuggestions()` (제안 서브컬렉션 먼저 삭제)
- `MapSuggestionsPanel`: 카드 마운트 시 `fetchSuggestionsFromDB(map.id)` → 풀이 썸네일(`revealRotation`)·카테고리 배지·닉네임·코멘트·날짜 + 삭제
- `MapRotationEditor`: NxN 그리드 클릭으로 기물 선택 → ±45/±90 · 절대 각도 지정 → `updateMapInDB({mapData})`.
  `같은 기물 전체에 적용` 체크 시 이 맵 안의 동일 타입 전부에 같은 연산(`applyBulkRotationToItems`)
  **저장된 rotation = 정답 회전이므로 정규화 없이 그대로 저장**, 회전 외 필드는 건드리지 않는다.
- `BulkRotationModal`: 여러 맵 일괄 회전. 스코프(선택한 맵/검색 결과/전체) × 기물 타입 다중 선택
  × 필터(인벤토리 포함·회전 가능만) × 연산(상대 ±45/±90/180 · 절대 지정)
  - 대상 집계·계획은 순수 함수 (`collectPieceTypeCounts`/`planBulkRotation`) — 실제로 바뀌는 맵만 저장
  - 적용 전 `requestConfirm(danger)`, 맵 단위 순차 저장 + 진행률, 실패는 맵별로 모아 모달에 표시
- 서버 쓰기 성공 후 `useAdminMaps` 의 `patchMap`/`removeMap` 으로 목록만 갱신 (전체 재조회 없음)

#### `src/pages/admin/StatsTab.tsx` — [통계] 서브탭
- `computeMapStats()` 결과 렌더 — 전체/👍/🌟 카드, 난이도 분포, God·Ok Top 5 표. 별도 조회 없음(공유 목록 사용)

#### `src/pages/admin/CatalogTab.tsx` — [카탈로그] 탭
- 3열 레이아웃 (`xl` 이상): 좌 목록 / 중 편집 / 우 미리보기
- 좌: **빌트인 / 커스텀 접이식 섹션**, 항목별 `↑↓` 순서 변경, `➕ 새 카탈로그`
- 중: 메타(이름·이모지·순서·노출) + `CatalogRuleEditor`(조건 카드 AND / 정렬 / 상위 N) + `CatalogCurationPanel`(고정·제외 맵)
- 우: `CatalogPreviewPanel` — 편집 중 정의로 `selectCatalogMaps()` 실행. 매칭 수 + **전체 결과** 썸네일 그리드
  (순위 번호·📌 고정 표시·난이도·작성자·gridSize·반응), `내 계정 기준으로 평가` 토글.
  `xl` 미만에서는 같은 패널이 편집 폼 아래로 내려온다 (`xl:hidden` / `hidden xl:flex` 한 쌍)
- 저장 = `saveCatalogEntry()` → `applyCatalogConfig()` 로컬 재적용 → `bumpCatalogConfigRev()` → 라이브러리 즉시 반영
- 빌트인: 전체 편집·숨김 가능, **삭제 불가** — `↩ 기본값으로`(config 엔트리 삭제). 커스텀: 삭제 가능
- 큐레이션 맵 선택은 `MapPickerModal` (어드민 맵 목록 + `filterMaps()` 재사용)

---

### components 주요 사항

- **`ui/`**: 토큰 기반 공용 프리미티브. 새 UI는 반드시 이걸로 조립 (`Button`, `IconButton`, `Field` 4종, `Modal`, `ConfirmModal`/`ConfirmHost`, `Pill`, `Tabs`). `ConfirmHost`는 스토어 `confirmState`를 렌더 — 네이티브 `confirm` 대체.
- **`GridCell`**: `data-row`/`data-col`로 DnD 식별. 특성 배지 — 🎒 유저지급, 🔒 유저지급+회전불가, 🔄 고정+회전가능.
- **`PiecePopover`** (데스크탑) / **`SelectedPieceInfo`** (인스펙터·모바일 공용): 같은 `pieceActions`를 호출하므로 자동 동기화.
- **`PalettePanel`**: 폴더 탭은 config(`getFolders`/`getPieceFolder`) 연동, hidden 기물 제외, 커스텀 기물 포함. 특성 덧칠 칩 3종(🔄/🔒/🎒)은 상호 배타 규칙 있음. JSON 가져오기/내보내기, 맵 등록(신규일 때만).
- **`LibraryScreen`**: 카탈로그 내비/그리드. **정의·필터는 전부 `lib/catalogConfig` + `lib/catalogRules`** (하드코딩 없음). 정렬 셀렉트에서 `카탈로그 기본 정렬` 이 기본이고, 사용자가 다른 정렬을 고르면 그 세션 동안 카탈로그 `sort` 를 덮어쓴다. 검색 시 카탈로그 무시 전체 부분일치. 카드 클릭 → 우 존/하단 시트 미리보기 → ▶ 플레이.
- **`UploadModal`**: 신규 업로드 시 공유 URL 자동 클립보드 복사 + 업로드된 맵 즉시 플레이 로드. 수정 시 `version` +1. `canRotate=true` 기물도 작성자가 맞춘 회전값(=정답)을 그대로 저장 — 은닉은 로드 시 `loadMapForPlay`/`MiniGrid`가 담당.
- 기물 SVG를 렌더하는 컴포넌트는 `useGameStore(s => s.pieceConfigRev)` 구독으로 config 갱신 시 리렌더.

---

## 4. 태스크 → 파일 매핑 인덱스

| 태스크 | 주 파일 | 보조 파일 |
|--------|--------|----------|
| **새 빌트인 기물 추가** | `types/game.ts` (PieceType), `lib/laserEngine.ts` (DEFAULT_DEFS) | `lib/svgArt.ts` (SVG_ART), `lib/pieceActions.ts` (PIECE_LABELS), `lib/pieceConfig.ts` (BASIC/INTERMEDIATE/ADVANCED 배열), `tests/` |
| **커스텀 기물 / 기물 동작 런타임 수정** | (코드 수정 불필요) `/admin` 어드민 페이지 | `lib/pieceConfig.ts`, `pages/admin/PiecesTab.tsx` |
| **레이저 반사/기물 동작 로직 수정** | `lib/laserEngine.ts` (PieceBehaviorDef, applyEffect, trace) | `tests/laserEngine.test.ts`, `tests/groupA/B.test.ts` |
| **펜/필기 오버레이** | `components/game/PenLayer.tsx` (별도 캔버스, 방사형 메뉴, 획 로컬 state) | `components/game/GameBoard.tsx` (테스트 모드 마운트·key), `styles/global.css` (`--pen-*`, pen-radial-pop) |
| **레이저 렌더 스타일 변경** | `lib/laserEngine.ts` (drawSegments) | `styles/global.css` (`--laser` 토큰), `lib/artClip.ts` (빔 끝점 아트 클리핑) |
| **승리 판정 / 타겟 카운트** | `lib/laserEngine.ts` (computeLaser, isTargetType) | `components/layout/StatusBar.tsx`, `components/layout/InspectorPanel.tsx` |
| **드래그앤드롭 버그** | `hooks/useGridDragDrop.ts` | `store/gameStore.ts` (setCell, swapCells), `components/game/GridCell.tsx` |
| **셀 클릭/회전/삭제 동작** | `lib/pieceActions.ts` | `hooks/useGridDragDrop.ts` (onContextMenu/onPointerUp), `components/game/PiecePopover.tsx`, `components/game/SelectedPieceInfo.tsx` |
| **Undo/Redo** | `store/gameStore.ts` (saveUndoSnapshot, undo) | `hooks/useGridDragDrop.ts` (Ctrl+Z), `components/layout/StatusBar.tsx` |
| **인벤토리 시스템** | `store/gameStore.ts` (invKey, buildInventory, adjustInventoryCount, refundToInventory) | `hooks/useGridDragDrop.ts`, `components/palette/TestModeInventory.tsx` |
| **에디터↔테스트/맵수정 모드 전환** | `store/gameStore.ts` (toggleMode, loadMapForPlay, enter/exitMapEditMode) | `components/layout/Header.tsx`, `components/library/LoadedMapInfo.tsx` |
| **정답 보기** | `store/gameStore.ts` (showAnswer, hideAnswer) | `pages/EditorPage.tsx` (버튼) |
| **특성 덧칠(canMove/canRotate/isInventory)** | `hooks/useGridDragDrop.ts` (paintTargetRef, onPointerUp) | `store/gameStore.ts` (setModRotatable/Lock/Inv), `components/palette/PalettePanel.tsx` (ModChip) |
| **그리드 크기(5~9) 동작** | `store/gameStore.ts` (setGridSize) | `components/layout/InspectorPanel.tsx`, `tests/gridSize.test.ts` |
| **맵/제안/통계 어드민 UI** | `pages/admin/MapsTab.tsx`·`AdminMapRow.tsx`·`MapSuggestionsPanel.tsx`·`MapRotationEditor.tsx`·`BulkRotationModal.tsx`·`StatsTab.tsx` | `lib/adminMaps.ts` (순수 로직), `pages/admin/useAdminMaps.ts`, `lib/firebaseService.ts` |
| **기물 어드민 UI** | `pages/admin/PiecesTab.tsx` | `lib/pieceConfig.ts`, `lib/firebaseService.ts` (savePieceConfig*) |
| **기물 config 검증/머지/폴백** | `lib/pieceConfig.ts` | `tests/pieceConfig.test.ts`, `lib/laserEngine.ts`/`svgArt.ts`/`pieceActions.ts` (set*Overrides) |
| **라이브러리 카탈로그(구 카테고리)** | `lib/catalogConfig.ts` (정의·스키마), `lib/catalogRules.ts` (평가) | `pages/admin/CatalogTab.tsx`·`CatalogRuleEditor.tsx`·`CatalogCurationPanel.tsx`·`CatalogPreviewPanel.tsx`·`MapPickerModal.tsx`, `components/library/LibraryScreen.tsx`, `tests/catalogConfig.test.ts`·`catalogRules.test.ts` |
| **관리자 권한** | `lib/admin.ts` (ADMIN_UIDS) + `firestore.rules` (isAdmin) — **동시 수정** | `components/layout/Header.tsx`, `pages/admin/AdminLayout.tsx` |
| **Firebase 데이터 구조 변경** | `lib/firebaseService.ts` | `types/game.ts`, `store/gameStore.ts`, `firestore.rules` |
| **Firestore 보안 규칙** | `firestore.rules` (실배포 별도 필요) | `lib/admin.ts` |
| **Google 로그인** | `lib/firebaseService.ts` (signInWithGoogle — 팝업 실패 시 리다이렉트 폴백) | `hooks/useAuth.ts` |
| **닉네임 로직** | `lib/firebaseService.ts` (create/updateUserNickname) | `components/modals/NicknameModal.tsx`, `hooks/useAuth.ts` |
| **맵 반응(✅/👍)·난이도 투표** | `hooks/useMapReactions.ts` | `lib/firebaseService.ts`, `components/library/LoadedMapInfo.tsx` |
| **맵 카테고리(Basic/Logic/Advanced)** | `lib/mapCategory.ts` | `components/library/MapCategoryBadge.tsx`, `styles/global.css` (`--cat-*`, `[data-category]` 글로우), `components/ui/Pill.tsx`, `tests/mapCategory.test.ts` |
| **라이브러리 UI/카탈로그 표시** | `components/library/LibraryScreen.tsx` | `MapCard.tsx`, `MiniGrid.tsx` |
| **다음 문제 추천** | `components/library/NextMapPanel.tsx` | `components/library/RightSidePanel.tsx` |
| **풀이 제안** | `components/library/SuggestionPanel.tsx`, `components/modals/SuggestionModal.tsx` | `lib/firebaseService.ts` (suggestions) |
| **맵 업로드/수정** | `components/modals/UploadModal.tsx` | `store/gameStore.ts` (patchCurrentLoadedMap, exitMapEditMode) |
| **팔레트 폴더/표시** | `components/palette/PalettePanel.tsx` | `lib/pieceConfig.ts` (getFolders, PALETTE_ORDER, isPieceHidden) |
| **새 모달 추가** | `store/gameStore.ts` (ActiveModal, openModal) | `pages/EditorPage.tsx` (호스트), `components/ui/Modal.tsx` |
| **확인 다이얼로그** | `store/gameStore.ts` (requestConfirm/resolveConfirm) | `components/ui/ConfirmHost.tsx` |
| **토스트 알림** | `components/layout/Notification.tsx` | `store/gameStore.ts` (showNotification) |
| **다크모드/테마/색** | `styles/global.css` (토큰), `tailwind.config.js` | `hooks/useTheme.ts`, `index.html` (첫 페인트 스크립트) |
| **헤더** | `components/layout/Header.tsx` | `store/gameStore.ts` |
| **JSON 가져오기/내보내기** | `components/palette/PalettePanel.tsx` | `types/game.ts` (MapItemDTO) |
| **URL 기반 맵 로드 / 라우팅** | `src/App.tsx` | `public/404.html`, `index.html` (SPA 폴백) |
| **단위 테스트 추가** | `tests/*.test.ts` | `vitest.config.ts` |
| **E2E 테스트 추가** | `e2e/helpers.ts` | `e2e/*.spec.ts`, `playwright.config.ts` |
| **배포 설정** | `.github/workflows/deploy.yml` | `vite.config.ts` (base) |
| **맵/제안 일괄 관리** | `/admin/mapmaster` (React 어드민) | `ADMIN.html` 은 레거시 백업 — 새 기능은 React 쪽에만 |
| **기물 SVG 아이콘 제작/수정** | `PIECE_EDITOR.html` (독립 툴) | `src/lib/svgArt.ts` (SVG_ART), 어드민 기물 config |

---

## 5. 핵심 데이터 모델

### PieceType — 빌트인 29종

```
기본:        ray(발사기), target(표적), block, tunnel
직각 거울:   mirror, half_mirror, single_mirror, target_mirror_a/b
45도 거울:   mirror_45, half_mirror_45, diag_single_mirror_a/b
수직 거울:   v_mirror, v_half_mirror, v_single_mirror, v_target_mirror_a/b

Group A (무상태 기믹):
  diode(일방터널), v_mirror_double(수직 양면거울), v_half_mirror_double,
  small_target(소형 표적), omni_target(전방위 표적), high_block(완전 차단)

Group B (조건부/상태형 — 고정점 루프):
  transistor_gate(관문), cross_gate(교차 관문 AND), priority_gate(우선순위 관문),
  target_projector(표적 프로젝터), inverting_projector(반전 프로젝터)
```

여기에 어드민 config가 정의한 **커스텀 기물**(slug id, `AnyPieceType = string`)이 런타임에 추가될 수 있다.

**팔레트 은퇴 기물** (maker 결정 — `pieceConfig.ts` ADVANCED 배열에서 제외, 엔진 def/SVG/라벨은 기존 맵 호환 위해 유지):
`diag_single_mirror_a/b`, `v_target_mirror_a/b`, `v_mirror`(중급 수직 양면거울과 중복).

### CellData

```ts
interface CellData {
  type: AnyPieceType;
  rotation: Rotation;   // 0|45|90|135|180|225|270|315
  canMove: boolean;     // 테스트 모드 이동 가능 (isInventory에 종속)
  canRotate: boolean;   // 클릭/우클릭 회전 가능
  isInventory: boolean; // 유저지급 — 테스트 전환 시 그리드에서 분리되어 인벤토리로
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
  gridSize?: number;     // 균일 NxN. 없으면 5 (하위호환)
  reactionOk: number;
  reactionGod: number;
  diffVotes: Partial<Record<Difficulty, number>>;
  createdAt: string;     // ISO 8601
  version: number;       // 수정 시 +1
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

회전 가능 기물은 rot=0으로 통일 → 다른 회전 값이어도 같은 인벤토리 슬롯.

---

## 6. Zustand 상태 관리 구조

`src/store/gameStore.ts` — `useGameStore` 훅으로 접근.

성능: 부분 구독 시 `useShallow()` 필수. 이벤트 핸들러 내부: stale closure 방지 위해 `useGameStore.getState()` 직접 호출.

### 상태 분류

| 그룹 | 상태 | 설명 |
|------|------|------|
| 그리드 | `mapData` | NxN `(CellData\|null)[][]` — **길이가 그리드 크기의 소스 오브 트루스** |
| 그리드 | `gridSize` | 표시용 미러 (setMapData가 data.length로 동기화) |
| 그리드 | `playerInventory` | `Record<invKey, InventoryItem>` |
| 그리드 | `undoStack` | `GameSnapshot[]` (최대 50) |
| 에디터 | `isEditorMode` / `isMapEditMode` | 편집 / 로드된 맵 수정 중 |
| 에디터 | `selectedTool` | 선택 툴 (palette/grid/inventory) |
| 에디터 | `selectedCell` | 선택 셀 → PiecePopover/SelectedPieceInfo 표시 |
| 에디터 | `editorMapDataBackup` / `editorInventoryBackup` | 에디터→테스트 전환 시 원본 보존 |
| 에디터 | `mapEditOriginalBackup` | 맵 수정 취소(restore)용 백업 |
| 정답 | `isAnswerShown`, `answerMapBackup`, `answerInventoryBackup` | 정답 보기 토글 |
| 덧칠 | `isModRotatableActive` / `isModLockActive` / `isModInvActive` | 특성 부여 페인터 |
| 레이저 | `isLaserOn` | 레이저 표시 여부 |
| 라이브러리 | `isLibraryMode`, `allLibraryMaps`, `currentLoadedMapObj`, `currentLoadedMapAuthorUid`, `currentMapReactions`, `suggestions` | |
| 인증 | `currentUserUid`, `currentUserNickname` | |
| UI | `notification`, `activeModal`, `theme`, `confirmState`, `pieceConfigRev` | |

### 주요 액션 흐름

**에디터 → 테스트** (`toggleMode()`):
1. `editorMapDataBackup`/`editorInventoryBackup` 저장
2. `isInventory=true` 셀을 그리드에서 제거 → `buildInventory()`로 `playerInventory` 구성
3. undo/선택 상태 초기화

**라이브러리/URL/다음문제 맵 로드** (`loadMapForPlay(grid, mapDoc)`):
- 단일 `set()`으로 원자적 업데이트 (중간 상태 방지). `gridSize = grid.length`, `isLaserOn: true` 자동.
- 플레이 그리드의 `canRotate && !isInventory` 기물은 `normalizePlayCell`이 rotation 0으로 정규화(정답 회전 은닉). `editorMapDataBackup`은 원본 유지 — 맵 수정 저장이 이 원본을 DB로 보낸다.

**맵 수정 모드** (`enterMapEditMode()` / `exitMapEditMode({restore?})`):
- 진입: 풀 그리드(인벤 포함) 복원 + `mapEditOriginalBackup` 저장
- 종료: 수정본(또는 restore 시 백업)을 다시 플레이 상태로 분해

**그리드 리사이즈** (`setGridSize(size)`):
- 에디터 모드 전용. 겹치는 영역 보존, 범위 밖 기물 삭제, undo 스택 비움 (크기 불일치 방지).

**확인 다이얼로그** (`requestConfirm(opts): Promise<boolean>`):
- resolver는 모듈 변수 보관. `ConfirmHost`가 `confirmState`를 렌더. 네이티브 `window.confirm` 대체.

**정답 보기** (`showAnswer()`):
- 현재 플레이 상태 백업 후 `currentLoadedMapObj.mapData`(원본 정답)를 그리드에 적용. 플레이 그리드 정규화(`normalizePlayCell`)와 무관하게 원본 DTO를 읽으므로 정답 회전 복원은 무손상.

---

## 7. 레이저 시뮬레이션 알고리즘

`src/lib/laserEngine.ts` — 계산(순수)과 렌더(캔버스) 분리.

### 방향 벡터

```
0°  → 오른쪽 (dx:1, dy:0)    90° → 아래 (dx:0, dy:1)
180°→ 왼쪽                    270°→ 위
45/135/225/315° → 대각선
```

Ray 피스의 출발 방향: `(rotation + 270) % 360`. 프로젝터 사출: `(rotation + emit.fromRel) % 360`.

### 면별(per-face) behavior 스키마

```ts
interface PieceBehaviorDef {
  faces: Partial<Record<number, FaceSpec>>; // rel(입사방향-회전, 45단위) → 효과
  fallback: FaceSpec;                        // 미지정 방향
  rotationStep: 45 | 90;
  conditional?: { init: boolean; groups: number[][]; negate?: boolean };
  emit?: { fromRel: number; whenActive: boolean };
}
// FaceEffect.kind: pass | block(표면차단, partial) | absorb(흡수) |
//                  reflect(면각 반사) | split(통과+반사) | reverse(180° 되돌림)
// satisfy: true → 표적 충족. isTarget은 satisfy 존재로 자동 파생.
// FaceSpec은 단일 효과 또는 { open, closed } (조건부 기물의 활성/비활성 분기)
```

`buildBehavior(def)`가 `interact(inDir, cell, active)` 함수로 컴파일. `getBehavior(type)`는 캐시 + config 오버라이드 + 미지 타입 PASSIVE(통과) 폴백.

### 반사 공식

```ts
calculateReflection(inDir, surfaceAngle) = (2 * surfaceAngle - inDir + 720) % 360
// surfaceAngle은 기물 기준 — cell.rotation이 더해진다
```

### 시뮬레이션 (trace 1패스 + 고정점 루프)

```
trace(mapData, states):  # states = 조건부 기물 활성 맵
  빔 소스 = ray 기물 + (사출 조건 충족한) 프로젝터
  BFS: 빔 큐 → 다음 셀 → interact() → outDirs 빔 추가
  방문 키 "x,y,dir" Set으로 무한루프 방지
  incidence(셀별 입사 방향 + satisfied) 기록

computeLaser(mapData):
  조건부 기물 수집, init 상태로 1패스
  고정점 반복 (MAX_ITERS=8): 직전 패스 incidence로 상태 재평가 → 수렴 시 종료
  미수렴(진동) 시 전부 OFF 강제 후 최종 1패스 → 결정적 종결
  승리 판정: isTarget 기물 전부 satisfied → solved
```

조건부 판정: `groups` 각 그룹에서 ≥1 면 피격(OR)이고 모든 그룹 충족(AND) 시 활성. `negate`면 반대(나열 면 전부 미피격일 때 활성 — 반전 프로젝터).

### 렌더

- `setupCanvas()`: 컨테이너가 CSS 크기 결정, 백킹스토어만 dpr 배율
- `drawSegments()`: 색은 `--laser` 토큰(테마 추종), `partial` 세그먼트는 셀 경계(중간점)까지만

---

## 8. 드래그앤드롭 엔진

`src/hooks/useGridDragDrop.ts` — **Pointer Events** 기반 (마우스+터치 통합, `e.isPrimary`만, `pointercancel` 취소 처리).

### 핵심 Refs

| Ref | 역할 |
|-----|------|
| `dragSourceRef` | 드래그 시작 정보 (origin: palette/grid, 좌표, justPlaced) |
| `ghostRef` | 커서 따라다니는 SVG 고스트 |
| `paintTargetRef` | 특성 덧칠 모드의 타겟 셀 |
| `lastActiveToolRef` | 그리드 조작 후 팔레트/인벤토리 선택 복원용 |

### 이벤트 흐름

```
pointerdown (셀)
├── 기물 있는 셀
│   ├── 테스트 모드 + 이동/회전 모두 불가 → 무시
│   ├── 에디터 + 덧칠 모드 활성 → paintTarget 기록 (pointerup에서 적용)
│   └── 그 외 → 든 도구 보관·해제 후 grid 드래그 시작
├── 빈 셀 + 인벤토리 도구 (테스트) → 즉시 배치 (count -1, justPlaced)
└── 빈 셀 + 팔레트 도구 (에디터) → palette 드래그 시작

pointermove → 고스트 이동 (테스트 모드 canMove=false 기물은 고스트 없음 — 제자리 회전용)

pointerup
├── 덧칠 타겟 있음 → 특성 적용 (인벤 축/회전 축 독립, 재덧칠 시 토글)
├── 그리드 밖 드롭 → 에디터: 삭제 / 테스트: isInventory 기물 환수
├── 같은 셀 클릭
│   ├── 도구를 들고 있었음 → 도구만 해제 (기물 안 건드림)
│   └── 빈손 → setSelectedCell → 팝오버(데스크탑)/인스펙터(모바일)
├── 다른 셀 → swapCells (테스트 모드는 양쪽 canMove 체크)
└── palette → 배치 (덧칠 미사용 시 config 기본 특성 getPieceDefaults() 적용) + 자동 선택

contextmenu (우클릭) → rotatePiece() (삭제 아님 — 삭제/회수는 팝오버·인스펙터)
keydown Ctrl/Cmd+Z → undo() (입력 필드 포커스 시 무시)
```

### 테스트 모드 제약

- `canMove=false`: 이동 불가 (회전만), `canRotate=false`: 회전 불가
- 인벤토리 배치 시 `adjustInventoryCount(-1)`, 제거 시 `refundToInventory()`

---

## 9. 기물 config 오버레이 (어드민)

`src/lib/pieceConfig.ts` + `pages/admin/PiecesTab.tsx` + Firestore `config/pieces` 문서.

```
Firestore config/pieces ──fetchPieceConfig()──▶ applyPieceConfig(raw)  [순수, 검증]
                                                   │
                       ┌───────────────────────────┼─────────────────────────┐
                       ▼                           ▼                         ▼
         setBehaviorOverrides()          setSvgOverrides()         setLabelOverrides()
           (laserEngine.ts)                 (svgArt.ts)             (pieceActions.ts)
                       +  폴더/defaults/hidden/커스텀 타입은 pieceConfig 모듈 캐시
                       ▼
            store.bumpPieceConfigRev() → SVG/라벨 렌더 컴포넌트 리렌더
```

- **빌트인**: 코드 기본값 위 부분 머지. **커스텀**: config-only — `behavior`+`svg` 둘 다 있어야 등록(아니면 skip).
- 검증: behavior 스키마(`isValidDef`), 폴더 id(slug ≤48자), 커스텀 id(slug ≤32자, 빌트인 충돌 금지). 손상 엔트리는 통째로 무시 — **코드 기본값 100% 보존, 절대 throw 안 함**.
- **`sanitizeSvg()`**: config SVG는 전 플레이어에 innerHTML 렌더 → script/foreignObject/on핸들러/javascript: URI 제거 (저장형 XSS 방어).
- 폴더: 기본 3폴더(초급/중급/상급)는 삭제돼도 `getFolders()`가 재생성 보장. 레거시 `tab` 필드는 `folderId`로 읽음(하위호환).
- 빌트인 "삭제" = `hidden: true` (팔레트 숨김만 — 맵에 놓인 기물은 계속 동작, 복구 가능).
- 미지 타입 안전망: `getSvgArt` → PLACEHOLDER(점선 ?), `getBehavior` → PASSIVE(통과), `getPieceLabel` → type 문자열 그대로.

---

## 10. Firebase 연동 구조

### Firestore 컬렉션

```
config/
  pieces                  # 기물 config 오버레이 (version, folders[], pieces{})
                          # 읽기: 전체 공개 / 쓰기: 관리자만 (firestore.rules)
  catalog                 # 라이브러리 카탈로그 오버레이 (version, catalogs{})
                          # 같은 규칙 적용 — config/{docId} 매칭. 현재 읽기 전용 사용

users/{uid}               # nickname, createdAt

maps/{mapId}              # MapDocument (§5) — gridSize?, version 포함
  suggestions/{sugId}     # category('NG'|'ABCD'), comment, suggesterUid/Nickname,
                          # mapData, createdAt
```

### 보안 규칙 (`firestore.rules`)

- `isAdmin()`: UID 화이트리스트 — **`src/lib/admin.ts` ADMIN_UIDS와 동기화 필수** (클라이언트 목록은 UI 숨김일 뿐)
- maps: 읽기 공개 / 생성 로그인 / 수정 = 관리자(전체) ∨ 소유자(authorUid 변경 불가) ∨ 로그인 사용자(반응·투표 카운터만) / 삭제 = 관리자 ∨ 소유자
- suggestions: 생성은 본인 UID로만(사칭 방지), 수정 불가, 삭제 = 관리자 ∨ 제안자 ∨ 맵 소유자
- users: 본인만 생성/수정
- 배포: `firebase deploy --only firestore:rules` (레포 커밋만으로는 미적용)

### 함수 목록 (`lib/firebaseService.ts`)

| 함수 | 설명 |
|------|------|
| `signInWithGoogle()` | Google 팝업 로그인 (팝업 차단 시 리다이렉트 폴백) |
| `signOutUser()` / `initRedirectResultHandler()` | 로그아웃 / 리다이렉트 결과 처리 |
| `getUserProfile(uid)` / `createUserProfile()` / `updateUserNickname()` | 사용자 프로필 |
| `uploadToDB(data)` | 새 맵 업로드, 생성 ID 반환 |
| `fetchFromDB(id)` | 맵 단건 조회 |
| `fetchLibraryList(sortBy)` | 맵 목록 (최대 50, createdAt 또는 reactionGod 정렬) |
| `updateMapReactionsInDB(id, type, ±1)` | 반응 카운터 increment |
| `updateMapDifficultyVoteInDB(id, old, new)` | 난이도 투표 변경 |
| `updateMapInDB(id, data)` / `deleteMapFromDB(id)` | 맵 수정/삭제 |
| `uploadSuggestionToDB()` / `fetchSuggestionsFromDB()` / `deleteSuggestionFromDB()` | 풀이 제안 |
| `fetchPieceConfig()` | `config/pieces` 문서 조회 |
| `fetchCatalogConfig()` | `config/catalog` 문서 조회 |
| `saveCatalogEntry(id, entry)` / `deleteCatalogEntry(id)` / `saveCatalogPatch(patch)` | 카탈로그 저장/삭제/일괄 패치 (read-modify-write) |
| `fetchAllMapsForAdmin()` | 어드민 맵 목록 (createdAt desc, limit 없음) |
| `deleteMapWithSuggestions(id)` | 제안 서브컬렉션 삭제 후 맵 삭제 (어드민 영구 삭제) |
| `savePieceConfigEntry(type, entry)` | 기물 1개 엔트리 머지 저장 |
| `deletePieceConfigEntry(type)` | 기물 엔트리 삭제 (기본값 복원) |
| `savePieceConfigPatch(patch)` | 임의 부분 패치 (폴더 교체, 일괄 folderId 등) |

---

## 11. 테스트 구조

### 단위 테스트 (Vitest, `tests/`)

`npm run test` — 캔버스 없이 `computeLaser`/스토어/config 순수 로직 검증.

| 파일 | 커버리지 |
|------|---------|
| `laserEngine.test.ts` | calculateReflection, 기본 빔, 거울(골든 케이스), 승리 판정, NxN 그리드 |
| `groupA.test.ts` | diode, v_mirror_double, v_half_mirror_double, small_target, omni_target, high_block |
| `groupB.test.ts` | transistor/cross/priority gate, target/inverting projector (고정점 루프) |
| `gridSize.test.ts` | emptyGrid(size), setGridSize 확대/축소, 테스트 모드 리사이즈 불가 |
| `pieceConfig.test.ts` | behavior/svg/label/defaults 오버라이드, 커스텀 타입, 폴더, hidden, 손상 config 방어, 접근자 폴백 |
| `catalogConfig.test.ts` | 카탈로그 기본값 5종, label/order/hidden 오버라이드, 커스텀 카탈로그, 조건 13종 sanitize, sort/limit, 레거시 rule 승격, 손상 config 폴백 |
| `catalogRules.test.ts` | 조건별 매칭(맵 속성·로그인 사용자), AND 조합, 고정/제외 우선순위, 정렬·limit, 빌트인 5종 회귀 |
| `adminMaps.test.ts` | filterMaps/sortMaps(3키·누락 필드), computeMapStats(합계·분포·Top5), rotateMapItem/setMapItemRotation(랩어라운드·불변), collectPieceTypeCounts/applyBulkRotationToItems/planBulkRotation(타입 집계·필터·정규화·원본 불변) |
| `mapCategory.test.ts` | 4종 판정 규칙, 빈 맵, 인벤토리 포함, 미지 기물, 어드민 폴더 이동 반영 |
| `loadMapForPlay.test.ts` | 플레이 로드 회전 정규화(normalizePlayCell), editorMapDataBackup 원본 보존, showAnswer/hideAnswer |
| `penUndo.test.ts` | GameSnapshot.penStrokes — 획 커밋/전체지우기 undo, 기물·펜 혼합 순서, 모드 전환 초기화 |
| `mapEditSave.test.ts` | getAuthoredGrid — 테스트 상태 저장/exitMapEditMode(restore:false) 시 인벤토리 기물 보존 |

### E2E 테스트 (Playwright, `e2e/`)

**Chrome headless** | webServer: `npm run dev` 자동 기동 | 스토어 접근: `window.__rayStore` (DEV 전용)

| 파일 | 테스트 대상 |
|------|------------|
| `helpers.ts` | makeMapDoc 픽스처, waitForGrid, loadPlayMap, cellCenter, getCell, getInvCount, getSelectedTool |
| `inventory.spec.ts` | 인벤토리 배치 시 count 감소, 팝오버 회수 버튼으로 환수 |
| `rotation.spec.ts` | 우클릭 회전, 팝오버 회전 버튼, canRotate=false 제약, canMove 드래그 이동 |
| `map-switch.spec.ts` | 맵 전환 원자성 (currentLoadedMapObj/mapData/isLaserOn/selectedTool) |
| `palette-leak.spec.ts` | 모드 전환 시 팔레트 도구 누수 방지 |
| `piece-popover.spec.ts` | 도구 해제 우선, 유저지급/특성삭제/기물삭제, Esc 닫기 |

```bash
npm run test:e2e                    # 전체
npx playwright test inventory       # 특정 파일
npx playwright test --debug         # 디버그 (브라우저 열림)
npx playwright show-report          # 리포트
```

---

*최초 작성: 2026-05-28 · 전면 갱신: 2026-06-11 (어드민/기물 config, NxN 그리드, 기믹 기물, UI 리디자인 반영)*
