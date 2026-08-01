import { describe, it, expect, afterEach } from 'vitest';
import { computeMapCategory, getPieceTier, normalizeCategory, CATEGORY_LABELS } from '../src/lib/mapCategory';
import { applyPieceConfig, resetPieceConfig } from '../src/lib/pieceConfig';
import type { MapItemDTO } from '../src/types/game';

afterEach(() => resetPieceConfig());

let seq = 0;
function item(type: string, extra: Partial<MapItemDTO> = {}): MapItemDTO {
  seq += 1;
  return {
    x: seq % 5, y: Math.floor(seq / 5) % 5, type, rotation: 0,
    canMove: false, canRotate: false, isInventory: false,
    ...extra,
  };
}

// 대표 기물 — pieceConfig 의 BASIC / INTERMEDIATE / ADVANCED 배열에서
const BASIC_PIECE = 'mirror';
const INTERMEDIATE_PIECE = 'cross_gate';
const ADVANCED_PIECE = 'mirror_45';

describe('getPieceTier', () => {
  it('빌트인 기물은 팔레트 폴더 등급을 따른다', () => {
    expect(getPieceTier(BASIC_PIECE)).toBe('basic');
    expect(getPieceTier(INTERMEDIATE_PIECE)).toBe('intermediate');
    expect(getPieceTier(ADVANCED_PIECE)).toBe('advanced');
  });

  it('미지 타입/커스텀 기물은 중급으로 본다', () => {
    expect(getPieceTier('nonexistent_piece')).toBe('intermediate');
  });
});

describe('computeMapCategory — 판정 규칙', () => {
  it('초급만 → classic', () => {
    expect(computeMapCategory([item('ray'), item(BASIC_PIECE), item('target')])).toBe('classic');
  });

  it('중급 포함 → logic', () => {
    expect(computeMapCategory([item('ray'), item(INTERMEDIATE_PIECE)])).toBe('logic');
  });

  it('상급 포함 → advanced', () => {
    expect(computeMapCategory([item('ray'), item(ADVANCED_PIECE)])).toBe('advanced');
  });

  it('중급 + 상급 동시 → advanced (중급 동반 여부는 무관)', () => {
    expect(computeMapCategory([item(INTERMEDIATE_PIECE), item(ADVANCED_PIECE)])).toBe('advanced');
    // 순서 무관
    expect(computeMapCategory([item(ADVANCED_PIECE), item(INTERMEDIATE_PIECE)])).toBe('advanced');
  });

  it('빈 맵/누락은 classic', () => {
    expect(computeMapCategory([])).toBe('classic');
    expect(computeMapCategory(undefined)).toBe('classic');
  });

  it('인벤토리(유저 지급) 기물도 계산에 포함한다', () => {
    const items = [
      item('ray'),
      item(INTERMEDIATE_PIECE, { isInventory: true, canMove: true }),
    ];
    expect(computeMapCategory(items)).toBe('logic');
  });

  it('커스텀/미지 기물이 있으면 logic 으로 올라간다', () => {
    expect(computeMapCategory([item('ray'), item('my_custom_piece')])).toBe('logic');
  });
});

describe('computeMapCategory — 어드민 폴더 오버라이드 반영', () => {
  it('초급 기물을 상급 폴더로 옮기면 같은 맵이 advanced 가 된다', () => {
    const items = [item('ray'), item(BASIC_PIECE)];
    expect(computeMapCategory(items)).toBe('classic');

    applyPieceConfig({ version: 2, pieces: { [BASIC_PIECE]: { folderId: 'advanced' } } });
    expect(computeMapCategory(items)).toBe('advanced');
  });

  it('중급 기물을 초급 폴더로 내리면 logic 이 아니게 된다', () => {
    const items = [item('ray'), item(INTERMEDIATE_PIECE)];
    expect(computeMapCategory(items)).toBe('logic');

    applyPieceConfig({ version: 2, pieces: { [INTERMEDIATE_PIECE]: { folderId: 'basic' } } });
    expect(computeMapCategory(items)).toBe('classic');
  });

  it('커스텀 폴더로 옮긴 기물은 중급 취급 (logic)', () => {
    const items = [item('ray'), item(BASIC_PIECE)];
    applyPieceConfig({
      version: 2,
      folders: [
        { id: 'basic', name: '초급', order: 0 },
        { id: 'intermediate', name: '중급', order: 1 },
        { id: 'advanced', name: '상급', order: 2 },
        { id: 'special', name: '특수', order: 3 },
      ],
      pieces: { [BASIC_PIECE]: { folderId: 'special' } },
    });
    expect(computeMapCategory(items)).toBe('logic');
  });

  it('리셋하면 코드 기본 폴더로 되돌아온다', () => {
    const items = [item('ray'), item(BASIC_PIECE)];
    applyPieceConfig({ version: 2, pieces: { [BASIC_PIECE]: { folderId: 'advanced' } } });
    resetPieceConfig();
    expect(computeMapCategory(items)).toBe('classic');
  });
});

describe('라벨 / 레거시 id', () => {
  it('3종 표시 문자열', () => {
    expect(CATEGORY_LABELS).toEqual({
      classic: 'Classic',
      logic: 'Logic',
      advanced: 'Advanced',
    });
  });

  it('normalizeCategory — 구 스키마 4종을 현재 id 로 승격', () => {
    expect(normalizeCategory('basic')).toBe('classic');
    expect(normalizeCategory('advanced_logic')).toBe('advanced');
    expect(normalizeCategory('logic')).toBe('logic');
    expect(normalizeCategory('classic')).toBe('classic');
    expect(normalizeCategory('없는값')).toBeUndefined();
    expect(normalizeCategory(42)).toBeUndefined();
  });
});
