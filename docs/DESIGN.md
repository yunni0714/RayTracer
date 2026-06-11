# RayTracer — 디자인 시스템 (확정본)

순정 JS/HTML → React 포팅 이후 UI/UX 재설계의 **확정 결정**을 정리한 문서. 탐색용 목업 HTML(`design-preview.html`, `layout-preview.html`, `layout-l1-*.html`)은 이 문서로 대체하고 삭제했다. 이후 디자인 논의·구현은 이 문서 + `src/styles/global.css` 토큰을 기준으로 한다.

---

## 1. 결정 요약

| 항목 | 결정 |
|------|------|
| 레이아웃 | **L1 · 프로 툴 셸** (상단 토글바 + 좌/중앙 캔버스/우 3-존 + 하단 상태바) |
| 색 방향 | **클린 라이트 기반** + **다크모드 토글** |
| 범위 | 기반부터(토큰 → 공용 컴포넌트 → 화면 점진) |
| 반응형 | 완전 반응형(모바일 포함) — 데스크탑 L1, 모바일은 좌/우 존을 하단 시트로 |
| 소스 오브 트루스 | 색·간격·radius = `src/styles/global.css` 토큰 / Tailwind `tailwind.config.js` |

---

## 2. 레이아웃 — L1 셸

캔버스(보드)가 주인공. 상단 토글바 + 3-존(좌·중앙·우) + 하단 상태바. **상단 토글·3-존 골격은 전 모드 공통**, 좌·우 존 내용만 모드에 따라 변신한다.

```
┌───────────────────────────────────────────────┐
│ 상단바: 로고 · 파일/새맵/저장 · [편집|플레이] · 라이브러리 · 🌙 · 유저 │
├──────┬──────────────────────────────┬──────────┤
│ 좌 존 │           중앙: 캔버스            │  우 존   │
│ (변신)│        (보드 + 레이저)           │ (변신)   │
├──────┴──────────────────────────────┴──────────┤
│ 하단 상태바: 기물수 · 타겟 명중 · 그리드 · 실행취소        │
└───────────────────────────────────────────────┘
```

### 모드별 좌/우 존

| 모드 | 좌 존 | 우 존 | 상단 |
|------|-------|-------|------|
| **편집** | 팔레트(탭 기물 그리드 + 특성부여 덧칠) | 선택 기물 상태 + 맵 통계 | `[편집\|플레이]` |
| **플레이(테스트)** | 인벤토리(지급 기물 + 개수) | 목표/진행 + 맵정보 + 평가 + 난이도투표 + 정답보기 | `[편집\|플레이]`(플레이 활성) |
| **새 맵 만들기** | 편집과 동일 팔레트 | **발행 정보 폼**(제목·난이도·설명·작성자) + 발행 체크리스트 + 발행 버튼 | breadcrumb·배너 + `[편집\|풀이 검증]` |
| **라이브러리** | 카테고리 내비(추천/원본/최근/명예의전당/내 맵) | 선택맵 미리보기 + 플레이 버튼 | 에디터로 / 유저 |

핵심: 좌 존은 **도구레일 ↔ 인벤토리 ↔ 카테고리**, 우 존은 **인스펙터 ↔ 목표 ↔ 발행폼 ↔ 미리보기** 로 같은 자리에서 변신 → 시각 언어 일관, 학습비용 최소.

### 좌측 팔레트 스펙 (편집/새맵 공통)

- **폭 224px** (우측 패널과 통일).
- **폴더 탭**: 초급/중급/상급 — 카드 상단에 **붙은** 폴더탭(분리된 알약 아님). 활성 탭 어두움, 카드 본체와 한 몸.
- **기물 타일**: 3열 그리드, **납작한 직사각형**(높이 ~44px). 기물 SVG는 비율유지 정사각 중앙. 선택 시 accent 보더.
- **특성 부여 · 덧칠**: 🔄 회전 가능(파랑) / 🔒 회전 불가(노랑) / 🎒 유저 지급(빨강) — 소프트 배경 + 컬러 보더.
- 섹션: `기물` / `특성 부여·덧칠` / `작업(전체지우기·JSON)` 을 `h5` 헤더 + `border-top` 구분선으로 분리(우측 패널과 동일 패턴).

### 우측 패널 스펙

- **폭 224px**, `h5`(대문자·트래킹·muted) 섹션 헤더, `border-top` 구분선, `field`(라벨·값) 행.
- 편집: 중복 토글 없이 **선택 기물 상태 표시 + 맵 통계**만(설정은 좌측 덧칠로).

### 인스펙터 원칙

- 기존 "수정자 덧칠" 변칙 → **선택 + 인스펙터** 패러다임으로 이동(좌측 덧칠은 유지하되 우측은 상태 반영). 향후 넓은 그리드·기믹 기물 속성도 인스펙터에 수용.

---

## 3. 색 토큰 (소스: `src/styles/global.css`)

CSS 변수. `<html>.dark` 클래스가 붙으면 다크값으로 전환. Tailwind는 `var()` 참조(`bg-surface`, `text-ink`, `border-line`, `bg-primary` 등).

| 토큰 | 라이트 | 다크 | 용도 |
|------|--------|------|------|
| `--canvas` | `#eef2f7` | `#0b1020` | 페이지 배경 |
| `--surface` | `#ffffff` | `#121a2e` | 카드/패널 |
| `--surface-2` | `#f5f8fc` | `#0e1528` | 보조 표면 |
| `--surface-3` | `#eef2f7` | `#1b2540` | 강조 표면 |
| `--line` | `#dbe3ec` | `#243049` | 경계 |
| `--line-strong` | `#c2cedd` | `#324264` | 강조 경계(hover) |
| `--text` | `#1e293b` | `#e6edf6` | 본문 |
| `--text-muted` | `#6b7a90` | `#8a99b8` | 보조 텍스트 |
| `--primary` | `#2563eb` | `#3b82f6` | 주 액션 |
| `--success` | `#16a34a` | `#22c55e` | 성공/좋아요 |
| `--danger` | `#dc2626` | `#f87171` | 위험/삭제 |
| `--warning` | `#f59e0b` | `#fbbf24` | 경고/보통 난이도 |
| `--accent` | `#7c3aed` | `#a78bfa` | 강조/선택 |
| `--accent-soft` | `#f3e8ff` | `#2a1f45` | 선택 배경 |
| `--grid-bg` | `#f8fafc` | `#0d1426` | 보드 배경 |
| `--cell` | `#ffffff` | `#0f1830` | 셀 |
| `--cell-border` | `#e2e8f0` | `#1e2a44` | 셀 경계 |
| `--cell-marker` | `#aab6c6` | `#3a4a6a` | 셀 코너 마커 |
| `--laser` | `#ef4444` | `#ff4d5e` | 레이저 빔 |
| 난이도 | tutor `#3498db` · easy `#22c55e` · normal `#f59e0b` · hard `#e67e22` · insane `#ef4444` | (다크는 약간 밝게) | diff-pill |
| `--shadow-sm/-md` | 옅은 그림자 | 짙은 그림자 | 카드 |

규칙: **하드코딩 hex 금지**, 토큰만 사용. 같은 색을 Tailwind/inline/CSS 세 방식으로 칠하던 기존 혼용을 토큰으로 단일화.

---

## 4. 타이포 · 간격 · radius

| 토큰 | 값 |
|------|-----|
| 제목 | 20px / 800 / letter-spacing -0.5px |
| 본문 | 14px |
| 캡션·메타 | 12px |
| 섹션 헤더(`h5`) | 11px / 800 / uppercase / tracking 0.5px / muted |
| radius `card` | 12px |
| radius `tile`/기본 | 8px |
| 측면 패널 폭 | 224px (좌·우 동일) |
| 버튼 상태 | 기본 / hover(brightness↑) / active(brightness↓ + translateY) |

---

## 5. 공용 컴포넌트 (Phase 2 예정)

`src/components/ui/`: `Button`(variant/size, CSS hover로 `onMouseEnter` 대체), `IconButton`, `Modal`(+ `ConfirmModal` — 네이티브 `window.confirm` 대체), `Panel/Card`, `Pill`(난이도·카테고리), `Tabs`(폴더탭). 기존 화면이 이걸 쓰도록 점진 교체.

---

## 6. 반응형 (Phase 4 예정)

- 데스크탑: L1 3-존.
- 태블릿/모바일: 좌·우 존을 **하단 시트/탭**으로 접고 보드 전체폭. `CELL_SIZE` 고정(100px) → 컨테이너 유동.
- 입력: `useGridDragDrop` 의 `mouse*`/`contextmenu` → **Pointer Events** 로 이전(터치 통합). 우클릭 삭제의 터치 대안 필요.

---

## 7. 진행 상태

- [x] **Phase 1** — 토큰 시스템(라이트+다크) + 다크 토글(헤더 버튼·no-flash·localStorage). 셸 배경 토큰화. `global.css`/`tailwind.config.js`/store `theme`/`useTheme`.
- [x] **Phase 2** — 공용 컴포넌트(`src/components/ui/`: Button·IconButton·Field·Modal·ConfirmModal·ConfirmHost·Pill/DifficultyPill·Tabs). 네이티브 `window.confirm` 6곳 → 스토어 `requestConfirm`+`ConfirmHost`. 모달 3개 → `Modal`+`Field`+`Button`(다크 대응).
- [x] **Phase 3** — 화면별 L1 + 토큰 마이그레이션 완료. Header(세그먼트 토글)·EditorPage L1 3-존(+하단 StatusBar·우측 InspectorPanel)·PalettePanel(폴더탭+44px 타일+soft 토큰 칩)·보드 셀/기물 SVG(currentColor)/레이저(--laser)·라이브러리(스크린·카드·미니그리드·다음문제·풀이제안·RightSidePanel·LoadedMapInfo). soft 토큰(--primary/warning/danger-soft) 추가.
- [x] **Phase 4** — 완전 반응형 + 터치 완료. lg 미만: 좌·우 존 → 하단 시트([팔레트|정보] 세그먼트), 보드 전체폭. 보드 유동 크기(fr 트랙 + aspect-square, 캔버스 ResizeObserver + dpr 유지, 히트테스트 실측). `useGridDragDrop` Pointer Events 전환(pointercancel 포함, `touch-action:none`).
- [x] **Phase 5 — 기물 조작 UX** 완료. ① 도구 든 채 기물 좌클릭 = 도구 해제 우선(덮어쓰기 안 함). ② 좌클릭=기물 선택(`selectedCell`) → 데스크탑 플로팅 `PiecePopover`(회전·🔒잠금·🎒유저지급·✨특성삭제·🗑삭제 / 테스트: 회전·♻회수, 배치 직후 자동 표시, 외부클릭/Esc 닫힘, 경계 flip), 모바일은 인스펙터(`SelectedPieceInfo`, 하단 시트 정보탭 자동 전환)가 메인 — 둘은 같은 스토어 상태 편집(동기화). ③ 우클릭=회전(삭제는 팝오버로 이동). 공용 액션 `src/lib/pieceActions.ts`. e2e 갱신 + `piece-popover.spec.ts` 신규.

- [x] **보정 라운드 1 (Opus)** — Fable 산출물 검토 후 contained 수정: 표적 정면 판정(전방위→정면면), 상급 탭 상시 노출(이스터에그 게이트 제거), 회전 트레잇 표시 맥락화(기본값 무표시·일탈만, 물리회전↻ vs canRotate 토글 분리), 플레이 인벤 타일 확대+🔒, 테스트 화면 4열→3열. (commit `6e3da5c`)
- [x] **B1 (Fable)** — 라이브러리 L1 재구성 완료. 좌 카테고리 내비(추천/원본/최근/명예의전당/내 맵 + ✨새 맵) / 중앙 맵 그리드(검색·정렬, 검색은 전 카테고리) / 우 미리보기(`MiniGrid`+메타+반응+▶플레이). 카드 클릭=선택, ▶로 진입. lg 미만: 카테고리=상단 세그먼트, 미리보기=하단 시트. `MapCard` selected 하이라이트.
- [x] **B2 (Fable)** — 어드민/콘피그 패널 완료. ① `firestore.rules` 레포 커밋(config=관리자 화이트리스트 write, maps/users/suggestions 명시 — **UID 플레이스홀더 교체+배포는 메이커 몫**). ② 엔진 `REGISTRY` → 면별 `PieceBehaviorDef` 테이블 + `buildInteract`(`buildBehavior`) + `getBehavior/getBehaviorDef/isTargetType` 접근자 — **회귀 0**(기존 43 테스트 무수정 통과). ③ 런타임 오버레이 `src/lib/pieceConfig.ts`(`applyPieceConfig` 순수·검증·손상 폴백, `getSvgArt`/label/tab/defaults, 부팅 1회 로드 + `pieceConfigRev` 리렌더). ④ `/admin` 라우트 + UID 게이트(`src/lib/admin.ts`) + SVG/특성/면 그리드 에디터 + Firestore 저장·기본값 리셋. InspectorPanel 표적 카운트 `isTarget` 기준 일치. 스키마 편차·잔여는 `docs/ADMIN_PANEL.md` 상단 참조. 코드 편집창(§6 옵션)은 보안 사유로 미구현.
- [x] **보정 라운드 2 (Opus)** — B1/B2 검수 + 어드민 폴리시. `firestore.rules` 실배포본과 동기화(`config` 블록 추가·maps update `isAdmin()` 유지 = ADMIN.html 맵툴 충돌 해소·catch-all). SVG 새니타이즈(`pieceConfig`, innerHTML XSS). 면 효과 에디터 단순화: 6종→4종(통과/정지/반사/분기), 정지=충족여부로 흡수↔차단, 반사=8방향 출력 화살표(되돌림 흡수). canMove를 isInventory에 종속. 조건부 트리거를 면별 ⚡체크+그룹#(텍스트 `0,180;90,270` 대체). 엔진 kind 불변=회귀0. (commits `6e3da5c`·`149d2b5`·`e512161`)
- [x] **B3 (Fable)** — 기물 관리 완료. ① 타입 경계 string 화(`AnyPieceType` — CellData/MapItemDTO/SelectedTool/InventoryItem) + 접근자 안전 폴백(미지 타입 = `PASSIVE` 통과 · 플레이스홀더 SVG(점선+?) · 라벨=type 문자열 · 승리판정 제외) = 맵 미지타입 복원력. ② `applyPieceConfig` 커스텀 타입 허용(behavior+svg 둘 다 필수, id `^[a-z0-9_]+$`·≤32자·빌트인 충돌 금지) + `getCustomTypes()`. ③ 폴더 모델(`folders[{id,name,order}]` + 엔트리 `folderId`, 레거시 `tab` 하위호환, 기본 3폴더 상시 재생성 보장) + `getFolders()`/`getPieceFolder()`. ④ 팔레트 동적 폴더 탭(빈 폴더 숨김, hidden 기물 제외; 회전 스텝 `ADVANCED_TYPES` 로직 불변). ⑤ 어드민 폴더 CRUD(추가·inline 이름변경·↑↓ 순서·삭제 시 기물 첫 폴더 재할당, 기본 3폴더 삭제 불가) + HTML5 드래그 할당(무의존, 즉시 저장). ⑥ 새 기물 생성(id/이름/폴더 → pass 기본 behavior + 시작 SVG) + 통합 삭제(빌트인=`hidden` 숨김/👁복구 토글, 커스텀=엔트리 완전 제거) + 커스텀/숨김 배지. 테스트 49→66, config 부재 시 회귀 0 유지. 스펙: `docs/PIECE_ADMIN_V2.md`.

> **UI 트랙(Phase 1~5)과 별개**: 추가 기물(관문·프로젝터 등) + 넓은 그리드 + firestore.rules = `docs/FEATURE_PIECES_GRID.md`(엔진 재작성, 분리 진행).
> 진행 메모는 `docs/HANDOFF.md` 참조.
