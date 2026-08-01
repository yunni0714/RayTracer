import { useGameStore } from '../../store/gameStore';
import { computeMapCategory, CATEGORY_LABELS, type MapCategory } from '../../lib/mapCategory';
import { Pill, type PillTone } from '../ui';
import type { MapItemDTO } from '../../types/game';

/* 맵 카테고리 배지 — mapData 에서 계산해 표시한다.
   기물 폴더 오버레이(config)가 나중에 로드되면 결과가 바뀌므로
   pieceConfigRev 를 구독한다 (MiniGrid 와 같은 이유). */

const CATEGORY_TONES: Record<MapCategory, PillTone> = {
  basic: 'catBasic',
  logic: 'catLogic',
  advanced: 'catAdvanced',
  advanced_logic: 'catAdvancedLogic',
};

export function MapCategoryBadge({ mapData, className }: { mapData: MapItemDTO[]; className?: string }) {
  useGameStore(s => s.pieceConfigRev);

  const category = computeMapCategory(mapData);
  return (
    <Pill tone={CATEGORY_TONES[category]} className={className} title="맵에 쓰인 기물 등급에서 자동 판정">
      {CATEGORY_LABELS[category]}
    </Pill>
  );
}
