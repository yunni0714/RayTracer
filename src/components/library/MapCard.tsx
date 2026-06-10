import { MiniGrid } from './MiniGrid';
import { Pill, type PillTone } from '../ui';
import type { MapDocument, Difficulty } from '../../types/game';

interface Props {
  map: MapDocument;
  onClick: (map: MapDocument) => void;
}

const DIFF_TONE: Record<Difficulty, PillTone> = {
  Tutor: 'tutor', Easy: 'easy', Normal: 'normal', Hard: 'hard', Insane: 'insane',
};

function calculateUserDifficulty(diffVotes: Partial<Record<Difficulty, number>>): Difficulty | null {
  const entries = Object.entries(diffVotes) as [Difficulty, number][];
  if (entries.length === 0) return null;
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
  } catch {
    return '';
  }
}

export function MapCard({ map, onClick }: Props) {
  const userDiff = calculateUserDifficulty(map.diffVotes);
  const dateStr = formatDate(map.createdAt);

  return (
    <div className="map-card-v2" onClick={() => onClick(map)}>
      {/* 상단: 미니 그리드 */}
      <div className="px-[18px] pt-[18px]">
        <MiniGrid mapData={map.mapData} hideInventory variant="v2" gridSize={map.gridSize ?? 5} />
      </div>

      {/* 메타: 제목 + 작성자 */}
      <div className="px-5 pt-3.5">
        <h4 className="mb-1 text-xl font-extrabold tracking-tight text-ink whitespace-nowrap overflow-hidden text-ellipsis" title={map.title}>
          {map.title || '제목 없음'}
        </h4>
        <p className="text-[13px] font-medium text-ink-muted">
          {map.author} · {dateStr}
        </p>
      </div>

      {/* 하단: 배지 + 통계 */}
      <div className="px-5 pt-1.5 pb-3.5 flex flex-col gap-2.5 mt-auto">
        <div className="flex gap-1.5 min-w-0">
          <Pill tone={DIFF_TONE[map.difficulty]} className="flex-1">
            공식: {map.difficulty}
          </Pill>
          <Pill tone={userDiff ? DIFF_TONE[userDiff] : 'none'} className="flex-1">
            평가: {userDiff ?? 'None'}
          </Pill>
        </div>
        <div className="flex justify-end gap-3.5 text-[15px] font-bold">
          <span className="text-success">✅ {map.reactionOk}</span>
          <span className="text-danger">👍 {map.reactionGod}</span>
        </div>
      </div>
    </div>
  );
}
