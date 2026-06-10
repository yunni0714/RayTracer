# 세션 핸드오프 — UI 리디자인 + 다크모드

다른 세션에서 이어가기 위한 인수인계 문서. **작업 브랜치: `claude/focused-meitner-loc4ey`** (여기에 커밋·푸시한다. main 직접 금지).

---

## 0. 한 줄 요약

순정 JS/HTML → React 포팅된 레이저 퍼즐 에디터(`raytracer`)의 **UI 전면 재설계 + 완전 반응형 + 다크모드** 작업 중. 방향 확정·**Phase 1(토큰+다크) + Phase 2(공용 컴포넌트·confirm·모달) 완료**. **다음 = Phase 3 — 화면별 L1 마이그레이션, Fable에 인계 예정**(§4).

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

## 4. 다음 시작점 — 여기서부터 (= Phase 3, Fable 담당)

Phase 1·2 완료. **다음은 Phase 3 — 화면별 L1 레이아웃 + 토큰 마이그레이션.** Phase 2에서 만든 `src/components/ui/` 컴포넌트만 사용하면 됨(§2 Phase 2 산출물 참고). 시작 전 `docs/DESIGN.md` 필독.

### Phase 3 — 화면별 L1 + 토큰 마이그레이션 (권장 순서)
1. **Header** — `bg-ray-dark`→토큰, 버튼들 `Button`으로, 상단 `[편집|플레이]` 세그먼트 토글로 정리.
2. **EditorPage 레이아웃** — 현재 2~3컬럼 → L1 3-존(좌 팔레트 / 중앙 보드 / 우 인스펙터 / 하단 상태바). `docs/DESIGN.md §2` 구조대로.
3. **PalettePanel** — 좌 존으로 이동. 폴더탭(붙은 탭)·직사각 타일(높이 44px)·특성부여 섹션화. (목업 스펙은 DESIGN.md.)
4. **GameBoard/GridContainer/GridCell/LaserCanvas** — `bg-gray-*` 토큰화(`--cell`,`--cell-border`,`--grid-bg`,`--laser`).
5. **Library/MapCard/MiniGrid/모달** — 토큰화 + 공용 컴포넌트 적용.

### 그 다음
- Phase 4: 완전 반응형 + 터치(`useGridDragDrop`의 `mouse*`→Pointer Events).
- Phase 5: UX 정리 — **사용자가 UX 카탈로그 마킹(추가/수정/삭제) 주기로 함**(아직 안 줌). 후보: 네이티브 confirm 교체, 숨은 기능(언두·우클릭삭제) 노출, 모드 네비, **승리/명중 판정**(레이저 엔진에 target-hit 감지 추가 필요).

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
