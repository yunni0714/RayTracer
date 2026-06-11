import { describe, it, expect, afterEach } from 'vitest';
import {
  applyPieceConfig, resetPieceConfig, getPieceTab, getPieceDefaults,
  getCustomTypes, isValidCustomTypeId, getFolders, getPieceFolder, isPieceHidden,
} from '../src/lib/pieceConfig';
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

describe('applyPieceConfig — 커스텀 타입', () => {
  const customSvg = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="20"/></svg>';
  const absorbAll = { faces: {}, fallback: { kind: 'absorb', satisfy: true }, rotationStep: 90 };

  it('behavior+svg 둘 다 있는 커스텀 타입은 등록되고 엔진/렌더에 반영된다', () => {
    const r = applyPieceConfig({
      version: 2,
      pieces: { my_custom: { svg: customSvg, labelKo: '내 기물', behavior: absorbAll } },
    });
    expect(r.applied).toContain('my_custom');
    expect(getCustomTypes()).toEqual(['my_custom']);
    expect(getSvgArt('my_custom')).toBe(customSvg);
    expect(getPieceLabel('my_custom')).toBe('내 기물');
    expect(isTargetType('my_custom')).toBe(true);

    const g = emptyGrid();
    g[2][0] = piece('ray', 90);
    g[2][2] = piece('my_custom');
    const res = computeLaser(g);
    expect(res.targetsTotal).toBe(1);
    expect(res.solved).toBe(true);
  });

  it('behavior 또는 svg 가 없는 커스텀 타입은 skip', () => {
    const r = applyPieceConfig({
      version: 2,
      pieces: {
        only_svg: { svg: customSvg },
        only_behavior: { behavior: absorbAll },
      },
    });
    expect(r.applied).toHaveLength(0);
    expect(r.skipped).toEqual(expect.arrayContaining(['only_svg', 'only_behavior']));
    expect(getCustomTypes()).toEqual([]);
  });

  it('잘못된 id (대문자/특수문자/과대길이) 는 skip', () => {
    const entry = { svg: customSvg, behavior: absorbAll };
    const r = applyPieceConfig({
      version: 2,
      pieces: {
        'BadCase': entry,
        'has-dash': entry,
        ['x'.repeat(40)]: entry,
      },
    });
    expect(r.applied).toHaveLength(0);
    expect(getCustomTypes()).toEqual([]);
  });

  it('isValidCustomTypeId — 빌트인 충돌 금지', () => {
    expect(isValidCustomTypeId('mirror')).toBe(false);
    expect(isValidCustomTypeId('my_piece_2')).toBe(true);
    expect(isValidCustomTypeId('')).toBe(false);
  });

  it('reset 후 커스텀 타입은 사라지고 폴백으로 돌아간다', () => {
    applyPieceConfig({
      version: 2,
      pieces: { my_custom: { svg: customSvg, behavior: absorbAll } },
    });
    expect(isTargetType('my_custom')).toBe(true);
    resetPieceConfig();
    expect(getCustomTypes()).toEqual([]);
    expect(isTargetType('my_custom')).toBe(false);       // PASSIVE 폴백
    expect(getSvgArt('my_custom')).toBe(PLACEHOLDER_SVG); // 플레이스홀더 폴백
  });
});

describe('폴더 모델 (folders/folderId)', () => {
  it('config 없음 → 기본 3폴더, 기본 매핑 (회귀 0)', () => {
    expect(getFolders().map(f => f.id)).toEqual(['basic', 'intermediate', 'advanced']);
    expect(getPieceFolder('mirror')).toBe('basic');
    expect(getPieceFolder('diode')).toBe('intermediate');
    expect(getPieceFolder('mirror_45')).toBe('advanced');
  });

  it('커스텀 폴더 + folderId 할당이 반영되고 order 로 정렬된다', () => {
    applyPieceConfig({
      version: 2,
      folders: [
        { id: 'my_folder', name: '내 폴더', order: 3 },
        { id: 'basic', name: '초급', order: 0 },
        { id: 'intermediate', name: '중급', order: 1 },
        { id: 'advanced', name: '상급', order: 2 },
      ],
      pieces: { mirror: { folderId: 'my_folder' } },
    });
    expect(getFolders().map(f => f.id)).toEqual(['basic', 'intermediate', 'advanced', 'my_folder']);
    expect(getPieceFolder('mirror')).toBe('my_folder');
    expect(getPieceFolder('target')).toBe('basic'); // 다른 기물은 기본 유지
  });

  it('config folders 가 기본 폴더를 빠뜨려도 항상 재생성된다', () => {
    applyPieceConfig({
      version: 2,
      folders: [{ id: 'solo', name: '혼자', order: 9 }],
      pieces: {},
    });
    const ids = getFolders().map(f => f.id);
    expect(ids).toEqual(expect.arrayContaining(['basic', 'intermediate', 'advanced', 'solo']));
  });

  it('레거시 tab 엔트리는 folderId 로 읽힌다 (하위호환)', () => {
    applyPieceConfig({ version: 1, pieces: { mirror: { tab: 'intermediate' } } });
    expect(getPieceFolder('mirror')).toBe('intermediate');
    expect(getPieceTab('mirror')).toBe('intermediate');
  });

  it('존재하지 않는 폴더를 가리키는 folderId 는 무시되고 기본값 폴백', () => {
    applyPieceConfig({ version: 2, pieces: { mirror: { folderId: 'ghost_folder', labelKo: 'x' } } });
    expect(getPieceFolder('mirror')).toBe('basic');
  });

  it('손상 folders (잘못된 id/이름) 는 걸러진다', () => {
    applyPieceConfig({
      version: 2,
      folders: [{ id: 'BAD ID', name: 'x', order: 0 }, { id: 'ok_folder', name: ' ', order: 1 }, 42, null],
      pieces: {},
    });
    expect(getFolders().map(f => f.id)).toEqual(['basic', 'intermediate', 'advanced']);
  });
});

describe('hidden (빌트인 숨김)', () => {
  it('hidden:true 는 isPieceHidden 에만 반영 — 엔진 동작은 불변', () => {
    expect(isPieceHidden('mirror')).toBe(false);
    applyPieceConfig({ version: 2, pieces: { mirror: { hidden: true } } });
    expect(isPieceHidden('mirror')).toBe(true);

    // 맵에 이미 놓인 mirror 는 계속 반사
    const g = emptyGrid();
    g[2][0] = piece('ray', 90); // dir 0
    g[2][2] = piece('mirror');
    const r = computeLaser(g);
    expect(r.segments.some(s => s.x1 === 2 && s.y1 === 2 && s.y2 === 1)).toBe(true);
  });

  it('hidden:false / 비불리언은 숨김으로 안 친다', () => {
    applyPieceConfig({ version: 2, pieces: { mirror: { hidden: false }, target: { hidden: 'yes', labelKo: 't' } } });
    expect(isPieceHidden('mirror')).toBe(false);
    expect(isPieceHidden('target')).toBe(false);
  });

  it('reset 으로 숨김 해제', () => {
    applyPieceConfig({ version: 2, pieces: { mirror: { hidden: true } } });
    resetPieceConfig();
    expect(isPieceHidden('mirror')).toBe(false);
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
