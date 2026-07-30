import { Navigate, Link, useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../../store/gameStore';
import { isAdminUid } from '../../lib/admin';
import { Notification } from '../../components/layout/Notification';
import { Button, Tabs, ConfirmHost } from '../../components/ui';
import { PiecesTab } from './PiecesTab';
import { MapsTab } from './MapsTab';
import { SuggestionsTab } from './SuggestionsTab';
import { StatsTab } from './StatsTab';

/* ════════════════════════════════════════════════════════
   어드민 셸 — 관리자 게이트 + 상단바 + 탭 라우팅.
   탭 상태는 URL 이 단일 진실 (/admin/:tab) — 새로고침·딥링크 보존.
   Notification / ConfirmHost 는 여기에 한 번만 마운트한다.
   ⚠️ 이 게이트는 UI 숨김일 뿐 — 실제 쓰기 권한 강제는 firestore.rules.
   ════════════════════════════════════════════════════════ */

const TABS = [
  { id: 'pieces', label: '🧩 기물', Body: PiecesTab },
  { id: 'maps', label: '🗺 맵 관리', Body: MapsTab },
  { id: 'suggestions', label: '💬 제안 관리', Body: SuggestionsTab },
  { id: 'stats', label: '📊 통계', Body: StatsTab },
] as const;

const DEFAULT_TAB = TABS[0].id;

export function AdminLayout() {
  const currentUserUid = useGameStore(s => s.currentUserUid);
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  if (!isAdminUid(currentUserUid)) {
    return <Navigate to="/" replace />;
  }

  // 알 수 없는 슬러그는 기본 탭으로 URL 째 정리 (뒤로가기에 남지 않게 replace)
  const active = TABS.find(t => t.id === tab);
  if (!active) {
    return <Navigate to={`/admin/${DEFAULT_TAB}`} replace />;
  }

  const Body = active.Body;

  return (
    <div className="flex flex-col h-screen bg-canvas text-ink">
      <header className="flex items-center gap-3 px-4 py-2 bg-surface border-b border-line shadow-card">
        <h1 className="text-lg font-extrabold tracking-tight mr-auto">🛠 어드민</h1>
        <Link to="/">
          <Button variant="secondary">← 에디터로</Button>
        </Link>
      </header>

      <Tabs
        items={TABS.map(t => ({ id: t.id, label: t.label }))}
        value={active.id}
        onChange={id => navigate(`/admin/${id}`)}
      />

      <main className="flex-1 min-h-0 overflow-hidden">
        <Body />
      </main>

      <Notification />
      <ConfirmHost />
    </div>
  );
}
