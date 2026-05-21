# Changelog — Project Ray 레벨 에디터

이 파일은 Claude Code 작업 세션의 주요 변경 이력을 기록합니다.
형식: [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)

---

## [Unreleased]

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
