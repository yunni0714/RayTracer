import { MiniGrid } from '../../components/library/MiniGrid';
import { DifficultyPill, Pill, cx } from '../../components/ui';
import type { MapDocument } from '../../types/game';

/* 카탈로그 미리보기 — 편집 중인 정의로 실제 평가한 결과 (selectCatalogMaps).
   넓은 화면에서는 카탈로그 탭 오른쪽 전용 열, 좁은 화면에서는 편집 폼 아래에 붙는다.
   ⚠️ 어드민 미리보기이므로 revealRotation (라이브러리 썸네일 은닉 규칙 대상 아님). */

interface Props {
  maps: MapDocument[];      // 평가 결과 (정렬·limit 적용 후)
  totalCount: number;       // 전체 맵 수 (매칭 비율 표시용)
  pinnedMapIds: string[];
  loading?: boolean;
  error?: string | null;
  previewAsMe: boolean;
  onPreviewAsMe: (value: boolean) => void;
  className?: string;
}

export function CatalogPreviewPanel({
  maps, totalCount, pinnedMapIds, loading, error, previewAsMe, onPreviewAsMe, className,
}: Props) {
  return (
    <section className={cx('flex flex-col gap-2 min-h-0', className)}>
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">
          👁 미리보기
        </h5>
        {loading
          ? <span className="text-[11px] text-ink-muted">맵 불러오는 중…</span>
          : error
            ? <span className="text-[11px] text-danger">맵 목록 로드 실패</span>
            : <span className="text-[11px] text-ink-muted">
                매칭 <strong className="text-ink">{maps.length}</strong>개 / 전체 {totalCount}개
              </span>}
      </div>

      <label className="flex items-center gap-1 text-[11px] text-ink-muted shrink-0">
        <input
          type="checkbox"
          checked={previewAsMe}
          onChange={e => onPreviewAsMe(e.target.checked)}
        />
        내 계정 기준으로 평가
      </label>

      {maps.length === 0 ? (
        <p className="text-[11px] text-ink-muted py-2">조건에 맞는 맵이 없습니다.</p>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 pb-2">
            {maps.map((m, i) => (
              <div
                key={m.id}
                className="flex flex-col gap-1 p-1.5 border border-line rounded-tile bg-surface"
              >
                <div className="relative">
                  <MiniGrid mapData={m.mapData} revealRotation variant="v2" gridSize={m.gridSize ?? 5} />
                  <span className="absolute top-0.5 left-0.5 text-[9px] font-extrabold text-ink-muted bg-surface/80 px-1 rounded">
                    {i + 1}
                  </span>
                  {pinnedMapIds.includes(m.id) && (
                    <span className="absolute top-0.5 right-0.5 text-[10px]" title="고정 맵">📌</span>
                  )}
                </div>
                <span className="text-[11px] font-bold truncate" title={m.title}>
                  {m.title || '제목 없음'}
                </span>
                <div className="flex items-center gap-1 min-w-0">
                  <DifficultyPill difficulty={m.difficulty} className="!text-[9px] !px-1 !py-0" />
                  <span className="text-[10px] text-ink-muted truncate">{m.author || '작성자 없음'}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-ink-muted">
                  <Pill tone="neutral" className="!text-[9px] !px-1 !py-0">
                    {(m.gridSize ?? 5)}×{(m.gridSize ?? 5)}
                  </Pill>
                  <span>👍 {m.reactionOk ?? 0}</span>
                  <span>🌟 {m.reactionGod ?? 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
