import { useGameStore } from '../../store/gameStore';
import { computeMapCategory, CATEGORY_LABELS, type MapCategory } from '../../lib/mapCategory';
import { Pill, cx, type PillTone } from '../ui';
import type { MapItemDTO } from '../../types/game';

/* 맵 카테고리 배지 — mapData 에서 계산해 표시한다.
   기물 폴더 오버레이(config)가 나중에 로드되면 결과가 바뀌므로
   pieceConfigRev 를 구독한다 (MiniGrid 와 같은 이유).

   variant='ribbon' 은 라이브러리 카드 우상단 세로 배너. 색은 CSS 가
   조상의 [data-category] 에서 고르므로(--cat-color) 여기서 톤을 주지 않는다. */

const CATEGORY_TONES: Record<MapCategory, PillTone> = {
  classic: 'catClassic',
  logic: 'catLogic',
  advanced: 'catAdvanced',
};

const TITLE = '맵에 쓰인 기물 등급에서 자동 판정';

interface Props {
  mapData: MapItemDTO[];
  className?: string;
  variant?: 'pill' | 'ribbon';
}

export function MapCategoryBadge({ mapData, className, variant = 'pill' }: Props) {
  useGameStore(s => s.pieceConfigRev);

  const category = computeMapCategory(mapData);
  const label = CATEGORY_LABELS[category];

  if (variant === 'ribbon') {
    return (
      <span className={cx('cat-ribbon', className)} title={TITLE} aria-label={`카테고리 ${label}`}>
        {label}
      </span>
    );
  }

  return (
    <Pill tone={CATEGORY_TONES[category]} className={className} title={TITLE}>
      {label}
    </Pill>
  );
}
