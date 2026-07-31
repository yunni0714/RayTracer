import { useEffect, useState } from 'react';
import {
  getCatalogs, isBuiltinCatalogId, loadCatalogConfig, type CatalogDef, type CatalogRule,
} from '../../lib/catalogConfig';
import { Pill, cx } from '../../components/ui';

/* 카탈로그 편집 — 라이브러리 카탈로그(구 카테고리) 정의를 어드민에서 관리한다.
   지금은 백본: config/catalog 오버레이를 읽어 목록만 보여준다.
   메타·규칙·수동 큐레이션 편집 폼과 저장 경로는 세부 확정 후 채운다. */

function ruleSummary(rule: CatalogRule | undefined): string {
  if (!rule) return '규칙 없음';
  switch (rule.kind) {
    case 'all': return '전체 맵';
    case 'mine': return '로그인 사용자의 맵';
    case 'author': return `작성자 = ${rule.author}`;
    case 'reaction': {
      const label = rule.field === 'reactionGod' ? '🌟 God' : '👍 Ok';
      const parts = [
        rule.min !== undefined ? `${rule.min}개 이상` : null,
        rule.top !== undefined ? `상위 ${rule.top}개` : null,
      ].filter(Boolean);
      return `${label} ${parts.join(' · ') || '기준'}`;
    }
  }
}

function Section({ title, note }: { title: string; note: string }) {
  return (
    <section className="border border-line rounded-tile p-3 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">{title}</h5>
        <Pill tone="neutral" className="!text-[9px] !px-1 !py-0">준비 중</Pill>
      </div>
      <p className="text-[11px] text-ink-muted leading-relaxed">{note}</p>
    </section>
  );
}

export function CatalogTab() {
  // 어드민 화면에서만 필요한 오버레이 — 앱 부팅 로더에 넣지 않는다.
  const [rev, setRev] = useState(0);
  const [selectedId, setSelectedId] = useState<string>(getCatalogs()[0]?.id ?? '');

  useEffect(() => {
    loadCatalogConfig().then(result => { if (result) setRev(r => r + 1); });
  }, []);

  const catalogs: CatalogDef[] = getCatalogs({ includeHidden: true });
  void rev; // config 적용 후 재렌더 트리거
  const selected = catalogs.find(c => c.id === selectedId) ?? catalogs[0];

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* 좌: 카탈로그 목록 */}
      <aside className="w-60 shrink-0 bg-surface border-r border-line p-2 overflow-y-auto flex flex-col gap-1">
        <h5 className="px-1 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">
          카탈로그 ({catalogs.length})
        </h5>
        {catalogs.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedId(c.id)}
            className={cx(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded-tile text-left text-xs transition-colors border',
              c.id === selected?.id ? 'bg-accent-soft border-accent' : 'border-transparent hover:bg-surface-2',
            )}
          >
            <span className="w-5 shrink-0 text-center" aria-hidden>{c.emoji ?? '📁'}</span>
            <span className={cx('min-w-0 flex-1 truncate font-medium', c.hidden && 'line-through opacity-50')}>
              {c.label}
            </span>
            {!isBuiltinCatalogId(c.id) && <Pill tone="info" className="!text-[9px] !px-1 !py-0">커스텀</Pill>}
            {c.hidden && <Pill tone="neutral" className="!text-[9px] !px-1 !py-0">숨김</Pill>}
          </button>
        ))}
      </aside>

      {/* 우: 선택 카탈로그 — 편집 화면 골격 */}
      <section className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 max-w-2xl">
        {selected ? (
          <>
            <header className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>{selected.emoji ?? '📁'}</span>
              <h2 className="text-base font-extrabold tracking-tight">{selected.label}</h2>
              <code className="text-[11px] text-ink-muted">{selected.id}</code>
              {isBuiltinCatalogId(selected.id) && <Pill tone="neutral">빌트인</Pill>}
              <span className="ml-auto text-[11px] text-ink-muted">순서 {selected.order}</span>
            </header>

            <p className="text-xs text-ink-muted">
              현재 적용 규칙: <strong className="text-ink">{ruleSummary(selected.rule)}</strong>
              {selected.pinnedMapIds?.length ? ` · 고정 ${selected.pinnedMapIds.length}개` : ''}
              {selected.excludedMapIds?.length ? ` · 제외 ${selected.excludedMapIds.length}개` : ''}
            </p>

            <Section
              title="메타"
              note="이름·이모지·순서·노출 여부 편집이 들어갈 자리입니다."
            />
            <Section
              title="규칙"
              note="맵을 자동으로 고르는 조건(작성자, 반응 수 임계값, 상위 N개 등)을 지정하는 자리입니다."
            />
            <Section
              title="수동 큐레이션"
              note="규칙과 무관하게 고정할 맵(pinnedMapIds)과 제외할 맵(excludedMapIds)을 지정하는 자리입니다."
            />

            <p className="text-[11px] text-ink-muted border-t border-line pt-3">
              저장 경로는 아직 없습니다 — 이 화면은 <code>config/catalog</code> 오버레이를 읽기만 합니다.
              라이브러리는 계속 코드 기본값으로 동작합니다.
            </p>
          </>
        ) : (
          <p className="text-xs text-ink-muted">카탈로그가 없습니다.</p>
        )}
      </section>
    </div>
  );
}
