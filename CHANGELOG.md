# Changelog — Project Ray 레벨 에디터

이 파일은 Claude Code 작업 세션의 주요 변경 이력을 기록합니다.
형식: [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)

---

## [Unreleased]

---

## [0.7.0] - 2026-05-21

### Added
- 구글 계정 로그인 (`signInWithPopup` + 팝업 차단 시 `signInWithRedirect` 자동 전환)
- 최초 로그인 시 닉네임 설정 모달 (`#nicknameModal`)
- 닉네임 변경 모달 (`#changeNicknameModal`) — 헤더 유저 메뉴 드롭다운에서 접근
- Firestore `users/{uid}` 컬렉션: 닉네임 / 가입일 저장
- 헤더 로그인 버튼 (`#loginBtn`) / 유저 메뉴 (`#userMenu`) + 드롭다운 UI
- 맵 업로드 시 닉네임 자동 입력 + readonly 처리
- `scripts/migrate-author-uid.mjs`: 기존 익명 UID → 구글 UID 일괄 교체 스크립트 (1회용)

### Changed
- 익명 자동 로그인 제거 — 비로그인 상태로 앱 진입 가능
- 에디터/테스트 모드 전환 버튼 (`#modeToggleBtn`) 표시 조건 변경
  - **표시**: 새 맵 만들기 / 맵 수정 모드 진입 시
  - **숨김**: 라이브러리 맵 플레이 시 / 앱 최초 진입 / 수정 모드 종료 시

### Fixed
- 비로그인 시 평가·투표·제안·업로드 시도 시 로그인 안내 알림으로 통일
- 로그인/로그아웃 시 맵 소유권 UI(`수정/삭제 버튼`) 즉시 갱신

---

## [0.6.0] - 2026-05-21

### Added
- 맵 인플레이스 수정 모드 (`isMapEditMode` 플래그 + `body.is-map-edit-mode` 클래스)
  - 본인 맵에서 "✏️ 맵 수정하기" 클릭 시 좌측 인벤토리/정답 보기 → 기물 창고 + 특성 부여 창고로 전환
  - 우측 패널은 탭 토글 숨김 + 풀이제안만 고정 노출
  - 헤더에 💾 수정 저장하기 / ❌ 취소 버튼 (CSS 가시성 토글)
  - 수정 모드 중 제안 카드의 "이 풀이로 테스트" 버튼은 숨김 (작업 덮어쓰기 방지)
  - `dragAndDrop.js`: `enterMapEditMode()`, `exitMapEditMode({ restore })` 신규 export
- 맵 버전 필드 (`version`)
  - 신규 업로드 시 `version: 1`
  - 수정 저장 시 +1, `playMapFromLibrary`에서 `version >= 2` 면 제목 옆 `(ver. N)` 표시
- 수정 모달 readonly 처리: `openUploadForEdit` 진입 시 `mapTitle.readOnly = true`, `mapAuthor.readOnly = true`, `closeUploadModal` 진입 시 원복
- `dragAndDrop.js` `resetEditorState()` export — 그리드/인벤토리/백업/undo를 자기 모듈 안에서 일관되게 초기화

### Fixed
- "✨ 새 맵 만들기" 가 마지막 맵을 그대로 보여주던 버그
  - `libraryController.js:createNewMap()` 안의 `playerInventory = {}` / `editorMapDataBackup = null` 은 **다른 모듈의 import 바인딩에 대한 재할당** 이라 ES 모듈 규칙상 TypeError 발생 → 이후 그리드 시각 초기화 / 패널 숨김이 실행되지 않았음
  - `resetEditorState()` 호출로 교체
- "📖 정답 보기" 토글 ON 시 그리드에는 정답이 표시되지만 인벤토리 영역이 그대로 남던 버그
  - `dragAndDrop.js:showAnswer()` 의 `applyMapData(...)` 직후 `renderInventoryUI()` 호출 추가
- 평가 배지 "diff-None" 이 다른 배지와 그림자/굵기 차이로 vote 버튼처럼 보이던 문제 (`box-shadow` 통일)

### Changed
- 카드 메타 ↔ 배지 사이 약 25px 빈 공간 제거 (`.card-meta` padding-bottom 제거, `.card-divider` 시각만 0px 처리, `.card-bottom` padding-top 축소)
- 난이도 배지 한 줄 고정 (`flex-wrap: nowrap` + 폰트 14→12px, padding 8/14 → 6/10, `flex: 1 1 0`, `text-overflow: ellipsis`)
- 가로 스크롤 섹션 카드 hover 시 상단 클리핑 방지 (`padding-top: 12px`, `margin-top: -8px`)
- 헤더의 `#modeToggleBtn` 노출 (기존 `display:none` 제거)

---

## [0.5.0] - 2026-05-21

### Added
- 풀이 제안 카드 가로 레이아웃 v2 (미니 그리드 38% + 코멘트 + 우측 액션 버튼)
  - `createMiniGridV2()` 재사용으로 1:1 비율 그리드 보장
- 풀이 제안 권한별 UI 분기
  - 맵 주인: 모든 카드에 "이 풀이로 테스트" + "🗑️ 삭제" 버튼
  - 비주인: 본인 제안에만 삭제 버튼, 타인 제안은 테스트 버튼만
- 풀이 제안 목록 내부 스크롤 (max-height 536px, 카드 약 3개 노출)
- 정답 보기 토글 버튼 (레이저 토글과 동일 패턴)
  - ON: applyMapData로 원본 배치 적용, 인벤토리 임시 비움, 레이저 실행
  - OFF: 사용자 배치 + 인벤토리 복원
  - 새 맵 로드 / 모드 전환 시 자동 리셋 (resetAnswerState)

### Fixed
- 정답 보기: innerHTML 조작만 하던 기존 코드 → applyMapData + refreshLaser 경로로 수정
  (그리드에 정답이 반영되지 않고 알림만 뜨던 버그)
- 풀이 테스트 버튼 클릭 시 정답 보기 상태 자동 해제

---

## [0.4.0] - 2026-05-21

### Fixed
- 다음문제 카드 미니 그리드 1:1 비율 깨짐
  - `style.css`의 `.mini-grid-v2` / `.mini-cell-v2` 셀렉터에서 `.map-card-v2` 부모 제약 제거
  - `.next-map-card` 컨텍스트에서도 `display:grid` + `aspect-ratio:1/1` 적용됨
- 테스트 모드에서 에디터 전용 컨트롤이 노출되는 문제
  - `body.is-test-mode .actions { display:none }` / `body.is-test-mode #output { display:none }` 추가

### Added
- Tutor 난이도 신규 추가 (Easy보다 쉬운 튜토리얼 레벨, 파란색 `#3498db`)
  - `index.html`: 투표 버튼 `#btnVoteTutor`, 업로드 모달 select 옵션, CSS 색상
  - `uiController.js`: `packedData.diffVotes` 에 `Tutor: 0` 포함
  - `libraryController.js`: `calculateUserDifficulty()` 총계에 Tutor 반영
  - `main.js`: `btnVoteTutor` 클릭 이벤트 리스너
  - `style.css`: `.diff-pill.diff-Tutor` 색상 규칙

---

## [0.3.0] - 2026-05-21

### Added
- 다음문제 패널 카드 가로 레이아웃 완전 재설계
  - 미니 그리드(44%) + 정보 영역(나머지) 수평 배치
  - 제목 / 제작자·날짜 / 맵 설명 / 배지(공식+평가 난이도) / 통계(✅ 🔥) 구조
- 우측 사이드 패널 너비 340 → 420px 확대
- 반응형 breakpoint 1280 → 1400px 변경 (`@media (max-width: 1400px)`)
- 맵 설명(description) 필드 전반 추가
  - 업로드/수정 모달에 `textarea#mapDesc` 추가
  - `uiController.js`: `packAndUploadMap()` / `openUploadForEdit()` / `closeUploadModal()` 반영
  - `libraryController.js`: `renderNextMapPanel()` 카드에 description 표시
  - Firebase DB 스키마: 신규 업로드 시 `description` 필드 포함

---

## [0.2.1] - 2026-05-21

### Fixed
- `style.css`가 `index.html`에 `<link>` 태그로 연결되지 않아
  라이브러리 SVG 기물이 CSS Grid 없이 세로로 전체 화면에 렌더링되는 버그
- `.map-card-v2 .card-meta`의 `margin-top: 0` 미지정으로 인한 인라인 스타일 캐스케이드 충돌

---

## [0.2.0] - 2026-05-21

### Added
- 라이브러리 카드 디자인 전면 교체 (`.map-card-v2`)
  - 상단: 5×5 미니 그리드 미리보기
  - 하단: 제목 / 제작자·날짜 / 난이도 배지 / 반응 통계(✅ 🔥)
- 라이브러리 레이아웃 재구성
  - Featured / Original 맵: 수평 스크롤 섹션
  - Recent Maps: `repeat(auto-fill, minmax(260px, 1fr))` 반응형 그리드
  - 검색·정렬·새 맵 만들기 인라인 컨트롤
- 우측 사이드 패널 (`#rightSidePanel`) 신규 도입
  - 수직 탭 — 다음문제 / 풀이제안
  - 맵 로드 시 표시, 새 맵 만들기 시 숨김
- 정답 보기 버튼 (`#answerBtn`)
  - 테스트 모드 진입 시 표시
  - 3초간 원본 배치 오버레이 후 자동 복원
- `dragAndDrop.js`: `showAnswer()` 내보내기
- `main.js`: `window._getCurrentMapObj` / `window._setCurrentMapNull` 순환참조 해결 브릿지

---

## [0.1.0] - 2026-05-20

### Added
- `CODEBASE_REPORT.md`: 전체 코드베이스 심층 분석 문서 작성
  - 프로젝트 개요, 파일 구조, 모듈 의존성 그래프
  - 각 모듈(firebaseApp, dragAndDrop, laserEngine, libraryController, uiController) 상세 분석
  - Firebase 데이터 모델, 기물 전체 목록, 에디터/테스트 모드 동작 설명
  - 기술적 특이사항(block 레이저 통과, 회전 스텝 조건 등) 정리
