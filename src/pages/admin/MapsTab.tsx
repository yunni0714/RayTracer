import { TabPlaceholder } from './TabPlaceholder';

// 어드민 [맵 관리] 탭 — 백본 자리표시자.
export function MapsTab() {
  return (
    <TabPlaceholder
      icon="🗺"
      title="맵 관리"
      note="업로드된 맵 목록·검색·메타 편집·삭제가 들어갈 자리입니다. 세부 기능은 아직 정해지지 않았습니다."
    />
  );
}
