# CLAUDE.md — RayTracer

AI 에이전트/작업자를 위한 메인터넌스 지침. 구조·파일별 상세는 `PROJECT_HIERARCHY.md` 참조.

## 프로젝트 한 줄 요약

**Project Ray** — 레이저 반사 퍼즐 에디터 + 플레이어. 거울/게이트 등 기물을 NxN(5~9) 그리드에 배치해 레이저를 표적에 맞추는 퍼즐을 만들고 Firebase로 공유한다.
React 18 + TypeScript + Vite + Zustand + Tailwind + Firebase(Firestore/Auth). GitHub Pages 배포 (`base: /RayTracer/`).

## 명령어

```bash
npm run dev        # 개발 서버 (localhost:5173)
npm run build      # tsc -b + vite build
npm run test       # Vitest 단위 테스트 (tests/)
npm run test:e2e   # Playwright E2E (e2e/, dev 서버 자동 기동)
npm run lint       # ESLint
```

## 아키텍처 핵심 (코드 수정 전 반드시 이해)

- **상태는 전부 `src/store/gameStore.ts`** (Zustand 단일 스토어). 부분 구독은 `useShallow()` 필수, 이벤트 핸들러 안에서는 stale closure 방지를 위해 `useGameStore.getState()` 직접 호출.
- **그리드 크기는 `mapData.length`에서 유도** (NxN, 5~9). `svgArt.ts`의 `GRID_SIZE`/`CELL_SIZE`는 레거시 상수 — 런타임 로직에 쓰지 말 것. `MapDocument.gridSize`는 optional (없으면 5, 하위호환).
- **레이저 엔진(`src/lib/laserEngine.ts`)은 계산/렌더 분리.** `computeLaser()`는 순수 함수(캔버스 없이 단위테스트 가능), `drawSegments()`가 그리기만, `simulateLaser()`는 래퍼. 기물 동작은 면별(per-face) 선언 스키마 `PieceBehaviorDef`로 정의하고 `buildBehavior()`가 컴파일. 조건부 기물(게이트/프로젝터)은 고정점 루프(MAX_ITERS=8)로 수렴시키고, 미수렴 시 전부 OFF 강제로 결정적 종결.
- **라이브러리 카탈로그는 `src/lib/catalogConfig.ts`(정의) + `catalogRules.ts`(평가) 단일 소스.** Firestore `config/catalog` 오버레이, 빌트인 5종은 삭제 불가(숨김만). 라이브러리·어드민이 같은 `selectCatalogMaps()` 를 쓴다 — 화면에서 필터를 다시 구현하지 말 것. 적용 후 UI 갱신은 `bumpCatalogConfigRev()`.
- **기물 config 오버레이(`src/lib/pieceConfig.ts`)**: Firestore `config/pieces` 문서를 코드 기본값(`DEFAULT_DEFS`, `SVG_ART`, `PIECE_LABELS`) 위에 머지. config 미존재/손상 시 코드 기본값으로 silent fallback — `loadPieceConfig()`는 절대 throw 금지. 적용 후 UI 갱신은 `bumpPieceConfigRev()`.
- **기물 타입 접근은 항상 안전 접근자 사용**: `getSvgArt()` / `getBehavior()` / `getPieceLabel()` / `getPieceDefaults()`. `SVG_ART[type]` 직접 인덱싱 금지 — 커스텀/삭제된 기물에서 깨진다. 미지 타입은 PLACEHOLDER SVG + 통과(PASSIVE) 동작으로 폴백.
- **드래그앤드롭은 Pointer Events 기반** (`src/hooks/useGridDragDrop.ts`, 마우스+터치 통합). 우클릭 = 회전, 좌클릭(기물) = 선택 → 팝오버/인스펙터. 기물 조작 로직은 `src/lib/pieceActions.ts`에 모여 있다 (PiecePopover와 SelectedPieceInfo가 공유).

## 불변 규칙

- **`src/lib/admin.ts`의 `ADMIN_UIDS`와 `firestore.rules`의 `isAdmin()` UID 목록은 반드시 동기화.** 클라이언트 목록은 UI 숨김일 뿐이고 실제 권한 강제는 firestore.rules가 전부다. rules 수정 후 실배포(`firebase deploy --only firestore:rules`)는 메이커 액션.
- **config의 SVG는 전 플레이어에게 innerHTML로 렌더된다** — config 경유 SVG는 반드시 `sanitizeSvg()`를 거친다(저장형 XSS 방어). 새 SVG 주입 경로를 추가하면 같은 새니타이즈를 적용할 것.
- **확인 다이얼로그는 `requestConfirm()`** (스토어) — 네이티브 `window.confirm` 사용 금지.
- **색은 토큰만**: Tailwind 시맨틱 클래스(`bg-surface`, `text-ink`, `border-line`, ...) 또는 `var(--token)`. 하드코딩 hex 금지 (다크모드 깨짐). 토큰 정의는 `src/styles/global.css`(`:root` + `.dark`), 매핑은 `tailwind.config.js`. 맵 카테고리 색은 `--cat-{classic,logic,advanced}` 3종 + 각 `-ink` 짝(`lib/mapCategory.ts` 파생값 전용 — Classic 흰색 / Logic 시안 / Advanced 마젠타). 레거시 `ray-*`/`diff-*` 색은 점진 마이그레이션 전까지 유지 — 지우지 말 것.
- **UI는 공용 프리미티브 사용** (`src/components/ui/`): 버튼=`Button`/`IconButton`, 다이얼로그=`Modal`, 배지=`Pill`, 탭=`Tabs`, 입력=`Field`. 인라인 hover 스타일 금지.
- **인벤토리 키 규칙** (`invKey()`): `type_canRotate_rot`. 회전 가능 기물은 rot=0 통일, block은 항상 rot=0. 이 규칙은 저장/환수/카운트 전부가 공유 — 변경 시 전 경로 영향.
- **canMove는 isInventory에 종속** — 유저지급 기물만 플레이 중 이동 가능 (`getPieceDefaults()`, 덧칠, 팝오버 토글 모두 이 규칙을 지킨다).
- **저장된 rotation = 정답 회전.** 맵 업로드/수정(UploadModal)·JSON 내보내기(PalettePanel)·제안(SuggestionModal)은 `canRotate=true` 기물도 작성자가 맞춘 회전값을 그대로 저장 — "정답 보기"(`showAnswer`)와 제안 풀이 미리보기가 이 값을 복원한다.
- **플레이어에게 보이는 지점에서만 정답 회전을 은닉**: `loadMapForPlay`가 플레이 그리드의 `canRotate && !isInventory` 기물 rotation을 0으로 정규화(`normalizePlayCell`), 인벤토리 기물은 `buildInventory`/`invKey`가 rot 0 정규화, `MiniGrid` 썸네일도 `revealRotation` prop 없으면 동일 규칙으로 렌더(제안 썸네일만 opt-out). **`editorMapDataBackup`·`toggleMode`·`exitMapEditMode`는 원본 유지** — 맵 수정 저장(UploadModal)이 이 원본을 읽어 DB로 보내므로 여기에 정규화를 적용하면 저장된 정답 회전이 파괴된다 (`tests/loadMapForPlay.test.ts`가 회귀 방지).
- **저장/확정 그리드는 `getAuthoredGrid()`** (스토어) — 에디터 상태면 `mapData`, 테스트 상태면 `editorMapDataBackup`(인벤토리 기물 포함 전체 원본). UploadModal 저장과 `exitMapEditMode(restore:false)`가 공유 — 테스트 상태에서 저장해도 인벤토리에 남은 기물이 유실되지 않는다 (`tests/mapEditSave.test.ts`가 회귀 방지). 새 저장/내보내기 경로를 추가하면 `mapData` 직접 읽기 금지, 이 헬퍼를 쓸 것.
- **Ctrl+Z undo 스냅샷은 기물+인벤토리+필기 전부**: `GameSnapshot`에 `penStrokes` 포함. 확정 획은 스토어 `penStrokes`에만 존재(배열 통째 교체, 획 객체는 불변 취급 — 스냅샷이 참조 공유), PenLayer의 ref는 작업 사본. 획을 변경하는 새 경로는 커밋 직전 `saveUndoSnapshot()` 선행 (`tests/penUndo.test.ts`가 회귀 방지).

## 테스트

- 단위(Vitest): `tests/` — 레이저 엔진 골든 케이스, Group A/B 기믹 기물, gridSize 리사이즈, pieceConfig 검증/폴백. 엔진/스토어 로직 수정 시 반드시 실행.
- E2E(Playwright, Chrome headless): `e2e/` — 인벤토리, 회전, 맵 전환 원자성, 팔레트 누수, 팝오버. `window.__rayStore`(DEV 전용, `main.tsx`)로 스토어 직접 조작. 헬퍼는 `e2e/helpers.ts`.

## 배포 / 인프라

- `.github/workflows/deploy.yml`: main 푸시 → 빌드(GitHub Secrets의 `VITE_FIREBASE_*` 주입) → GitHub Pages 배포.
- SPA 라우팅 폴백: `public/404.html` → sessionStorage 리다이렉트 → `index.html` 인라인 스크립트가 복원.
- `index.html` 인라인 스크립트가 첫 페인트 전 다크 테마 적용 (깜빡임 방지) — 제거 금지.
- `ADMIN.html`: 레포 루트의 독립 정적 관리자 툴 (레거시/백업). 맵·제안·통계 관리는 React 어드민 `/admin/mapmaster` 로 이식 완료 — 새 기능은 React 쪽에만 추가한다.

## 문서

| 문서 | 내용 |
|------|------|
| `PROJECT_HIERARCHY.md` | 구조/파일별 역할/태스크→파일 인덱스. **구조 변경 시 함께 갱신할 것.** |
| `docs/DESIGN.md` | UI 디자인 시스템 확정본 (L1 셸, 토큰, 컴포넌트 규칙) |
| `docs/HANDOFF.md` | 세션 인수인계 (작업 이력, 확정 결정) |
| `docs/FEATURE_PIECES_GRID.md` | 기믹 기물 + NxN 그리드 기능 트랙 설계/완료 기록 |
| `docs/PIECE_TAXONOMY.md` | 기물 분류 멘탈 모델 (사용자 정본) |
