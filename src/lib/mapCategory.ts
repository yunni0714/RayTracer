import { getPieceFolder } from './pieceConfig';
import type { MapItemDTO } from '../types/game';

/* ════════════════════════════════════════════════════════
   맵 카테고리 — 맵에 쓰인 기물 등급에서 파생되는 값.
   작성자가 고르는 게 아니라 mapData 에서 계산하므로 DB 필드가 없다.

     초급만          → Basic
     중급 포함        → Logic
     상급 포함        → Advanced
     중급 + 상급 동시  → Advanced Logic

   등급 출처는 팔레트 폴더(getPieceFolder) — 어드민이 기물을 다른 폴더로
   옮기면 카테고리도 따라 바뀐다. 기본 3폴더 밖(커스텀 폴더/커스텀 기물)은
   중급으로 본다 (getPieceFolder 의 기본 폴백과 동일).
   인벤토리(유저 지급) 기물도 포함 — 플레이어가 배치해 푸는 데 쓰인다.
   ════════════════════════════════════════════════════════ */

export type MapCategory = 'basic' | 'logic' | 'advanced' | 'advanced_logic';
export type PieceTier = 'basic' | 'intermediate' | 'advanced';

export const CATEGORY_LABELS: Record<MapCategory, string> = {
  basic: 'Basic',
  logic: 'Logic',
  advanced: 'Advanced',
  advanced_logic: 'Advanced Logic',
};

export function getPieceTier(type: string): PieceTier {
  const folder = getPieceFolder(type);
  return folder === 'basic' || folder === 'advanced' ? folder : 'intermediate';
}

export function computeMapCategory(items: MapItemDTO[] | undefined): MapCategory {
  let hasIntermediate = false;
  let hasAdvanced = false;
  for (const item of items ?? []) {
    const tier = getPieceTier(item.type);
    if (tier === 'advanced') hasAdvanced = true;
    else if (tier === 'intermediate') hasIntermediate = true;
    if (hasAdvanced && hasIntermediate) break;
  }
  if (hasAdvanced && hasIntermediate) return 'advanced_logic';
  if (hasAdvanced) return 'advanced';
  if (hasIntermediate) return 'logic';
  return 'basic';
}
