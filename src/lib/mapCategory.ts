import { getPieceFolder } from './pieceConfig';
import type { MapItemDTO } from '../types/game';

/* ════════════════════════════════════════════════════════
   맵 카테고리 — 맵에 쓰인 기물 등급에서 파생되는 값.
   작성자가 고르는 게 아니라 mapData 에서 계산하므로 DB 필드가 없다.

     초급만     → Classic
     중급 포함   → Logic
     상급 포함   → Advanced   (중급 동반 여부와 무관)

   등급 출처는 팔레트 폴더(getPieceFolder) — 어드민이 기물을 다른 폴더로
   옮기면 카테고리도 따라 바뀐다. 기본 3폴더 밖(커스텀 폴더/커스텀 기물)은
   중급으로 본다 (getPieceFolder 의 기본 폴백과 동일).
   인벤토리(유저 지급) 기물도 포함 — 플레이어가 배치해 푸는 데 쓰인다.

   ⚠️ 레거시 id: 예전 스키마는 4종('basic'/'logic'/'advanced'/'advanced_logic')
      이었다. 저장된 카탈로그 config 가 옛 값을 갖고 있을 수 있으므로
      normalizeCategory() 로 승격해서 읽는다 (basic→classic, advanced_logic→advanced).
   ════════════════════════════════════════════════════════ */

export type MapCategory = 'classic' | 'logic' | 'advanced';
export type PieceTier = 'basic' | 'intermediate' | 'advanced';

export const CATEGORY_LABELS: Record<MapCategory, string> = {
  classic: 'Classic',
  logic: 'Logic',
  advanced: 'Advanced',
};

export const CATEGORY_ORDER: readonly MapCategory[] = ['classic', 'logic', 'advanced'];

const LEGACY_CATEGORY_ALIASES: Record<string, MapCategory> = {
  basic: 'classic',
  advanced_logic: 'advanced',
};

// 저장된 값(레거시 포함)을 현재 카테고리 id 로. 알 수 없으면 undefined.
export function normalizeCategory(raw: unknown): MapCategory | undefined {
  if (typeof raw !== 'string') return undefined;
  if ((CATEGORY_ORDER as readonly string[]).includes(raw)) return raw as MapCategory;
  return LEGACY_CATEGORY_ALIASES[raw];
}

export function getPieceTier(type: string): PieceTier {
  const folder = getPieceFolder(type);
  return folder === 'basic' || folder === 'advanced' ? folder : 'intermediate';
}

export function computeMapCategory(items: MapItemDTO[] | undefined): MapCategory {
  let hasIntermediate = false;
  for (const item of items ?? []) {
    const tier = getPieceTier(item.type);
    if (tier === 'advanced') return 'advanced';
    if (tier === 'intermediate') hasIntermediate = true;
  }
  return hasIntermediate ? 'logic' : 'classic';
}
