import { Navigate, useParams, useNavigate } from 'react-router-dom';
import { Tabs } from '../../components/ui';
import { MapsTab } from './MapsTab';
import { SuggestionsTab } from './SuggestionsTab';
import { StatsTab } from './StatsTab';

/* 맵 마스터 — 맵 관련 관리 기능 묶음.
   서브탭 상태도 URL 이 단일 진실: /admin/mapmaster/:sub (AdminLayout 과 같은 폴백 규칙). */

const SUBS = [
  { id: 'maps', label: '🗺 맵 관리', Body: MapsTab },
  { id: 'suggestions', label: '💬 제안 관리', Body: SuggestionsTab },
  { id: 'stats', label: '📊 통계', Body: StatsTab },
] as const;

const DEFAULT_SUB = SUBS[0].id;

export function MapMasterTab() {
  const { sub } = useParams<{ sub?: string }>();
  const navigate = useNavigate();

  const active = SUBS.find(s => s.id === sub);
  if (!active) {
    return <Navigate to={`/admin/mapmaster/${DEFAULT_SUB}`} replace />;
  }

  const Body = active.Body;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 px-4 py-2 bg-surface border-b border-line">
        <Tabs
          variant="segment"
          items={SUBS.map(s => ({ id: s.id, label: s.label }))}
          value={active.id}
          onChange={id => navigate(`/admin/mapmaster/${id}`)}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <Body />
      </div>
    </div>
  );
}
