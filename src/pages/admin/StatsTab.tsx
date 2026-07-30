import { TabPlaceholder } from './TabPlaceholder';

// 어드민 [통계] 탭 — 백본 자리표시자.
export function StatsTab() {
  return (
    <TabPlaceholder
      icon="📊"
      title="통계"
      note="맵 수·반응 합계·난이도 분포 등 집계가 들어갈 자리입니다. 세부 기능은 아직 정해지지 않았습니다."
    />
  );
}
