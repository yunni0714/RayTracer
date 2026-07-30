import { TabPlaceholder } from './TabPlaceholder';

// 어드민 [제안 관리] 탭 — 백본 자리표시자.
export function SuggestionsTab() {
  return (
    <TabPlaceholder
      icon="💬"
      title="제안 관리"
      note="맵별 풀이 제안 조회·미리보기·삭제가 들어갈 자리입니다. 세부 기능은 아직 정해지지 않았습니다."
    />
  );
}
