# Fable 인계 B1 — 라이브러리 L1 재구성

> 브랜치 `claude/focused-meitner-loc4ey`. 먼저 `docs/DESIGN.md`(§2 L1 스펙) + 이 문서를 읽어라.
> Phase 3에서 에디터/테스트/새맵은 L1 셸로 옮겼지만 **라이브러리만 예전 전체폭 카드 그리드에 토큰만 입힌 상태**다. DESIGN §2의 라이브러리 L1(좌 카테고리 내비 + 우 미리보기/플레이)을 구현한다.

## 현재 상태 (수정 대상)

- `src/pages/EditorPage.tsx`: `<Header/>` 아래 `<main>` 안에서 `isLibraryMode ? <LibraryScreen/> : (...L1 3-존...)`. Header는 라이브러리에서도 항상 보임.
- `src/components/library/LibraryScreen.tsx`: `h-full p-6 overflow-y-auto` 전체폭 한 장. 섹션 = featured(추천, reactionGod≥3) / original(원본, author `RayOriginal`) / recent(검색·정렬 그리드). 카드 클릭 시 **즉시 플레이**(`playMap`).
- 재사용 가능: `MapCard`(카드), `MiniGrid`(미니 그리드 미리보기, `variant="v2"`, `gridSize` prop 받음), `fetchLibraryList(sortBy)`.

## 목표 레이아웃 (DESIGN §2)

`LibraryScreen`을 L1 3-존으로:

```
┌ 좌 존(카테고리 내비) ┬ 중앙(선택 카테고리 맵 그리드) ┬ 우 존(미리보기) ┐
│ 🔥 추천            │ [검색 ____] [정렬 ▾]          │ MiniGrid       │
│ 🏛 원본            │ ┌MapCard┐ ┌MapCard┐ …        │ 제목·작성자·난이도 │
│ 🕗 최근            │ └──────┘ └──────┘            │ 설명           │
│ 🏆 명예의전당       │                              │ ✅ 🔥 반응 수    │
│ 👤 내 맵           │                              │ ▶ 플레이 버튼   │
│ ──────            │                              │                │
│ ✨ 새 맵 만들기     │                              │                │
└──────────────────┴──────────────────────────────┴────────────────┘
```

- 좌 존: `w-56`, 토큰 기반(에디터 좌 팔레트와 같은 폭/패턴). 카테고리 버튼 = 활성 시 accent. 하단에 `✨ 새 맵 만들기`(기존 `createNewMap`, requestConfirm 로직 유지).
- 중앙: 선택 카테고리의 맵 `MapCard` 그리드(`repeat(auto-fill,minmax(220px,1fr))`). 상단에 검색 input + 정렬 Select(`최신 등록순`/`갓맵순`, 기존 `sortBy`). 카드 클릭 = **선택**(우 미리보기 갱신), 즉시 플레이 아님.
- 우 존: `w-72`, 선택 맵 미리보기. `MiniGrid`(hideInventory, `gridSize={map.gridSize ?? 5}`) + 메타(제목/작성자/공식난이도/설명/반응) + `▶ 플레이` 버튼(기존 `playMap` 호출). 선택 없으면 "맵을 선택하세요" placeholder.

## 카테고리 정의

| id | 라벨 | 필터 |
|----|------|------|
| `featured` | 🔥 추천 | `reactionGod ≥ 3`, reactionGod 내림차순 |
| `original` | 🏛 원본 | `author === 'RayOriginal'`, 최신순 |
| `recent` | 🕗 최근 | 전체(검색·정렬 적용) |
| `hall` | 🏆 명예의전당 | reactionGod 상위 N(예: 20), 내림차순 |
| `mine` | 👤 내 맵 | `authorUid === currentUserUid` (비로그인 시 "로그인 필요" 안내) |

검색어 있으면 카테고리 무관 전체에서 title/author 부분일치(기존 `filtered` 로직 재사용) → 중앙 그리드에 표시.

## 신규/변경

- store: `selectedLibraryMap: MapDocument | null` + `setSelectedLibraryMap`(zustand). 라이브러리 진입/이탈 시 null 리셋. (또는 LibraryScreen 로컬 state로 충분하면 로컬 useState — 우 존이 LibraryScreen 내부면 로컬로 OK. 모달/외부 공유 불필요하면 로컬 권장.)
- LibraryScreen 로컬 state: `activeCategory`, `search`, `sortBy`(기존), `selected`(미리보기 대상).
- `playMap`/`createNewMap`/`mapDocToGrid` 로직 **그대로 재사용**(이동만).

## 반응형 (Phase 4 패턴 따름)

- 데스크탑(`lg`+): 위 3-존.
- 모바일/태블릿(`lg` 미만): 좌 카테고리 = 상단 가로 스크롤 세그먼트 탭(`Tabs variant="segment"` 또는 칩 줄). 중앙 그리드 전체폭(1~2열). 우 미리보기 = 카드 탭 시 **하단 시트**(에디터의 하단 시트 패턴 재사용) 또는 카드 → 즉시 플레이(모바일은 미리보기 생략하고 바로 플레이도 허용 — 단순함 우선).

## 컨벤션 (필수)

- 버튼 = `src/components/ui` `Button`/`IconButton`. 인라인 hover/style 금지. 하드코딩 hex 금지(토큰만).
- 배지 = `Pill`/`DifficultyPill`. 탭 = `Tabs`.
- 기존 e2e 셀렉터(있으면) 유지. 카드 클릭 동작이 "즉시 플레이→선택"으로 바뀌므로 라이브러리 관련 e2e 있으면 갱신.

## 검증

- `npm run build` / `npm run lint`(변경 파일 에러 0) / `npm run test`.
- 수동(라이트/다크, 데스크탑/모바일): 카테고리 전환, 검색·정렬, 카드 선택→우 미리보기, ▶ 플레이 진입, 새 맵 만들기, 내 맵(로그인/비로그인).
