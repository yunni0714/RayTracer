import { useMemo } from 'react';
import { computeMapStats, DIFFICULTIES } from '../../lib/adminMaps';
import { DifficultyPill } from '../../components/ui';
import type { AdminMapsState } from './useAdminMaps';
import type { MapDocument } from '../../types/game';

/* [맵 마스터 › 통계] — 맵 수·반응 합계·난이도 분포·Top 5 (ADMIN.html 통계 탭 이식).
   맵 목록은 MapMasterTab 이 이미 로드해 두므로 별도 조회가 없다. */

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 min-w-[120px] bg-surface border border-line rounded-tile p-3 flex flex-col gap-1">
      <span className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">{label}</span>
      <span className="text-xl font-extrabold tracking-tight">{value}</span>
    </div>
  );
}

function TopTable({ title, maps, primary }: { title: string; maps: MapDocument[]; primary: 'god' | 'ok' }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">{title}</h5>
      <div className="overflow-x-auto border border-line rounded-tile bg-surface">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line text-ink-muted">
              <th className="text-left font-bold px-3 py-2">제목</th>
              <th className="text-right font-bold px-3 py-2 whitespace-nowrap">{primary === 'god' ? '🌟 God' : '👍 Ok'}</th>
              <th className="text-right font-bold px-3 py-2 whitespace-nowrap">{primary === 'god' ? '👍 Ok' : '🌟 God'}</th>
              <th className="text-left font-bold px-3 py-2">난이도</th>
            </tr>
          </thead>
          <tbody>
            {maps.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-4 text-center text-ink-muted">맵이 없습니다.</td></tr>
            ) : maps.map(m => (
              <tr key={m.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2 max-w-[280px] truncate" title={m.title}>{m.title || '제목 없음'}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {primary === 'god' ? (m.reactionGod ?? 0) : (m.reactionOk ?? 0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {primary === 'god' ? (m.reactionOk ?? 0) : (m.reactionGod ?? 0)}
                </td>
                <td className="px-3 py-2"><DifficultyPill difficulty={m.difficulty} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function StatsTab({ admin }: { admin: AdminMapsState }) {
  const stats = useMemo(() => computeMapStats(admin.maps), [admin.maps]);

  if (admin.error) {
    return <p className="p-8 text-center text-xs text-danger">맵 목록을 불러오지 못했습니다 — {admin.error}</p>;
  }
  if (admin.loading) {
    return <p className="p-8 text-center text-xs text-ink-muted">불러오는 중…</p>;
  }

  return (
    <div className="h-full overflow-y-auto p-4 flex flex-col gap-5 max-w-4xl">
      <section className="flex flex-col gap-1.5">
        <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">📈 전체 현황</h5>
        <div className="flex gap-2 flex-wrap">
          <StatCard label="전체 맵" value={stats.total} />
          <StatCard label="총 👍 반응" value={stats.totalOk} />
          <StatCard label="총 🌟 반응" value={stats.totalGod} />
        </div>
      </section>

      <section className="flex flex-col gap-1.5">
        <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">🎯 난이도별 분포</h5>
        <div className="flex gap-2 flex-wrap">
          {DIFFICULTIES.map(d => (
            <div key={d} className="flex-1 min-w-[100px] bg-surface border border-line rounded-tile p-3 flex flex-col gap-1 items-start">
              <DifficultyPill difficulty={d} />
              <span className="text-xl font-extrabold tracking-tight">{stats.byDifficulty[d]}</span>
            </div>
          ))}
        </div>
      </section>

      <TopTable title="🌟 God 반응 Top 5" maps={stats.topGod} primary="god" />
      <TopTable title="👍 Ok 반응 Top 5" maps={stats.topOk} primary="ok" />

      <div className="pb-8" />
    </div>
  );
}
