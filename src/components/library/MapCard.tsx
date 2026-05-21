import { MiniGrid } from './MiniGrid';
import type { MapDocument, Difficulty } from '../../types/game';

const DIFF_COLORS: Record<Difficulty, string> = {
  Tutor: 'bg-diff-tutor',
  Easy: 'bg-diff-easy',
  Normal: 'bg-diff-normal',
  Hard: 'bg-diff-hard',
  Insane: 'bg-diff-insane',
};

interface Props {
  map: MapDocument;
  onClick: (map: MapDocument) => void;
}

function calculateUserDifficulty(diffVotes: Partial<Record<Difficulty, number>>): Difficulty | null {
  const entries = Object.entries(diffVotes) as [Difficulty, number][];
  if (entries.length === 0) return null;
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function MapCard({ map, onClick }: Props) {
  const userDiff = calculateUserDifficulty(map.diffVotes);

  return (
    <button
      onClick={() => onClick(map)}
      className="flex flex-col border border-gray-200 rounded-lg overflow-hidden bg-white hover:shadow-md hover:border-ray-purple transition-all text-left w-full"
    >
      <div className="flex justify-center p-3 bg-gray-50">
        <MiniGrid mapData={map.mapData} hideInventory size={120} />
      </div>
      <div className="p-3 flex flex-col gap-1">
        <p className="font-semibold text-gray-800 text-sm truncate">{map.title}</p>
        <p className="text-xs text-gray-500">{map.author} · {formatDate(map.createdAt)}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`px-2 py-0.5 rounded text-white text-xs font-medium ${DIFF_COLORS[map.difficulty]}`}>
            {map.difficulty}
          </span>
          {userDiff && userDiff !== map.difficulty && (
            <span className={`px-2 py-0.5 rounded text-white text-xs font-medium opacity-70 ${DIFF_COLORS[userDiff]}`}>
              체감 {userDiff}
            </span>
          )}
        </div>
        <div className="flex gap-2 text-xs text-gray-500 mt-1">
          <span>✅ {map.reactionOk}</span>
          <span>👍 {map.reactionGod}</span>
        </div>
      </div>
    </button>
  );
}
