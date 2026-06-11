import { describe, it, expect, afterEach } from 'vitest';
import { applyPieceConfig, resetPieceConfig, getPieceTab, getPieceDefaults } from '../src/lib/pieceConfig';
import { computeLaser, getBehavior, getBehaviorDef, isTargetType } from '../src/lib/laserEngine';
import { getSvgArt, SVG_ART, PLACEHOLDER_SVG } from '../src/lib/svgArt';
import { getPieceLabel, getRotationStep } from '../src/lib/pieceActions';
import type { CellData, Rotation } from '../src/types/game';

function emptyGrid(size = 5): (CellData | null)[][] {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function piece(type: string, rotation: Rotation = 0): CellData {
  return { type, rotation, canMove: false, canRotate: false, isInventory: false };
}

afterEach(() => resetPieceConfig());

describe('applyPieceConfig — behavior 오버라이드', () => {
  it('block 을 완전 차단으로 바꾸면 빔이 멈춘다', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90); // dir 0
    g[2][2] = piece('block');

    // 기본: 통과
    expect(computeLaser(g).segments.some(s => s.x1 === 2 && s.y1 === 2)).toBe(true);

    applyPieceConfig({
      version: 1,
      pieces: {
        block: { behavior: { faces: {}, fallback: { kind: 'block' }, rotationStep: 90 } },
      },
    });

    const r = computeLaser(g);
    const hit = r.segments.find(s => s.x2 === 2 && s.y2 === 2);
    expect(hit?.partial).toBe(true);
    expect(r.segments.some(s => s.x1 === 2 && s.y1 === 2)).toBe(false);
  });

  it('satisfy 면을 추가하면 isTarget 이 파생되고 solved 에 반영된다 (표적거울 시나리오)', () => {
    expect(isTargetType('target_mirror_a')).toBe(false);

    applyPieceConfig({
      version: 1,
      pieces: {
        target_mirror_a: {
          behavior: {
            rotationStep: 90,
            fallback: { kind: 'block' },
            faces: {
              0: { kind: 'reflect', surfaceAngle: 135, satisfy: true },
              45: { kind: 'reflect', surfaceAngle: 135 },
              90: { kind: 'reflect', surfaceAngle: 135 },
            },
          },
        },
      },
    });

    expect(isTargetType('target_mirror_a')).toBe(true);

    const g = emptyGrid();
    g[2][0] = piece('ray', 90);           // dir 0 → rel 0 → reflect+satisfy
    g[2][2] = piece('target_mirror_a');
    const r = computeLaser(g);
    expect(r.targetsTotal).toBe(1);
    expect(r.solved).toBe(true);
    // 반사도 계속 동작 (위로 꺾임)
    expect(r.segments.some(s => s.x1 === 2 && s.y1 === 2 && s.y2 === 1)).toBe(true);
  });

  it('reset 하면 코드 기본값으로 복원된다', () => {
    applyPieceConfig({
      version: 1,
      pieces: { block: { behavior: { faces: {}, fallback: { kind: 'block' }, rotationStep: 90 } } },
    });
    expect(getBehaviorDef('block')?.fallback).toEqual({ kind: 'block' });
    resetPieceConfig();
    expect(getBehaviorDef('block')?.fallback).toEqual({ kind: 'pass' });
  });
});

describe('applyPieceConfig — svg/label/tab/defaults', () => {
  it('svg·라벨·탭·기본 특성 오버라이드가 접근자에 반영된다', () => {
    applyPieceConfig({
      version: 1,
      pieces: {
        mirror: {
          svg: '<svg viewBox="0 0 100 100"><rect/></svg>',
          labelKo: '커스텀 거울',
          tab: 'intermediate',
          defaults: { canRotate: true },
        },
      },
    });
    expect(getSvgArt('mirror')).toContain('<rect/>');
    expect(getPieceLabel('mirror')).toBe('커스텀 거울');
    expect(getPieceTab('mirror')).toBe('intermediate');
    expect(getPieceDefaults('mirror')).toEqual({ canRotate: true, canMove: false, isInventory: false });
    // 다른 기물은 그대로
    expect(getSvgArt('target')).toBe(SVG_ART.target);
    expect(getPieceTab('target')).toBe('basic');
  });
});

describe('미지 타입 접근자 폴백 (커스텀 기물 안전망)', () => {
  it('미지 타입은 PASSIVE — 통과·비표적·크래시 없음', () => {
    const b = getBehavior('no_such_piece');
    expect(b.isTarget).toBe(false);
    expect(b.interact(0, piece('no_such_piece'), undefined)).toEqual({ outDirs: [0] });
  });

  it('미지 타입 SVG 는 플레이스홀더, 라벨은 타입 문자열', () => {
    expect(getSvgArt('no_such_piece')).toBe(PLACEHOLDER_SVG);
    expect(getPieceLabel('no_such_piece')).toBe('no_such_piece');
    expect(getRotationStep('no_such_piece')).toBe(90);
    expect(getPieceDefaults('no_such_piece')).toEqual({ canRotate: false, canMove: false, isInventory: false });
  });

  it('미지 타입 셀이 있는 맵도 통과로 계산되고 승리판정에서 제외된다', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);          // dir 0
    g[2][2] = piece('ghost_custom');     // 미지 — 통과해야 함
    g[2][4] = piece('target', 270);      // rel 90 충족 (dir 0, rot 270 → rel 90)
    const r = computeLaser(g);
    expect(r.segments.some(s => s.x1 === 2 && s.y1 === 2)).toBe(true); // 빔이 미지 셀을 지나감
    expect(r.targetsTotal).toBe(1);                                    // 미지 타입은 표적 아님
    expect(r.solved).toBe(true);
  });
});

describe('applyPieceConfig — 손상 config 방어', () => {
  it('잘못된 behavior 는 엔트리째 스킵하고 기본값 유지', () => {
    const result = applyPieceConfig({
      version: 1,
      pieces: {
        mirror: { behavior: { faces: { 10: { kind: 'reflect' } }, fallback: { kind: 'pass' }, rotationStep: 90 } }, // rel 10 invalid
        target: { behavior: { faces: {}, fallback: { kind: 'nope' }, rotationStep: 90 } },                          // kind invalid
        unknown_piece: { labelKo: 'x' },                                                                            // 미지 타입
      },
    });
    expect(result.applied).toHaveLength(0);
    expect(result.skipped).toEqual(expect.arrayContaining(['mirror', 'target', 'unknown_piece']));
    expect(getBehaviorDef('mirror')?.fallback.kind).toBe('reflect');
  });

  it('완전 손상 입력(null/문자열)도 throw 하지 않는다', () => {
    expect(() => applyPieceConfig(null)).not.toThrow();
    expect(() => applyPieceConfig('garbage')).not.toThrow();
    expect(() => applyPieceConfig({ pieces: 42 })).not.toThrow();
  });
});
