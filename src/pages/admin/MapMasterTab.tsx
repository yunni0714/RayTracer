import { Navigate, useParams, useNavigate } from 'react-router-dom';
import { Tabs } from '../../components/ui';
import { useAdminMaps } from './useAdminMaps';
import { MapsTab } from './MapsTab';
import { StatsTab } from './StatsTab';

/* 맵 마스터 — 맵 관련 관리 기능 묶음.
   맵 목록은 여기서 한 번 로드해 서브탭이 공유한다 (탭 전환 시 재조회 없음).
   서브탭 상태도 URL 이 단일 진실: /admin/mapmaster/:sub (AdminLayout 과 같은 폴백 규칙).
   ⚠️ 구 [제안 관리] 서브탭은 [맵 관리] 카드의 메타 편집 패널로 흡수됐다 —
      옛 링크(/admin/mapmaster/suggestions)는 알 수 없는 슬러그로 맵 관리에 폴백된다. */

const SUB_IDS = ['maps', 'stats'] as const;
type SubId = typeof SUB_IDS[number];

const SUB_LABELS: Record<SubId, string> = {
  maps: '🗺 맵 · 제안 관리',
  stats: '📊 통계',
};

const DEFAULT_SUB: SubId = 'maps';

export function MapMasterTab() {
  const { sub } = useParams<{ sub?: string }>();
  const navigate = useNavigate();
  const admin = useAdminMaps();

  const active = SUB_IDS.find(s => s === sub);
  if (!active) {
    return <Navigate to={`/admin/mapmaster/${DEFAULT_SUB}`} replace />;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-surface border-b border-line">
        <Tabs
          variant="segment"
          items={SUB_IDS.map(id => ({ id, label: SUB_LABELS[id] }))}
          value={active}
          onChange={id => navigate(`/admin/mapmaster/${id}`)}
        />
        <span className="ml-auto text-[11px] text-ink-muted">
          {admin.loading ? '맵 불러오는 중…' : `맵 ${admin.maps.length}개`}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {active === 'maps' && <MapsTab admin={admin} />}
        {active === 'stats' && <StatsTab admin={admin} />}
      </div>
    </div>
  );
}
