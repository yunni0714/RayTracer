# Fable 인계 B3 — 기물 관리 (커스텀 폴더 + 기물 생성/삭제)

> 브랜치 `claude/focused-meitner-loc4ey`. B2(면별 어드민) **위에** 얹는 확장. 시작 전 별도 구현 플랜 필수.
> 선행: `docs/ADMIN_PANEL.md`(면별 모델·오버레이) + `docs/PIECE_TAXONOMY.md` 읽기. firestore.rules 의 `config/**` admin-write 규칙은 이미 있음(추가 작업 없음).
> 핵심 원칙(B2 와 동일): **config 미존재/손상 → 코드 기본값 100% 보존**. 기존 맵·기존 타입 동작 불변(회귀 0).

이 문서 두 가지: **(1) 커스텀 폴더 + 드래그 할당**, **(2) 기물 생성 + 삭제(통합)**. 둘 다 어드민(`/admin`) + 런타임 오버레이(`pieceConfig.ts`) + 팔레트(`PalettePanel.tsx`) 에 걸침.

---

## 현재 구조 (바꿀 지점)

- **타입**: `PieceType` = `src/types/game.ts` 의 **컴파일타임 닫힌 유니온**(29종). `CellData.type`/`MapItemDTO.type`/`SelectedTool.type` 가 이걸 씀.
- **per-type 맵(코드 기본값)**: `SVG_ART`(`svgArt.ts`), `DEFAULT_DEFS`/`REGISTRY`(`laserEngine.ts`), `PIECE_LABELS`/`NON_ROTATABLE`(`pieceActions.ts`), `DEFAULT_TABS`/`DEFAULT_PIECE_DEFAULTS`(`pieceConfig.ts`).
- **접근자**(오버레이 머지): `getSvgArt`, `getBehavior`/`getBehaviorDef`, `getPieceLabel`, `getPieceTab`, `getPieceDefaults`. 미지 타입 → `PASSIVE`(통과) + 빈 SVG.
- **탭**: `tab: 'basic'|'intermediate'|'advanced'`(`PieceTab`). `pieceConfig` `DEFAULT_TABS`/`getPieceTab`/`tabOverrides`, `PalettePanel` 하드코딩 `BASIC_TOOLS/INTERMEDIATE_TOOLS/ADVANCED_TOOLS` + `Tabs`(초급/중급/상급), `AdminPage` 좌측 목록은 `PALETTE_ORDER` + `getPieceTab` 로 그룹.
- **config 문서**: Firestore `config/pieces` = `{ version, pieces: { [type]: PieceConfigEntry } }`. `applyPieceConfig` 가 머지, `sanitizeEntry` 가 검증(현재 **미지 타입은 skip**: `if (!(type in DEFAULT_DEFS)) skip`).
- **맵 로드**: `App.tsx`/`LibraryScreen`/`NextMapPanel`/`gameStore.loadMapForPlay` 가 `mapData` → 그리드. 셀 type 그대로 보존.

---

## (1) 커스텀 폴더 + 드래그 할당

### 데이터 모델
`config/pieces` 문서에 **폴더 목록** 추가, 엔트리에 **folderId** 추가:
```jsonc
{
  "version": 2,
  "folders": [                              // 신규. 없으면 기본 3폴더로 마이그레이션
    { "id": "basic", "name": "초급", "order": 0 },
    { "id": "intermediate", "name": "중급", "order": 1 },
    { "id": "advanced", "name": "상급", "order": 2 },
    { "id": "custom_xxx", "name": "내 폴더", "order": 3 }
  ],
  "pieces": {
    "mirror": { "folderId": "custom_xxx" }   // tab → folderId 대체
  }
}
```
- **하위호환**: 엔트리에 `folderId` 없고 옛 `tab` 있으면 `folderId = tab`. 둘 다 없으면 코드 기본 `DEFAULT_TABS[type]`. `folders` 없으면 기본 3폴더 생성. → 기존 config 무손상.
- `PieceTab` 자리화: `getPieceTab` → `getPieceFolder(type): string`. `pieceConfig` 에 `folderOverrides`/`getFolders()` 추가. 기본 폴더 3개는 항상 존재 보장(삭제 불가 or 삭제 시 재생성).

### 팔레트 (에디터) — `PalettePanel.tsx`
- 하드코딩 `BASIC/INTERMEDIATE/ADVANCED_TOOLS` + 고정 `Tabs` 제거 → **`getFolders()` 로 동적 탭** 렌더.
- 각 탭 = 그 `folderId` 를 가진 기물(빌트인은 `PALETTE_ORDER` 순서 유지, 커스텀은 생성 순/order). `getPieceFolder(type)` 로 매칭.
- 빈 폴더는 탭 숨김(or 회색). `hidden` 기물 제외(아래 (2)).
- 주의: `getRotationStep` 의 `isAdvancedMap`(45°/90° 결정)은 **하드코딩 `ADVANCED_TYPES`(pieceActions) 기반 — 폴더와 무관**. 폴더는 순수 표시용이므로 건드리지 말 것(회전 스텝 회귀 방지).

### 어드민 — `AdminPage.tsx`
- 좌측 기물 목록을 **폴더별 섹션**(접이식)으로. 폴더 헤더에: 이름 편집(inline), 삭제(휴지통), 순서(↑↓ or drag).
- **드래그 할당**: 기물 항목 `draggable` → 폴더 섹션 `onDragOver`/`onDrop` → 그 기물 `folderId` = 폴더. 무의존 HTML5 DnD(`dataTransfer` 에 type 실어 보냄). 터치 대비는 후순위(데스크탑 어드민 가정).
- 폴더 CRUD: 추가(새 id=slug+name), 이름변경, 삭제(그 폴더 기물 전부 첫 폴더로 재할당, 기본 3폴더는 삭제 막거나 재생성), 순서(order).
- 저장 = `config/pieces` 에 `folders` + 각 기물 `folderId` 머지.

### 검증
- `folders` 없는 기존 config → 기본 3폴더로 정상 표시(회귀 0).
- 폴더 추가→기물 드래그→저장→새로고침 유지, 다른 브라우저(플레이어) 팔레트에도 반영.
- 폴더 삭제 시 기물 유실 없이 재할당.

---

## (2) 기물 생성 + 삭제 (통합)

### 타입 개방
`PieceType`(닫힌 유니온)은 빌트인 29종 정체성으로 **유지**하되, 저장·렌더 경계는 **문자열**을 허용:
- `src/types/game.ts`: `CellData.type`/`MapItemDTO.type`/`SelectedTool.type`/`InventoryItem.type` 를 `string` 로 넓힘(또는 `type AnyPieceType = string` 도입). `invKey` 등 문자열로 동작 OK.
- 접근자(`getSvgArt`/`getBehavior`/`getBehaviorDef`/`getPieceLabel`/`getPieceFolder`/`getPieceDefaults`) 시그니처를 `(type: string)` 로 넓힘. 빌트인이면 코드 기본 머지, 커스텀이면 config-only, **둘 다 없으면 안전 폴백**:
  - behavior → `PASSIVE`(통과) — 빔이 그냥 지나감, 크래시 X.
  - svg → 플레이스홀더(예: 점선 박스 + `?`).
  - label → config.labelKo ?? type 문자열.
- TS exhaustiveness: 빌트인 union 을 쓰던 `switch`/`Record<PieceType,...>` 들이 string 으로 넓히면 깨질 수 있음 — 컴파일 에러 따라가며 접근자/기본맵을 `Partial`/lookup 으로 정리. **이게 이 작업의 핵심 비용.**

### config: 커스텀 타입 허용 — `pieceConfig.ts`
- `applyPieceConfig` 의 `if (!(type in DEFAULT_DEFS)) skip` → **완화**: 빌트인 아니어도, 엔트리가 **behavior(유효 def) + svg 둘 다** 있으면 커스텀 타입으로 등록. (둘 중 하나라도 없으면 skip — 렌더/엔진 불가.)
- 커스텀 타입 id 검증: `^[a-z0-9_]+$`, 빌트인 `PieceType` 집합과 충돌 금지, 길이 제한.
- 등록된 커스텀 타입 목록을 노출(`getCustomTypes(): string[]`) — 팔레트/어드민이 빌트인+커스텀 합쳐 렌더.

### 생성 UI — `AdminPage.tsx`
- "➕ 새 기물" 버튼 → id(slug)·이름·폴더 입력 → config 엔트리 생성(기본 behavior=전면 `pass`, 빈 svg, defaults 전부 false). 그 후 일반 편집(면 그리드·SVG·특성)으로 채움.
- 좌측 목록에 커스텀 기물도 폴더별로 표시(빌트인과 구분 배지).

### 삭제(통합) — 버튼 하나
- **빌트인 타입**: 진짜 삭제 불가(코드 정의) → 엔트리에 **`hidden: true`** 세팅. 팔레트·어드민 목록에서 숨김(어드민은 "숨김" 배지 + 복구 토글로 표시).
- **커스텀 타입**: config 엔트리 **완전 제거**(`deletePieceConfigEntry`).
- 삭제 전 경고: "이 기물을 쓰는 맵은 해당 칸이 비활성(통과)로 보일 수 있음"(맵 스캔은 안 함 — 일반 경고).

### 맵 복원력 (필수)
커스텀 타입을 쓴 맵이 config 삭제/미로드 상태로 열릴 때:
- 맵 로드(`gameStore.loadMapForPlay`/`App.tsx`/`LibraryScreen`/`NextMapPanel`)는 미지 타입 셀도 **버리지 말고 보존** — 렌더는 플레이스홀더 SVG, 동작은 `PASSIVE`(통과), 승리판정 제외(isTarget 아님).
- 절대 크래시/throw 금지. `getSvgArt`/`getBehavior` 폴백이 이걸 보장.
- 저장(`UploadModal.buildMapData`)은 type 문자열 그대로 직렬화(이미 `...cell` 스프레드라 OK — string 화만 확인).

### `PieceConfigEntry` 확장 (`pieceConfig.ts` + `sanitizeEntry`)
```ts
interface PieceConfigEntry {
  svg?: string;
  labelKo?: string;
  folderId?: string;     // 신규 (tab 대체, tab 도 읽어 하위호환)
  hidden?: boolean;      // 신규 (빌트인 "삭제"=숨김)
  defaults?: Partial<PieceDefaults>;
  behavior?: PieceBehaviorDef;
}
```
- `sanitizeEntry`: folderId(string·존재 폴더), hidden(bool) 검증 추가. 커스텀 타입은 behavior+svg 필수 검사.

### 검증 (회귀 게이트)
- **config 없음 → 기존 29종·기존 맵 100% 동일**(빌트인 union/switch 정리해도 동작 불변). `tests/*.test.ts` 전부 통과.
- 커스텀 타입 생성→배치→맵 저장→로드 정상. config 에서 그 커스텀 삭제 후 그 맵 로드 → 크래시 없이 플레이스홀더+통과.
- 빌트인 숨김→팔레트에서 사라짐, 복구→돌아옴. 기존 맵의 빌트인 동작엔 영향 없음.
- 신규 `vitest`: 미지/커스텀 타입 접근자 폴백, sanitize 거부 케이스.

---

## 구현 순서 (커밋 분리 권장)
1. 접근자/타입 경계 string 화 + 안전 폴백(플레이스홀더 SVG, PASSIVE) — **config 없이 회귀 0 확인**(이게 게이트).
2. config 커스텀 타입 허용(`applyPieceConfig` 완화 + 검증 + `getCustomTypes`).
3. 폴더 모델(folders/folderId, 하위호환) + `getFolders`/`getPieceFolder`.
4. 팔레트 동적 폴더 렌더.
5. 어드민: 폴더 CRUD + 드래그 할당.
6. 어드민: 새 기물 생성 + 삭제(빌트인 숨김 / 커스텀 제거) + 맵 복원력.

## 컨벤션
- 버튼=`src/components/ui` `Button`/`IconButton`(인라인 hover/hex 금지·토큰만). 배지=`Pill`. 확인=`requestConfirm`.
- DnD 무의존(HTML5 draggable). 새 npm 의존 추가 금지.
- 어떤 단계도 config 부재 시 기존 동작/테스트를 깨면 안 됨(회귀 0 = 상시 게이트).
