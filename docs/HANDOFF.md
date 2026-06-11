# 세션 핸드오프 — UI 리디자인 + 다크모드

다른 세션에서 이어가기 위한 인수인계 문서. **작업 브랜치: `claude/focused-meitner-loc4ey`** (여기에 커밋·푸시한다. main 직접 금지).

---

## 0. 한 줄 요약

순정 JS/HTML → React 포팅된 레이저 퍼즐 에디터(`raytracer`)의 **UI 전면 재설계 + 완전 반응형 + 다크모드** 작업. **Phase 1~5 + 엔진트랙(추가 기물·NxN 그리드) 완료**(Fable). 이후 **보정 라운드 1 완료**(Opus, commit `6e3da5c`): 표적 정면판정·상급탭 상시노출·회전트레잇 표시·인벤타일·테스트 3열. **다음(Fable 인계) = B1 라이브러리 L1(`docs/LIBRARY_L1.md`) + B2 어드민 = 면별(per-face) 기물 behavior 모델 + 에디터(`docs/ADMIN_PANEL.md`, 어휘 `docs/PIECE_TAXONOMY.md`, firestore.rules 선행).** 복합기물(표적거울)·터널 목표화 등 동작 누락은 코드 땜질 대신 **에디터에서 사용자가 면별 정의**(결정됨). 상세 진행상태 `docs/DESIGN.md` §7.

---

## 1. 확정된 결정 (바꾸지 말 것, 사용자 승인됨)

- **레이아웃**: L1 · 프로 툴 셸 (상단 토글바 + 좌/중앙캔버스/우 3-존 + 하단 상태바). 좌·우 존이 모드 따라 변신.
- **색**: 클린 라이트 기반 + 다크모드 토글.
- **범위**: 기반부터(토큰 → 공용 컴포넌트 → 화면 점진).
- **반응형**: 완전 반응형(모바일 포함).
- 상세 스펙(모드별 존, 팔레트, 색 토큰값, 타이포)은 **`docs/DESIGN.md`** 에 전부 있음 — 디자인 작업 전 반드시 읽기.

---

## 2. 지금까지 한 것 (커밋됨)

| 커밋 | 내용 |
|------|------|
| `feat(ui): Phase 1 design tokens + dark mode` | 토큰 시스템 + 다크 토글 |
| `docs: consolidate chosen design ... remove mockups` | DESIGN.md, 목업 HTML 4개 삭제 |
| `feat(ui): Phase 2 shared components + confirm/modal` | `src/components/ui/` 프리미티브, confirm 6곳·모달 3개 교체 |

**Phase 2 산출물 (Fable이 Phase 3에서 사용):**
- `src/components/ui/` — `Button`(variant/size, CSS hover) · `IconButton` · `Field`(Label/TextInput/TextArea/Select) · `Modal` · `ConfirmModal` · `ConfirmHost`(EditorPage에 1회 마운트됨) · `Pill`/`DifficultyPill` · `Tabs`(folder/segment) · 배럴 `index.ts`. 전부 토큰만 사용, 다크 자동 대응.
- 스토어 `requestConfirm(opts):Promise<boolean>` + `resolveConfirm` + `confirmState`. 네이티브 `window.confirm` 전부 제거(clearGrid는 async). 사용법: `if (await requestConfirm({message, danger})) {...}`.
- 모달 3개(Nickname/Upload/Suggestion)는 `Modal`+`Field`+`Button` 기반 — 새 모달 추가 시 패턴 그대로 복제.
- **Phase 3 규칙**: 버튼=`Button`/`IconButton`(인라인 `onMouseEnter`·`style` hover 금지), 다이얼로그=`Modal`, 확인=`requestConfirm`, 배지=`Pill`, 탭=`Tabs`. 하드코딩 hex 금지·토큰 클래스만.

**Phase 1 구현 파일:**
- `src/styles/global.css` — `:root`(라이트) + `.dark`(다크) CSS 변수 토큰. 기존 하드코딩 색(카드·diff-pill·스크롤바·미니그리드) 변수로 마이그레이션 완료.
- `tailwind.config.js` — `darkMode:'class'` + 시맨틱 색을 `var()`로 연결(`bg-surface`,`text-ink`,`border-line`,`bg-primary`,`text-accent`...). 레거시 `ray-*`/`diff-*`는 점진 마이그레이션 위해 **아직 유지**(지우지 말 것 — 대부분 컴포넌트가 씀).
- `src/store/gameStore.ts` — `theme:'light'|'dark'` 상태 + `toggleTheme`/`setTheme`. `initialTheme()`가 localStorage `ray-theme` 읽음.
- `src/hooks/useTheme.ts` — `theme`를 `<html>.dark` + localStorage에 동기화. `App.tsx`에서 호출.
- `index.html` — 첫 페인트 전 `.dark` 적용하는 no-flash 인라인 스크립트.
- `src/components/layout/Header.tsx` — 🌙/☀️ 토글 버튼.
- `src/pages/EditorPage.tsx` — 페이지 배경(`bg-canvas text-ink`) + 우측 패널(`bg-surface border-line`) 토큰화.

**검증 상태**: `npm run build`(tsc+vite) 통과. 린트는 변경 파일 에러 0 (기존 e2e `any` 5건·기존 훅 deps 경고 2건은 무관, 손대지 않음).

---

## 3. 현재 동작 상태 (중요)

- 다크 토글 **작동**. 페이지 배경 + EditorPage 우측 패널은 다크 전환됨.
- **아직 라이트로 남는 곳**: 헤더 내부 버튼(`bg-ray-*`), 보드 셀(`GridContainer`/`GridCell`의 `bg-gray-*`), 팔레트, 라이브러리 카드 내부, 모달 등 — Tailwind 그레이/레거시 클래스라 다크 안 따라옴. **이건 버그 아님, Phase 3에서 토큰 마이그레이션하며 정리 예정.** 다크모드가 반쪽으로 보이는 건 예상된 중간 상태.

---

## 4. 다음 시작점

**Phase 3 완료(2026-06).** 산출물:
- `Header` — 토큰 + `Button`/`IconButton`/`Tabs(segment)` `[편집|플레이]` 토글.
- `EditorPage` — L1 3-존(좌 `PalettePanel`/`TestModeInventory` · 중앙 보드 · 우 `InspectorPanel`(편집: 맵 통계+선택기물 자리)/`LoadedMapInfo`(플레이)) + 하단 `StatusBar`(기물수·그리드·실행취소·레이저 토글). 맵 로드 시 부가 존 `RightSidePanel` 유지.
- `PalettePanel` — 폴더탭(`Tabs`), 44px 직사각 `ToolItem`, 특성 칩(soft 토큰 `--primary/warning/danger-soft` 신설), 섹션 h5 헤더.
- 보드 — 셀/그리드 `--cell`/`--cell-border`/`--grid-bg`, 기물 SVG `currentColor`(다크 대응), 레이저 `--laser`(테마 변경 시 재그리기).
- 라이브러리 일체 토큰화(인라인 hex·onMouseEnter hover 전부 제거).

**Phase 4 + Phase 5 완료(2026-06).** 산출물:
- 반응형: lg 미만에서 좌·우 존이 하단 시트([팔레트|정보] 세그먼트 탭)로, 보드 전체폭. 보드 유동 크기 — 셀 fr 트랙 + `aspect-square` 컨테이너, 레이저 캔버스는 ResizeObserver로 백킹스토어 재동기화(dpr 유지), `getCellFromPoint`는 rect 실측.
- 입력: `useGridDragDrop` mouse* → Pointer Events(pointercancel 처리, 그리드 `touch-action:none`).
- 기물 조작: 스토어 `selectedCell` + `setSelectedCell`(모드 전환 시 초기화). 좌클릭(빈손)=선택 → 데스크탑 `PiecePopover`(lg+, 외부클릭/Esc/삭제 시 닫힘, 첫 행 아래로 flip, 배치 직후 자동 표시) / 모바일 인스펙터 메인(선택 시 정보탭 자동 전환). 도구 든 채 기물 클릭=도구 해제만. 우클릭=회전. 삭제·회수·특성(잠금/유저지급/초기화)은 팝오버+인스펙터(`SelectedPieceInfo`) — 같은 스토어 편집이라 동기화. 공용 액션 `src/lib/pieceActions.ts`(`rotatePiece` 등, `useGridDragDrop`의 회전 로직 이동).
- e2e: rotation(우클릭 회전+팝오버 회전)·inventory(팝오버 회수)·piece-popover(도구해제 우선·특성·삭제·Esc) — **이 컨테이너는 Playwright 브라우저 다운로드가 차단되어 미실행. 로컬에서 `npx playwright install chromium` 후 `npm run test:e2e` 필요.**

**별개 엔진 트랙도 완료(2026-06)** — 상세는 `docs/FEATURE_PIECES_GRID.md` 상단 "구현 완료" 블록. 요지: 순수 `computeLaser` + 레지스트리 + 고정점 시뮬 + `solved` 판정, 기믹 기물 11종(중급 탭), `gridSize` 런타임화(하위호환 5), Vitest 41건(`npm run test`). 잔여: firestore.rules 커밋, 표적거울 판정 정의.

### 그 다음
- Phase 4: 완전 반응형 + 터치(`useGridDragDrop`의 `mouse*`→Pointer Events).
- **Phase 5: 기물 조작 UX (사용자 확정)** — Phase 4와 같이 처리(둘 다 `useGridDragDrop`/입력 관련):

  **(1) 도구 해제 우선** — 도구를 든 채 그리드의 기물을 좌클릭하면 *먼저 도구만 해제*(덮어쓰기 안 함). 다음 클릭부터 아래 조작. (현재는 도구 든 채 클릭 시 덮어쓰기 가능 — `useGridDragDrop` mouseUp same-cell 분기 우선순위 변경.)

  **(2) 데스크탑 / 모바일 분기** (기준: `matchMedia('(pointer: coarse)')` 또는 반응형 브레이크포인트):
  - **데스크탑(마우스)**: **플로팅 팝오버가 메인.** + 우측 인스펙터에도 선택 기물 정보를 표시하고 **거기서도 편집 가능**(팝오버와 인스펙터는 같은 기물 상태를 편집 — 동기화).
  - **모바일/터치**: **플로팅 없음.** 우측 인스펙터(또는 하단 시트)가 메인 — 기물 탭 → 인스펙터에 정보 + 편집.

  **(3) 입력 매핑 (에디터)**:
  - **우클릭 = 회전** (기존 '우클릭=삭제'에서 변경. 삭제는 팝오버로 이동.)
  - **좌클릭(기물) = 플로팅 팝오버 오픈**(데스크탑). 트리거에 *배치 직후 자동 표시*도 포함. hover 제외(깜빡임). 외부클릭/Esc/액션 시 닫힘. 위치는 기물 위/옆, 보드 경계서 flip.
  - 팝오버 내용: **특성 적용 버튼(🔒 회전잠금 토글 · 🎒 유저지급 토글)** · **특성 삭제(속성 초기화)** · **🗑 기물 삭제**.
  - 드래그 = 이동/스왑(유지).

  **(4) 테스트 모드**: 좌클릭 → 팝오버(데스크탑)/인스펙터(모바일): 회전(`canRotate`일 때) · ♻ 인벤 회수(`isInventory` 기물). 우클릭=회전.

  **(5) 구현 메모**: 인스펙터/팝오버가 "어떤 기물"을 가리킬지 위해 스토어에 **선택 셀 상태(`selectedCell: {row,col}|null`)** 추가 필요. 기존 좌측 '특성 부여 덧칠'은 bulk용으로 일단 유지(중복 감수). 새 팝오버는 `src/components/ui/Popover`(또는 유사)로.

  - 그 외 Phase 5 후보(미확정): 숨은 기능 노출(언두 버튼·단축키 힌트), 모드 네비, 승리/명중 판정(엔진 target-hit 필요 → 아래 별개 트랙 연계).

> **별개 기능 트랙(UI 페이즈 아님)**: 추가 기물(관문·프로젝터·다이오드 등) + 넓은 그리드 + firestore.rules = `docs/FEATURE_PIECES_GRID.md`. 레이저 엔진 재작성이라 UI와 분리. 별도 플랜/태스크로.

---

## 5. 소스 오브 트루스 / 키 파일

- **디자인 기준**: `docs/DESIGN.md`(레이아웃·색토큰·타이포) + `src/styles/global.css`(토큰 실값).
- **공용 컴포넌트**: `src/components/ui/`(배럴 `index.ts`) — Phase 3는 여기서 import.
- **테마 인프라**: `gameStore.ts`(theme·confirmState), `useTheme.ts`, `index.html`(no-flash), `Header.tsx`(버튼).
- **게임 로직**(건드리지 말 것 — 재설계는 UI만): `src/lib/laserEngine.ts`, `src/store/gameStore.ts`(상태), `src/hooks/useGridDragDrop.ts`.
- 코드 구조 전체 지도: `PROJECT_HIERARCHY.md`.

---

## 6. 검증 명령

```bash
npm install              # 새 컨테이너는 node_modules 없음 → 먼저 실행
npm run build            # tsc -b && vite build (타입체크 포함)
npm run lint             # 기존 e2e any 5건·훅 경고 2건은 사전 존재, 무시
npm run test:e2e         # Playwright (브라우저 필요: npx playwright install chromium)
npm run dev              # 로컬 미리보기
```

푸시: `git push -u origin claude/focused-meitner-loc4ey` (네트워크 실패 시 2/4/8/16s 백오프 재시도).

---

## 7. 보류된(parked) 별개 작업 — 잊지 말 것

이번 세션 초반에 **다른 큰 기능**도 설계만 해뒀음(구현 안 함, UI 작업과 별개):

1. **상태형 기믹 기물** (관문 3종·표적/반전 프로젝터 등) — 현재 단일패스 BFS 레이저 엔진으론 불가, **고정점(fixpoint) 반복 시뮬 + 데이터드리븐 piece 레지스트리**로 재작성 필요. 색깔빔·포탈id 없어 beam·스키마 per-instance 확장은 불필요.
2. **균일 NxN 그리드 크기 가변** — `GRID_SIZE` 런타임화 + `MapDocument.gridSize` 스키마(없으면 5) + CSS 하드코딩(`repeat(5,...)`) 제거.
3. **firestore.rules가 레포에 없음** — 반응/투표를 클라이언트가 직접 `increment()` 씀. 보안 규칙 레포 커밋 권장.

→ 이 설계 상세는 이번 세션 대화에 있음. 별도 플랜 파일(`~/.claude/plans/`)은 임시·레포 밖이라 새 세션엔 없을 수 있음. 필요하면 위 요지로 재설계.

---

## 8. UX 전수 카탈로그 (사용자 마킹 대기)

마우스/모드/팔레트/레이저/라이브러리/인증/단축키/네이티브 confirm/숨은·죽은 UI 까지 현재 UX를 A~J로 정리한 카탈로그를 사용자에게 전달함. 사용자가 **추가/수정/삭제 마킹을 주기로 약속**(Phase 5 입력). 전체본은 이번 세션 대화 참조. 핵심 결함: 승리판정 없음 / 모드네비 막다른길 / 숨은 기능(언두·우클릭삭제·이스터에그) / 중급탭 죽은 UI / 네이티브 confirm 6곳.
