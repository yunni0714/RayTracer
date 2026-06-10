import { describe, it, expect } from 'vitest';
import { computeLaser } from '../src/lib/laserEngine';
import type { CellData, PieceType, Rotation } from '../src/types/game';

function emptyGrid(size = 5): (CellData | null)[][] {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function piece(type: PieceType, rotation: Rotation = 0): CellData {
  return { type, rotation, canMove: false, canRotate: false, isInventory: false };
}

function hitSeg(r: ReturnType<typeof computeLaser>, x: number, y: number) {
  return r.segments.find(s => s.x2 === x && s.y2 === y);
}

describe('diode — 일방터널', () => {
  it('화살표 방향과 같은 빔은 통과', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);     // dir 0 (오른쪽)
    g[2][2] = piece('diode', 90);   // 화살표 (90+270)%360=0 → 통과
    const r = computeLaser(g);
    expect(hitSeg(r, 2, 2)?.partial).toBe(false);
    expect(r.segments.some(s => s.x1 === 2 && s.x2 === 3)).toBe(true);
  });

  it('역방향 빔은 차단', () => {
    const g = emptyGrid();
    g[2][4] = piece('ray', 270);    // dir 180 (왼쪽)
    g[2][2] = piece('diode', 90);   // 화살표 0 → 180 차단
    const r = computeLaser(g);
    expect(hitSeg(r, 2, 2)?.partial).toBe(true);
    expect(r.segments.some(s => s.x1 === 2 && s.y1 === 2)).toBe(false);
  });
});

describe('v_mirror_double — 수직 양면거울', () => {
  it('정면 축 빔을 180° 되돌린다', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);          // dir 0
    g[2][2] = piece('v_mirror_double');  // rel 0 → 반대로
    const r = computeLaser(g);
    // 반사 빔이 (1,2) 로 돌아간다
    expect(r.segments.some(s => s.x1 === 2 && s.y1 === 2 && s.x2 === 1)).toBe(true);
  });

  it('평행 축 빔은 차단', () => {
    const g = emptyGrid();
    g[0][2] = piece('ray', 180);         // dir 90 (아래)
    g[2][2] = piece('v_mirror_double');  // rel 90 → 차단
    const r = computeLaser(g);
    expect(hitSeg(r, 2, 2)?.partial).toBe(true);
  });
});

describe('v_half_mirror_double — 수직 양면 반거울', () => {
  it('정면 축 빔을 통과 + 되돌림으로 분기', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);
    g[2][2] = piece('v_half_mirror_double');
    const r = computeLaser(g);
    expect(r.segments.some(s => s.x1 === 2 && s.y1 === 2 && s.x2 === 3)).toBe(true); // 통과
    expect(r.segments.some(s => s.x1 === 2 && s.y1 === 2 && s.x2 === 1)).toBe(true); // 되돌림
  });
});

describe('small_target — 소형 표적', () => {
  it('정면 피격 시 흡수 + 충족', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);          // dir 0
    g[2][2] = piece('small_target', 270); // rel = (0-270+360)%360 = 90 → 정면
    const r = computeLaser(g);
    expect(r.targetsTotal).toBe(1);
    expect(r.solved).toBe(true);
    expect(r.segments.some(s => s.x1 === 2 && s.y1 === 2)).toBe(false); // 흡수
  });

  it('수직 축 빔은 통과하고 충족되지 않는다', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);          // dir 0
    g[2][2] = piece('small_target', 0);  // rel 0 → 통과
    const r = computeLaser(g);
    expect(r.solved).toBe(false);
    expect(r.segments.some(s => s.x1 === 2 && s.y1 === 2 && s.x2 === 3)).toBe(true);
  });

  it('뒷면 피격은 차단 + 미충족', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);          // dir 0
    g[2][2] = piece('small_target', 90); // rel = (0-90+360)%360 = 270 → 뒷면
    const r = computeLaser(g);
    expect(hitSeg(r, 2, 2)?.partial).toBe(true);
    expect(r.solved).toBe(false);
  });
});

describe('omni_target — 전방위 표적', () => {
  it('어느 방향에서 맞아도 충족', () => {
    for (const [ray, pos] of [
      [piece('ray', 90), { r: 2, c: 0 }],  // 오른쪽으로
      [piece('ray', 180), { r: 0, c: 2 }], // 아래로
    ] as const) {
      const g = emptyGrid();
      g[pos.r][pos.c] = ray;
      g[2][2] = piece('omni_target');
      const r = computeLaser(g);
      expect(r.solved).toBe(true);
    }
  });
});

describe('high_block — 높은 블럭', () => {
  it('빔을 완전 차단한다 (기존 block 은 통과)', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);
    g[2][2] = piece('high_block');
    const r = computeLaser(g);
    expect(hitSeg(r, 2, 2)?.partial).toBe(true);
    expect(r.segments.some(s => s.x1 === 2 && s.y1 === 2)).toBe(false);
  });
});
