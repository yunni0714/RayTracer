# 별개 기능 트랙 — 상태형 기믹 기물 + 넓은 그리드

UI 리디자인(Phase 1~5)과 **무관한 별도 기능 트랙**. 게임 로직(레이저 엔진) 재작성이라 UI 작업과 섞지 말 것. 작업 시 별도 플랜으로 진행 권장.

> 설계 출처: 세션 초반 탐색 + Plan 에이전트 설계. 핵심만 박제.

---

## 1. 왜 (문제)

현재 `src/lib/laserEngine.ts`는 **단일패스 BFS**(빔 큐 + `visited "x,y,dir"`)로, 빔을 그리며 동시에 캔버스에 직접 그린다(`drawLine` 인라인). 한계:
- **조건부 기물 불가**: "다른 빔이 와야 통과/발사"되는 기물은 빔 간 상호의존 → 단일패스로 못 풂.
- 거대 if/else 분기(기물당 1블록), 승리 판정 없음, 캔버스 없이는 단위테스트 불가.
- `GRID_SIZE=5`·`CELL_SIZE=100` 컴파일타임 상수, 스키마에 그리드 크기 필드 없음.

---

## 2. 추가할 기물 (사용자 요청 목록)

**Group A — 무상태(현 구조 + 분기 추가로 가능):**
- `diode` 다이오드(일방터널): rotation 화살표 방향만 통과
- `v_mirror_double`/`v_half` 수직 양면거울/반거울: 축 빔 180° 되돌림(상급: 대각 90° 반사), 반거울은 통과도
- `small_target` 소형표적: 수직축 통과, 정면 흡수+충족(상급: 두 대각 통과)
- `omni_target` 전방위표적: 어느 방향이든 흡수+충족
- `high_block` 높은블럭: 빔 완전 차단 (주의: 기존 `block`은 **통과**임 — 별개 타입)

**Group B — 조건부/상태형(고정점 엔진 필요):**
- `transistor_gate` 관문: 아래(제어축) 피격 시 좌우(수직축) 통과 개방
- `cross_gate` 교차관문: H·V 둘 다 있어야 둘 다 통과(AND)
- `priority_gate` 우선순위관문: 둘 다 오면 직선축만 통과
- `target_projector` 표적프로젝터(광집기): 측면 피격 시에만 발사(켜짐형 표적+에미터)
- `inverting_projector` 반전프로젝터(가변추출기): 기본 발사, 다른 3면 피격 시 꺼짐

핵심 사실: 위 목록은 **색깔/타입 빔 불필요**, **포탈쌍 같은 per-instance 설정 불필요**(방향은 기존 `rotation`). → beam 구조체·`MapItemDTO` 스키마 per-instance 확장 **불필요**. 막는 건 오직 "빔 간 상호의존" → 고정점 반복.

---

## 3. 엔진 재작성 (단계)

1. **계산/렌더 분리**: `computeLaser(mapData, gridSize): LaserResult`(순수, `BeamSegment[]` 누적 + 셀별 incidence 기록) + `drawSegments(ctx, segments, cellSize)`. 기존 `simulateLaser`는 둘을 잇는 얇은 래퍼. → 캔버스 없이 단위테스트 가능.
2. **데이터드리븐 레지스트리**: 거대 if/else → `Record<PieceType, PieceBehavior>`. 기존 13개 거울 분기를 `fullMirror/halfMirror/oneSidedMirror` 헬퍼 + (normalBase, saBase) 테이블로 흡수. `calculateReflection` 재사용.
3. **고정점(fixpoint) 루프**: 조건부 기물 상태가 수렴할 때까지 반복:
   - 조건부 상태 초기화(게이트 닫힘, 프로젝터 기본값) → 전체 빔 추적(셀별 incidence 기록) → 조건부 기물 `resolve(incidence)`로 open/emit 재평가 → 직전과 같아지면 종료.
   - `MAX_ITERS=8` 캡, 미수렴(진동)이면 해당 셀 OFF 강제 후 최종 1패스 → **결정적 종결**. 게이트 판정은 *직전 패스* incidence로(큐 순서 무관) → 순서 결정성.
4. **승리 판정**: `LaserResult.solved` = 필수 타겟 전부 충족. (현재 없음 — UI 승리연출도 여기 연결.)

타입: `BeamSegment{x1,y1,x2,y2,partial}`, `CellIncidence{dirs:Set,controlHit,satisfied}`, `LaserResult{segments,incidence,solved,targets...}`, `PieceBehavior{role,interact(inDir,ctx),resolve?,emit?}`.

---

## 4. 넓은 그리드 (균일 NxN)

- `MapDocument.gridSize?: number`(없으면 5) 추가, `version` bump. **`MapItemDTO` 불변.**
- `GRID_SIZE` 런타임화: `emptyGrid(size)` 파라미터화, store에 `gridSize` 상태, `loadMapForPlay`서 `mapDoc.gridSize ?? 5`.
- **역직렬화기 5곳** 경계검사 `< GRID_SIZE` → `< size`: `App.tsx`, `gameStore`(showAnswer), `NextMapPanel`, `LibraryScreen.mapDocToGrid`, `SuggestionPanel.testSuggestion`, `UploadModal`. `MiniGrid`는 `gridSize` prop.
- **CSS 하드코딩 제거**: `tailwind.config.js`(미사용 `game-grid`), `global.css` `.mini-grid-v2 repeat(5,...)` → 인라인 `repeat(size,1fr)`.
- 캔버스/`GridContainer` `CELL_SIZE*gridSize`. `useGridDragDrop.getCellFromPoint` 경계 `< gridSize`.
- 하위호환: 모든 읽기 `?? 5`. 기존 Firebase 맵(필드 없음)은 5×5로 그대로. 마이그레이션 스크립트 불필요.
- 구클라이언트 보호: `REGISTRY[type] ?? passive`로 미지 타입 no-op.

---

## 5. 검증 / 위험

- **Vitest 도입**(현재 e2e만): 순수 엔진 단위테스트 — 거울 in→out, 고정점(게이트 개방·projector→gate 체인·진동 가드 결정성), `solved` 카운트, seed 셔플 시 동일 출력.
- 골든 스냅샷: 리팩터 전후 `segments` 동일(거울 동작 잠금).
- 위험: 고정점 진동(캡+OFF 강제로 종결), 순서 결정성(직전 패스 incidence), 다중패스 성능(수렴 조기종료로 보통 1~2패스), 기존맵 하위호환.

---

## 6. 보안 (별건이지만 같이)

`firestore.rules`가 레포에 없음. 반응/투표를 클라이언트가 직접 `increment()` 씀(`firebaseService.ts`). 서버 규칙 없으면 카운트 조작·임의 삭제 가능. **규칙을 레포에 커밋**해 리뷰·이력 남길 것.

---

*이 트랙은 UI(Phase 1~5) 완료 후, 또는 완전히 독립된 세션/플랜으로 진행. 한 세션에서 UI와 같이 줄 경우에도 별도 태스크로 명확히 분리할 것.*
