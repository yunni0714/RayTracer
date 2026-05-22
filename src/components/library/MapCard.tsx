import { MiniGrid } from './MiniGrid';
import type { MapDocument, Difficulty } from '../../types/game';

interface Props {
  map: MapDocument;
  onClick: (map: MapDocument) => void;
}

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
  const evalLabel = userDiff ?? 'None';
  const dateStr = formatDate(map.createdAt);

  return (
    <div className="map-card-v2" onClick={() => onClick(map)}>
      {/* 상단: 미니 그리드 */}
      <div style={{ padding: '18px 18px 0' }}>
        <MiniGrid mapData={map.mapData} hideInventory variant="v2" />
      </div>

      {/* 메타: 제목 + 작성자 */}
      <div style={{ padding: '14px 20px 0' }}>
        <h4
          title={map.title}
          style={{
            margin: '0 0 4px',
            fontSize: 20,
            fontWeight: 800,
            color: '#1e293b',
            letterSpacing: '-0.5px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {map.title || '제목 없음'}
        </h4>
        <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
          {map.author} · {dateStr}
        </p>
      </div>

      {/* 구분선 자리 */}
      <div style={{ height: 0 }} />

      {/* 하단: 배지 + 통계 */}
      <div style={{ padding: '6px 20px 14px', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', minWidth: 0 }}>
          <span className={`diff-pill diff-${map.difficulty}`} style={{ flex: '1 1 0' }}>
            공식: {map.difficulty}
          </span>
          <span className={`diff-pill diff-${evalLabel}`} style={{ flex: '1 1 0' }}>
            평가: {evalLabel}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, fontSize: 15, fontWeight: 700 }}>
          <span style={{ color: '#27ae60' }}>✅ {map.reactionOk}</span>
          <span style={{ color: '#ef4444' }}>👍 {map.reactionGod}</span>
        </div>
      </div>
    </div>
  );
}
