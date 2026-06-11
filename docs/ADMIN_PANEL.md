# Fable 인계 B2 — 어드민/콘피그 패널 (Firestore 공유) · 면별 behavior 모델

> 브랜치 `claude/focused-meitner-loc4ey`. B1(라이브러리 L1) 완료·커밋 후 착수. **대형 신규 기능** — 시작 전 별도 구현 플랜 필수.
> 목적: 메이커(사용자)가 코드 수정 없이 **기물 SVG·기본 특성·면별 동작(표적/거울/통과/조건부)** 을 직접 편집하고, 변경이 **Firestore로 모든 플레이어(배포본)에 반영**되게 한다.
> 어휘 기준: `docs/PIECE_TAXONOMY.md`(사용자 정본 분류 — 레이저/거울/목표 3축, 면별 특성).

## 왜 면별(per-face) 모델인가

사용자 분류상 기물은 **3축(레이저/거울/목표)의 조합**이며 특성은 **면별**이다. 현재 엔진 한계:
- `target_mirror_a/b`, `v_target_mirror_a/b`(표적거울) = `oneSidedMirror`만 → **표적 기능 미구현**(표적면 맞춰도 클리어 불가, `isTarget` 없음).
- `tunnel`은 "관통해야 클리어"인 목표인데 satisfy 안 함.
- `InspectorPanel`은 표적 수를 `type.includes('target')`로 세는데 엔진은 `isTarget`만 → **에디터 통계 ≠ 엔진 판정**.

이 누락들을 **개별 하드코딩으로 땜질하지 않는다.** 사용자 결정: 면별 에디터를 만들고 **사용자가 각 기물의 면 특성을 직접 정의**한다("내가 알아서 넣을게"). 면별 선언 스키마 하나가 (1) 복합기물, (2) 위 누락, (3) 어드민 편집 UI, (4) 엔진 동작을 전부 커버한다.

## ⚠️ 선행 조건 — firestore.rules (보안)

현재 클라이언트가 Firestore에 직접 쓴다(`increment()` 등). **`firestore.rules`가 레포에 없다 = 기존 보안 갭.** config 쓰기를 추가하므로 **반드시 먼저** rules를 레포에 커밋·배포:

- `config/**` 쓰기 = **관리자 UID 화이트리스트만**(`request.auth.uid in [...]`). 읽기는 전체 허용(런타임 오버레이가 읽음).
- 기존 컬렉션(maps/users/suggestions)도 이 기회에 명시(작성자 UID 검증 등).
- 클라 UID 게이트는 UI 숨김일 뿐 — **서버 강제는 rules.** 없으면 누구나 콘솔에서 config 변조 → 전 플레이어 기물 정의 오염. **B2의 1번 작업.**

## 면별 효과 스키마 (PieceBehaviorDef)

기물 동작을 **입사 상대방향별 효과**로 선언. 엔진이 `interact`로 컴파일.

```ts
type FaceEffectKind = 'pass' | 'block' | 'absorb' | 'reflect' | 'split' | 'reverse';
//  pass    : 그대로 통과 (outDirs=[inDir])
//  block   : 표면 차단 (partial — 절반만 그림)
//  absorb  : 흡수 (빔 종료; 표적 흡수면)
//  reflect : 면각 반사 (calculateReflection(inDir, surfaceAngle+rotation))
//  split   : 반거울 (통과 + 반사 동시)
//  reverse : 180° 되돌림 (양면거울 정면축)

interface FaceEffect {
  kind: FaceEffectKind;
  surfaceAngle?: number; // reflect/split 면각(기물 기준, rotation 더해짐)
  satisfy?: boolean;     // 표적 충족 — 모든 kind와 겸용 (reflect+satisfy=표적거울, pass+satisfy=관통터널)
}

interface PieceBehaviorDef {
  faces: Partial<Record<0|45|90|135|180|225|270|315, FaceEffect>>; // relDir → 효과
  fallback: FaceEffect;            // 미지정 방향 (보통 block 또는 pass)
  rotationStep: 45 | 90;
  conditional?: { init: boolean; openWhenHitFaces: number[]; mode: 'any'|'all'|'none' }; // 게이트/프로젝터
  emit?: { fromRel: number; whenActive: boolean }; // 프로젝터 사출
  // isTarget = faces 중 satisfy:true 존재 시 자동 (별도 플래그 불필요)
}
```

### 엔진 컴파일 (개념)

```ts
function buildInteract(def: PieceBehaviorDef): PieceBehavior['interact'] {
  return (inDir, cell, active) => {
    const rel = (inDir - cell.rotation + 360) % 360;
    let fx = def.faces[rel] ?? def.fallback;
    if (def.conditional && !active && (fx.kind === 'pass' || fx.kind === 'reflect' || fx.kind === 'split'))
      fx = { kind: 'block' };                       // 닫힘 상태 = 차단
    const sa = ((fx.surfaceAngle ?? 0) + cell.rotation) % 360;
    switch (fx.kind) {
      case 'pass':    return { outDirs: [inDir], satisfied: fx.satisfy };
      case 'reverse': return { outDirs: [(inDir + 180) % 360], satisfied: fx.satisfy };
      case 'reflect': return { outDirs: [calculateReflection(inDir, sa)], satisfied: fx.satisfy };
      case 'split':   return { outDirs: [inDir, calculateReflection(inDir, sa)], satisfied: fx.satisfy };
      case 'absorb':  return { satisfied: fx.satisfy };
      case 'block':
      default:        return { partial: true, satisfied: fx.satisfy };
    }
  };
}
```

기존 `BeamOutcome`/`trace`/고정점 루프/`calculateReflection`(`src/lib/laserEngine.ts`)은 **그대로 재사용** — `interact`만 def에서 생성. `REGISTRY`는 함수 테이블 → **def 테이블**로 전환(코드에 기본 def 보관, 미지 타입은 PASSIVE).

### 기존 동작 → def 매핑 (회귀 검증 기준, 코드 기본값)

| 타입 | def 요지 |
|------|---------|
| `mirror` | 면 `reflect(135)` (양면), `half_mirror` = `split(135)` |
| `single_mirror` | 반사면 `reflect(135)` / 뒷면 `block` |
| `mirror_45`/`half_mirror_45` | `reflect/split(337.5)`, `rotationStep:45` |
| `target` (현재 수정본) | 정면 rel90 `absorb+satisfy` / fallback `absorb` |
| **`target_mirror_a/b`** (현재 버그) | 거울면 `reflect` / **표적박스 면 `reflect+satisfy`** / 뒷면 `block` |
| `small_target` | 정면 `absorb+satisfy` / 수직축 `pass` / 뒷면 `block` |
| `omni_target` | 전 면 `absorb+satisfy` |
| **`tunnel`** (목표화, 현재 누락) | 통과축 `pass+satisfy` / fallback `block` |
| `diode` | 진행축 `pass` / fallback `block` |
| `block` | fallback `pass` |  / `high_block` | fallback `block` |
| `transistor_gate`/`cross_gate`/`priority_gate` | `conditional`(openWhenHitFaces=제어면, mode any/all) + 축면 `pass` |
| `target_projector`/`inverting_projector` | `emit` + `conditional` + 면 효과 |

> **핵심**: `satisfy`를 모든 kind와 겸용으로 둔 게 요점 — 표적거울(reflect+satisfy), 관통터널(pass+satisfy)이 자연히 표현됨. 면별 def가 위 매핑대로 기존 동작을 **재현**하는지 = 회귀 게이트(아래 검증).

### 조건부/프로젝터 (게이트류) 주의

`conditional`은 직전 패스 입사면 집합을 `relDir`로 변환해 `openWhenHitFaces`/`mode`로 active 재평가 — 기존 고정점 루프(`computeLaser`)가 이미 이 패턴. `emit`은 active일 때 `fromRel` 방향 빔 소스 추가(기존 `emits` 분기 재사용). 면 스키마 + 루프 연계가 가장 복잡하니 별도 플랜 단계로.

## 데이터 모델 — Firestore `config/pieces` (단일 문서)

per-PieceType override. 키 없으면 코드 기본 def(하위호환).

```jsonc
{
  "version": 1,
  "pieces": {
    "target_mirror_a": {
      "svg": "<svg ...>",                 // 옵션
      "labelKo": "표적거울 A",              // 옵션
      "tab": "basic",                      // basic|intermediate|advanced
      "defaults": { "canRotate": false, "canMove": false, "isInventory": false },
      "behavior": {                        // = PieceBehaviorDef
        "rotationStep": 90,
        "fallback": { "kind": "block" },
        "faces": {
          "135": { "kind": "reflect", "surfaceAngle": 135 },
          "315": { "kind": "reflect", "surfaceAngle": 135, "satisfy": true }
        }
      }
    }
  }
}
```

## 런타임 오버레이 레이어

부팅 시(또는 onSnapshot 구독) `config/pieces` 로드 → **코드 기본값 위에 머지**:
- `src/lib/svgArt.ts` `SVG_ART` → 접근자 `getSvgArt(type)`.
- `src/lib/laserEngine.ts` `REGISTRY`(def 테이블) → `getBehavior(type)` = `buildInteract(merged def)`.
- `src/lib/pieceActions.ts` `PIECE_LABELS`/`NON_ROTATABLE`/`getRotationStep` → config 반영.
- 배치 기본값(`useGridDragDrop.ts`/팔레트) → `defaults`.
- **config 미존재/손상 → 코드 기본값**(현재 동작 100% 보존). try/catch + fallback, 절대 안 깨짐.
- 구현 팁: 기존 상수를 "코드 기본"으로 두고 접근자에서 머지 반환. 모듈 레벨 mutable 캐시 + 부팅 1회 fetch(또는 구독).

## 면별 에디터 UI

- 라우트 `/admin`(React Router) 또는 헤더 관리자 전용 진입 + 전체화면. 비관리자 차단/리다이렉트.
- 좌: 기물 목록. 우: 선택 기물 편집.
  - **SVG**(textarea) + 실시간 미리보기(`dangerouslySetInnerHTML`, ToolItem 렌더 재사용).
  - **면 그리드**: 8방향(90° 기물은 4면만 활성) 각 칸 = 효과 드롭다운(pass/block/absorb/reflect/split/reverse) + 면각 입력(reflect/split) + `satisfy` 체크. → 사용자가 말한 "노드/블럭" 시각화가 이 면 그리드.
  - **기물 레벨**: `fallback` 효과, `rotationStep`(45/90), `conditional`(제어면·mode), `emit`(사출면), `defaults`(canRotate/canMove/isInventory), `tab`, label.
  - `isTarget`은 satisfy 있으면 자동 배지.
- 저장 = `config/pieces` write(머지) → 즉시 로컬 오버레이 갱신 + 알림. 미저장 경고 + 기본값 리셋.

### 부수 정리
- `InspectorPanel`의 표적 수 카운트를 `type.includes('target')` → **`isTarget`(satisfy 보유) 기준**으로 바꿔 엔진 판정과 일치시킴.

## (후순위·옵션) 코드 편집창

면 스키마로 표현 안 되는 신규 동작만 `interact` 본문 텍스트 → `new Function(...)`. **보안 민감**(읽는 전 플레이어가 실행): 관리자 전용 + rules 차단 + 검증/타임아웃/예외 시 PASSIVE 폴백 + Web Worker 격리 권장. 기본 비활성, 명시 토글로만. **면 스키마로 최대 커버하고 이건 실험 영역.**

## 권한 / 인증
- 관리자 UID 화이트리스트: `src/lib/admin.ts` 상수(또는 `config/admins`). `currentUserUid ∈ admins`만 진입 노출. 서버 강제 = firestore.rules.

## 권장 구현 순서 (커밋 분리)
1. `firestore.rules` 작성·커밋·배포(config admin-only write, 기존 컬렉션 규칙).
2. `REGISTRY` → **def 테이블** 전환 + `buildInteract` + 접근자(`getBehavior`/`getSvgArt`). **config 없이 기존 엔진 테스트 전부 통과(회귀 0)** = 게이트.
3. 오버레이(config fetch/머지) + `defaults`/label/tab 반영.
4. 어드민 라우트 + UID 게이트 + SVG/특성 편집 + **면 그리드 에디터**(데이터). `InspectorPanel` 카운트 일치 수정.
5. 조건부/프로젝터 면 연계.
6. (옵션) 코드 편집창 + 격리.

## 검증
- 각 단계 `npm run build`/`lint`/`test`.
- **회귀 게이트**: config 미존재 시 `tests/*.test.ts`(laserEngine/groupA/groupB/gridSize) 전부 통과 = def가 기존 동작 재현.
- 오버레이 단위 테스트: override가 면효과/SVG/기본값에 반영되는지, 손상 config 폴백되는지.
- 수동: 관리자 로그인 → 표적거울 표적면 정의 → 저장 → 비관리자 브라우저 반영 + 그 기물로 맵 클리어 확인. rules로 비관리자 write 거부 확인.
