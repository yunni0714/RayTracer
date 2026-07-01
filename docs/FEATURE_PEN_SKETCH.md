# 기획서 — 펜/스케치 오버레이 (Pen & Sketch Overlay)

> 상태: **제안 (Draft)** · 작성일 2026-07-01 · 대상 트랙: 플레이 편의 도구
> 관련 파일 사전조사: `GameBoard.tsx`, `LaserCanvas.tsx`, `useLaserCanvas.ts`, `GridContainer.tsx`, `gameStore.ts`, `styles/global.css`

---

## 1. 배경 / 문제

레이저 퍼즐을 풀 때, 특히 5×5 이상 그리드에서 반사 경로·거울 배치를 머릿속으로만 추적하기 어렵다.
플레이어가 **그리드 위나 그 주변에 직접 필기·스케치**하며 생각을 정리할 수단이 없다.

**목표:** 파랑/초록/빨강 3색으로 보드 위 및 여백에 자유롭게 그릴 수 있는 가벼운 손그림 오버레이를 제공한다.
종이에 연필로 보조선 긋듯, 저장·공유 부담 없이 **개인 사고 보조**로 쓰는 도구.

**비목표 (Non-goals):**
- 도형/직선/텍스트 삽입 도구 (1차 범위 밖 — 자유 곡선만)
- 그림을 맵 문서에 저장해 **다른 플레이어와 공유** (개인 필기이므로 공유하지 않음)
- 레이저 계산·승리 판정에 영향 (순수 시각 오버레이, 엔진과 완전 분리)

---

## 2. 실현 가능성 결론

**가능. 난이도 낮음 (~중).** 기존 구조에 자연스럽게 얹힌다.

보드 래퍼(`GameBoard.tsx:29`)가 `relative … aspect-square`이고, 그 안에 `GridContainer`(z-1) · `LaserCanvas`(z-2, `pointer-events-none`) · `PiecePopover`가 형제로 쌓여 있다.
펜 캔버스는 **같은 방식의 형제 `<canvas>` (z-3)** 로 추가하면 되고, 리사이즈/dpr 처리 로직은 이미 `useLaserCanvas` / `setupCanvas()`에 검증된 패턴이 있어 그대로 재사용한다.

리스크는 코드가 아니라 **상호작용 충돌**(펜 모드 vs 드래그앤드롭/회전)과 **좌표 정합**(그리드 리사이즈·창 크기 변화 시 그림이 어긋나지 않게)이며, 둘 다 아래 설계로 해소한다.

---

## 3. 사용자 시나리오

1. 플레이 중 보드 근처 **✏️ 펜 버튼**을 눌러 펜 모드 진입.
2. 색(파랑/초록/빨강) 선택 → 그리드 셀 위나 보드 여백에 손으로 보조선·메모를 그린다.
3. 잘못 그리면 **지우개** 또는 **되돌리기(획 단위)**, 전부 지우려면 **모두 지우기**.
4. 다시 ✏️ 버튼을 눌러 펜 모드를 끄면 그림은 남은 채로 **기물 조작(드래그·회전·클릭)** 이 정상 동작.
5. 맵을 바꾸면 그림은 사라진다 (맵별 독립). 같은 맵으로 돌아오면 필요 시 복원(선택 구현, §7 저장 범위 참고).

---

## 4. UI / UX

### 4.1 진입점 (펜 툴바)

보드 우상단 또는 하단 `StatusBar`에 **✏️ 펜 토글 버튼**. 활성 시 팔레트 형태의 미니 툴바 노출:

```
[✏️ 펜]  ← 토글 (on이면 강조)
 └ 활성 시 펼쳐지는 툴바:
   ● 파랑   ● 초록   ● 빨강        (색 3종, 현재 색 강조)
   🩹 지우개                       (획 위를 지나가면 삭제 or 픽셀 지우기)
   ↩︎ 되돌리기 (획 단위)
   🗑️ 모두 지우기 (requestConfirm 확인)
```

- 버튼은 전부 공용 프리미티브(`IconButton` / `Button`) + `Pill`로 조립. 인라인 hover 스타일 금지 (CLAUDE.md).
- 선(획) 굵기는 1차 고정(예: 3px). 필요 시 2단(가늘게/굵게) 후속.

### 4.2 색 토큰

CLAUDE.md **"색은 토큰만"** 규칙 준수. 하드코딩 hex 금지.
`src/styles/global.css`의 `:root` + `.dark`에 펜 전용 토큰 3종 추가:

```css
:root  { --pen-blue: #3b82f6; --pen-green: #22c55e; --pen-red: #ef4444; }
.dark  { --pen-blue: #60a5fa; --pen-green: #4ade80; --pen-red: #f87171; }
```

다크모드에서도 보드 배경(`--grid-bg`) 대비가 확보되도록 라이트/다크 각각 채도·명도 조정.
(레이저 색 `--laser`가 red 계열이므로, 펜 빨강은 레이저와 살짝 구분되게 톤 조정.)

### 4.3 그리기 영역 — "그리드나 그 주변"

현재 보드 래퍼는 그리드와 정확히 같은 크기라 **여백에 그릴 공간이 없다.**
따라서 펜 레이어는 그리드보다 넓은 영역을 덮어야 한다.

**설계:** 보드 래퍼 바깥에 **패딩을 준 스케치 컨테이너**(예: 그리드 한 변의 ~12% 여백)를 두고,
그 안쪽에 그리드(+레이저) 래퍼를 중앙 배치. 펜 캔버스는 스케치 컨테이너 전체를 채운다.

```
┌─ 스케치 컨테이너 (relative, 그리드보다 큼) ─────────┐
│   ┌─ 여백(그리기 가능) ─────────────────────┐      │
│   │        ┌── 보드 래퍼(aspect-square) ──┐  │      │
│   │        │  GridContainer  (z-1)        │  │      │
│   │        │  LaserCanvas    (z-2)        │  │      │
│   │        └──────────────────────────────┘  │      │
│   └────────────────────────────────────────────┘   │
│   PenCanvas (absolute inset-0, z-3)  ← 전체를 덮음   │
└──────────────────────────────────────────────────────┘
```

- 여백은 레이아웃을 밀지 않도록 반응형 폭 안에서 흡수 (모바일 좁은 화면에서는 여백 축소).
- 펜 캔버스가 z-3으로 그리드/레이저 위에 오지만, **펜 모드 off일 때 `pointer-events:none`** 이라 아래 조작을 그대로 통과시킨다.

---

## 5. 상호작용 충돌 해소 (핵심)

기존 입력은 전부 Pointer Events (`useGridDragDrop`) + 우클릭 회전 + `GridContainer`의 `touch-none`.
펜 모드와 반드시 배타적으로 분리한다.

| 상태 | 펜 캔버스 `pointer-events` | 그리드/DnD | 비고 |
|------|---------------------------|-----------|------|
| 펜 모드 **off** (기본) | `none` (통과) | 정상 | 그림은 보이되 클릭은 아래로 |
| 펜 모드 **on** | `auto` (캡처) | 차단됨 | 캔버스가 위에서 포인터 독점 |

- 펜 모드 on 동안에는 캔버스가 모든 pointerdown/move/up을 소비 → 아래 기물 드래그·회전·선택이 트리거되지 않음.
- 펜 캔버스도 `touch-none`(터치 스크롤 방지) + `setPointerCapture`로 획 연속성 확보 (DnD 엔진과 동일 패턴).
- **되돌리기 단축키 충돌:** 기물 Undo는 `Ctrl/Cmd+Z`. 펜 되돌리기는 **툴바 버튼 전용**으로 두어 충돌 회피 (또는 펜 모드 on일 때만 Ctrl+Z를 펜 undo로 가로채기 — 1차는 버튼만 권장).
- 펜 모드 진입 시 열려 있던 `PiecePopover`/선택 상태는 닫는다(선택 해제).

---

## 6. 데이터 모델 & 렌더

### 6.1 획(stroke) 저장 형식 — 정규화 좌표

리사이즈(창 크기·그리드 5↔9 변경)에도 그림이 어긋나지 않도록, 픽셀이 아닌 **0~1 정규화 좌표**로 점을 저장한다.

```ts
interface PenPoint { x: number; y: number; }        // 0..1, 스케치 컨테이너 기준
interface PenStroke {
  color: 'blue' | 'green' | 'red';                  // 토큰 키 (→ var(--pen-*))
  width: number;                                     // 논리 px (그릴 때 컨테이너 폭 비례로 스케일)
  points: PenPoint[];
}
```

- 그리기: pointermove마다 정규화 좌표 point push → 현재 획을 즉시 렌더.
- 리사이즈/dpr 변경: `setupCanvas()`로 백킹스토어 재설정 후, 저장된 정규화 좌표를 새 크기에 곱해 **전체 다시 그리기** (레이저 캔버스가 resize에서 하는 것과 동일 전략).
- 지우개: 1차는 **획 단위 삭제**(획 hit-test) 권장 — 픽셀 지우개보다 정규화 모델과 궁합이 좋고 구현이 단순. 후속으로 픽셀 지우개 고려.

### 6.2 상태 위치 — Zustand 스토어

`gameStore`에 추가 (단일 스토어 원칙):

```ts
// 상태
penMode: boolean;                 // 펜 모드 on/off
penColor: 'blue'|'green'|'red';
penTool: 'draw' | 'erase';
penStrokes: PenStroke[];          // 현재 맵의 그림
// 액션
setPenMode / setPenColor / setPenTool
addPenStroke(stroke)              // 그리기 완료 시
undoPenStroke()                   // 마지막 획 제거
clearPenStrokes()                 // 전체 삭제 (requestConfirm 후)
```

- 획 배열이 커질 수 있으므로 부분 구독은 `useShallow`, 렌더 컴포넌트는 `penStrokes`만 구독.
- `penStrokes`는 맵 전환(`loadMapForPlay`, `toggleMode`, `enterMapEditMode`) 시 **초기화** — 다른 맵에 그림이 새지 않게. (누수 방지는 기존 팔레트 누수 테스트와 같은 사고방식.)

---

## 7. 저장 범위 (Persistence)

세 단계 중 택1. **권장: (B) 세션/로컬 한정.**

| 옵션 | 동작 | 장점 | 단점 |
|------|------|------|------|
| (A) 휘발 | 맵 전환·새로고침 시 사라짐 | 가장 단순, 부작용 0 | 실수로 날림 |
| **(B) 로컬 저장** | `localStorage`에 `mapId`별 그림 보관 | 같은 맵 재방문 시 복원, 서버 무관 | 브라우저/기기 종속 |
| (C) 맵 문서 저장 | Firestore `MapDocument`에 포함 | 공유 가능 | **비권장** — 개인 필기이고, 공유형 데이터가 되면 보안/용량/편집권한 고려 필요 |

- **(B) 권장.** 기존 `useMapReactions`가 쓰는 `localStorage` 패턴과 동일하게, 키 `ray_pen_<mapId>`로 맵별 획 배열 저장.
- (C)는 명시적 요구가 생기기 전까지 배제. 저장하더라도 그림은 래스터가 아닌 좌표 배열이라 §CLAUDE.md의 config SVG XSS 우려와는 무관하나, 공유는 별도 기획으로 분리.

---

## 8. 구현 계획 (파일 단위)

| # | 작업 | 파일 |
|---|------|------|
| 1 | 펜 토큰 3종 추가 (`--pen-blue/green/red`, 라이트+다크) | `src/styles/global.css` |
| 2 | 스토어 상태·액션 추가 (`penMode`/`penColor`/`penTool`/`penStrokes` + 액션, 맵 전환 시 초기화) | `src/store/gameStore.ts` |
| 3 | `PenCanvas` 컴포넌트 (정규화 좌표 draw/erase, dpr 리사이즈 재그리기, `pointer-events` 토글) | `src/components/game/PenCanvas.tsx` (신규) |
| 4 | `usePenCanvas` 훅 (pointer 핸들러 + ResizeObserver + 재그리기) — `useLaserCanvas` 미러 | `src/hooks/usePenCanvas.ts` (신규) |
| 5 | 스케치 컨테이너로 보드 래핑 (여백 확보) + `PenCanvas` z-3 마운트 | `src/components/game/GameBoard.tsx` |
| 6 | 펜 툴바 UI (토글·색3·지우개·되돌리기·모두지우기) — 공용 프리미티브 | `src/components/game/PenToolbar.tsx` (신규) + `StatusBar.tsx`/`EditorPage.tsx` 배치 |
| 7 | 타입 정의 (`PenStroke`/`PenPoint`) | `src/types/game.ts` |
| 8 | (옵션 B) `localStorage` 맵별 저장/복원 | `gameStore.ts` 또는 소형 헬퍼 |
| 9 | 문서 갱신 (`PROJECT_HIERARCHY.md` 파일 목록·태스크 인덱스) | `PROJECT_HIERARCHY.md` |

**단계별 마일스톤**
- **M1 (MVP):** 토큰 + 스토어 + PenCanvas + 그리드 위 그리기 3색 + 모두지우기. (여백 없이 그리드 위만, 휘발.)
- **M2:** 여백 스케치 컨테이너, 지우개, 획 단위 되돌리기, 툴바 정식 UI.
- **M3:** (옵션 B) `localStorage` 맵별 저장/복원, 굵기 2단.

---

## 9. 테스트

- **단위(Vitest):** 정규화 좌표 ↔ 픽셀 변환 함수, `addPenStroke`/`undoPenStroke`/`clearPenStrokes` 스토어 액션, 맵 전환 시 `penStrokes` 초기화.
- **E2E(Playwright):** 펜 모드 on → 캔버스 드래그 시 획 추가 & 기물 미이동(충돌 격리), 펜 off → 기물 드래그 정상, 색 전환, 모두지우기 확인 다이얼로그(`requestConfirm`).
- 회귀: 펜 모드 off 기본값에서 기존 DnD/회전/팝오버 E2E 전부 그린 유지.

---

## 10. 열린 결정 사항 (구현 전 확정 필요)

1. **저장 범위:** (A) 휘발 / **(B) 로컬 맵별 저장(권장)** / (C) 맵 문서 저장. → §7
2. **그리기 영역:** 그리드 위만(단순) vs **그리드+여백(권장, "주변" 요구 충족)**. → §4.3
3. **펜 사용 모드:** 플레이(테스트) 전용 vs 편집 모드 포함 vs 전 모드. (편의도구이므로 전 모드 허용 무난.)
4. **되돌리기 단축키:** 툴바 버튼만(권장) vs 펜 모드 중 Ctrl+Z 가로채기.
5. **굵기·지우개:** 1차 고정 굵기 + 획단위 지우개(권장) vs 초기부터 굵기 선택/픽셀 지우개.

---

*작성: 2026-07-01 · 코드베이스 사전조사 반영 (보드 오버레이 구조, dpr 캔버스 패턴, 색 토큰 규칙, 스토어 단일화·누수 방지 원칙)*
