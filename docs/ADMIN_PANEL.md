# Fable 인계 B2 — 어드민/콘피그 패널 (Firestore 공유)

> 브랜치 `claude/focused-meitner-loc4ey`. B1(라이브러리 L1) 완료·커밋 후 착수. 이건 **대형 신규 기능** — 시작 전 별도 구현 플랜을 짜라.
> 목적: 메이커(사용자)가 코드 수정 없이 **기물 SVG·기본 특성·표적 판정·레이저 동작 로직**을 직접 편집하고, 그 변경이 **Firestore로 모든 플레이어(배포본)에 반영**되게 한다.

## ⚠️ 선행 조건 — firestore.rules (보안)

현재 클라이언트가 Firestore에 직접 쓴다(`increment()` 등). **`firestore.rules`가 레포에 없다 = 기존 보안 갭.** 어드민 패널은 config 문서에 쓰기를 추가하므로, **반드시 먼저** `firestore.rules`를 레포에 커밋하고 배포해야 안전하다:

- `config/**` 쓰기 = **관리자 UID 화이트리스트만** 허용(`request.auth.uid in [...]`). 읽기는 전체 허용(런타임 오버레이가 읽어야 함).
- 기존 컬렉션(maps/users/suggestions) 규칙도 이 기회에 명시(작성자 UID 검증 등).
- 클라이언트 측 UID 게이트는 UI 숨김일 뿐 — **서버 강제는 rules가 한다.** 클라만으로는 누구나 콘솔에서 config 덮어쓰기 가능.

이 단계 없이 배포하면 임의 사용자가 전 플레이어의 기물 정의를 변조할 수 있다. rules 커밋·배포를 B2의 1번 작업으로.

## 데이터 모델 — Firestore `config/pieces` (단일 문서)

per-PieceType override 맵. 키 없으면 코드 기본값 사용(하위호환). 예:

```jsonc
{
  "version": 3,
  "pieces": {
    "target": {
      "svg": "<svg ...>...</svg>",          // SVG_ART override (옵션)
      "labelKo": "표적",                       // PIECE_LABELS override (옵션)
      "tab": "basic",                          // basic|intermediate|advanced
      "defaults": { "canRotate": false, "canMove": false, "isInventory": false },
      "rotationStep": 90,                      // 45|90
      "behavior": {                            // 레이저 동작 (아래)
        "kind": "target",
        "params": { "acceptRel": [90] }        // 정면 각도(상대각) 집합
      }
    }
    // ... 다른 타입 override
  }
}
```

## 런타임 오버레이 레이어

부팅 시(또는 실시간 구독) `config/pieces`를 로드해 **코드 기본값 위에 머지**:

- `src/lib/svgArt.ts` `SVG_ART` → `getSvgArt(type)`로 감싸 config.svg 우선.
- `src/lib/laserEngine.ts` `REGISTRY` → config.behavior로 동작 생성/override.
- `src/lib/pieceActions.ts` `PIECE_LABELS`, `NON_ROTATABLE`, `getRotationStep` → config 반영.
- 배치 기본값(`useGridDragDrop.ts` / 팔레트) → config.defaults 반영.
- **config 미존재/로드 실패 → 코드 기본값**(현재 동작 100% 보존). 절대 깨지지 않게 try/catch + fallback.

> 구현 팁: 기존 `REGISTRY`/`SVG_ART`를 "코드 기본값"으로 두고, `getRegistry()`/`getSvgArt()` 접근자를 만들어 config 머지 결과를 반환. 호출부를 접근자로 교체. config는 모듈 레벨 mutable 캐시 + 부팅 시 1회 fetch(또는 onSnapshot 구독).

## 레이저 동작 로직 — 두 단계 접근(사용자 합의: 둘 다 OK)

REGISTRY의 `interact`는 **코드 함수**라 데이터로 100% 표현 불가. 단계적으로:

**(1순위) 프리셋 + 파라미터 (데이터, 안전).** 동작을 `kind` + `params`로 표현:
- `passthrough` / `absorb` / `fullMirror{saBase}` / `halfMirror{saBase}` / `oneSidedMirror{normalBase,saBase}` / `target{acceptRel[]}` / `directionalGate{controlRel[],passRel[]}` / `emitter{...}` 등 — 기존 REGISTRY 동작을 파라미터화한 빌더로 매핑.
- 어드민 UI는 이 프리셋을 드롭다운 + 숫자/각도 입력으로 노출(사용자가 말한 **노드/블럭 에디터**는 이 프리셋 그래프의 시각화 형태).
- 대부분의 "특성 변경"은 여기서 커버 → 안전(임의 코드 없음).

**(2순위) 코드 편집창 (옵션, 보안 민감).** 프리셋으로 안 되는 신규 동작은 `interact` 본문을 텍스트로 입력 → `new Function('inDir','cell','active', body)`로 빌드.
- **보안 필수**: 관리자 전용 + Firestore rules로 쓰기 차단. 그래도 *읽는* 모든 플레이어가 그 코드를 실행하게 되므로 위험. 최소한:
  - 입력 검증/타임아웃/try-catch(예외 시 PASSIVE로 폴백).
  - 가능하면 Web Worker 격리 또는 제한적 표현식 파서.
  - 기본은 **2순위 비활성**, 명시적 토글로만 켜기. 문서에 위험 경고.
- 1순위로 최대한 커버하고, 2순위는 "고급/실험" 영역으로 분리 권장.

## 권한 / 인증

- 관리자 UID 화이트리스트: `src/lib/admin.ts`에 상수(또는 Firestore `config/admins`). `currentUserUid ∈ admins`일 때만 어드민 라우트/버튼 노출.
- 서버 강제는 firestore.rules(위). 클라 게이트는 UX용.

## UI

- 라우트 `/admin`(React Router) 또는 헤더의 관리자 전용 진입 + 전체화면 모달. 비관리자는 접근 차단/리다이렉트.
- 기물 목록(좌) → 선택 기물 편집(우):
  - SVG 편집(textarea) + 실시간 미리보기(`dangerouslySetInnerHTML`, 기존 ToolItem 렌더 재사용).
  - 기본 특성 폼(canRotate/canMove/isInventory, rotationStep, tab, label).
  - 표적 판정(isTarget + acceptRel 각도 선택).
  - 레이저 동작(프리셋 드롭다운 + params; 고급 토글 시 코드창).
- 저장 = Firestore `config/pieces` write(머지). 저장 즉시 로컬 오버레이 갱신 + 알림.
- 미저장 변경 경고, 기본값으로 리셋 버튼.

## 권장 구현 순서(커밋 분리)

1. `firestore.rules` 작성·커밋·배포(config admin-only write, 기존 컬렉션 규칙 명시).
2. 오버레이 레이어 + 접근자(`getRegistry`/`getSvgArt`/config fetch) — config 없으면 코드 기본값(회귀 0 확인, 기존 테스트 통과).
3. 어드민 라우트 + UID 게이트 + SVG/특성/표적 편집(데이터만, 코드창 제외).
4. 레이저 동작 프리셋 빌더 + 어드민 연동.
5. (옵션·후순위) 코드 편집창 + 격리/검증.

## 검증

- 각 단계 `npm run build`/`lint`/`test`. config 미존재 시 기존 엔진 테스트(`tests/*.test.ts`) 전부 통과(회귀 0)가 게이트.
- 오버레이 단위 테스트: config override가 SVG/동작/기본값에 반영되는지, 손상된 config가 폴백되는지.
- 수동: 관리자 로그인 → 기물 편집 → 저장 → 다른 브라우저(비관리자)에서 반영 확인. firestore.rules로 비관리자 write 거부 확인.
