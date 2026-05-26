# 불필요한 파일 목록

React + TypeScript 마이그레이션(v0.8.0) 완료 후 루트 디렉토리에 남아 있는 레거시 파일 분석.  
`src/` 내 34개 파일은 import 관계가 전부 확인됐으며 사용 중이므로 삭제 대상 없음.

---

## A. 바닐라 JS 레거시 파일 (루트) — 6개 · 총 107 KB

Vite 빌드는 `index.html → src/main.tsx`를 진입점으로 사용한다. 아래 파일들은 **어디서도 import되지 않으며 빌드 번들에 포함되지 않는다.**

| 파일 | 크기 | 대체 파일 (src/) | 비고 |
|---|---|---|---|
| `main.js` | 6.3 KB | `src/main.tsx`, `src/App.tsx` | 그리드 초기화, 이벤트 바인딩, Firebase 연결 진입점 |
| `dragAndDrop.js` | 41.6 KB | `src/hooks/useGridDragDrop.ts` | 드래그앤드롭, 회전, Undo 스택 — 가장 큰 레거시 파일 |
| `laserEngine.js` | 8.9 KB | `src/lib/laserEngine.ts` | BFS 레이저 물리 시뮬레이션 |
| `libraryController.js` | 35.8 KB | `src/components/library/` 전체 | 라이브러리 화면, 맵 카드, 반응/투표, 제안 게시판 |
| `uiController.js` | 8.4 KB | `src/store/gameStore.ts`, `src/components/modals/` | 모달 제어, 알림, 이스터에그 |
| `firebaseApp.js` | 6.6 KB | `src/lib/firebase.ts`, `src/lib/firebaseService.ts` | Firebase 초기화 및 Firestore/Auth CRUD |

**삭제 안전 여부:** ✅ 안전. 삭제해도 `npm run build` 및 배포에 영향 없음.

---

## B. 레거시 CSS 파일 (루트) — 1개 · 16.5 KB

| 파일 | 크기 | 대체 파일 (src/) | 비고 |
|---|---|---|---|
| `style.css` | 16.5 KB | `src/styles/global.css` + Tailwind CSS | 구 바닐라 JS HTML 전용 스타일시트. `index.html`에서 참조하지 않음 |

**삭제 안전 여부:** ✅ 안전. Vite 빌드가 이 파일을 처리하지 않음.

---

## C. 완료된 계획서 / 구 아키텍처 문서 — 2개 · 총 26.8 KB

| 파일 | 크기 | 이유 |
|---|---|---|
| `CODEBASE_REPORT.md` | 16.8 KB | 바닐라 JS 6파일 구조를 설명하는 문서. React 전환 이후 내용이 전부 구식이 됨. 현재 아키텍처와 불일치. |
| `MODULARIZATION_PLAN.md` | 10.0 KB | v0.8.0 React 마이그레이션 실행 계획서. 마이그레이션이 완료됐으므로 더 이상 유효하지 않음. |

**삭제 안전 여부:** ✅ 안전. 코드 실행에 영향 없음. 단, 히스토리 보존 목적이면 유지 가능.

---

## D. src/ 내 파일 — 전부 사용 중 (삭제 대상 없음)

34개 파일 전체의 import 체인이 추적됨. 고아(orphaned) 파일 없음.

```
main.tsx → App.tsx → EditorPage.tsx
  ├── Header, Notification
  ├── GameBoard → GridContainer → GridCell
  │              └── LaserCanvas
  ├── PalettePanel, TestModeInventory → ToolItem
  ├── LibraryScreen → MapCard → MiniGrid
  ├── LoadedMapInfo, RightSidePanel
  │   └── NextMapPanel, SuggestionPanel → MiniGrid
  └── NicknameModal, UploadModal, SuggestionModal
```

---

## E. 누락된 파일 (삭제 대상 아님 — 추가 필요)

| 파일 | 문제 |
|---|---|
| `eslint.config.js` | 없음. `devDependencies`에 ESLint v9가 있고 `npm run lint` 스크립트도 있지만 설정 파일이 없어 lint 명령이 실패함. |

---

## 삭제 요약

| 분류 | 파일 수 | 총 크기 |
|---|---|---|
| 레거시 JS | 6개 | ~107 KB |
| 레거시 CSS | 1개 | ~17 KB |
| 구 문서 | 2개 | ~27 KB |
| **합계** | **9개** | **~151 KB** |

모두 삭제 후 `npm run build` 성공 여부로 안전성 검증 가능.
