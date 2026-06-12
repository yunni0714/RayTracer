import { describe, it, expect } from 'vitest';
import { computeLaser, calculateReflection } from '../src/lib/laserEngine';
import type { CellData, PieceType, Rotation } from '../src/types/game';

function emptyGrid(size = 5): (CellData | null)[][] {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function piece(type: PieceType, rotation: Rotation = 0, extra: Partial<CellData> = {}): CellData {
  return { type, rotation, canMove: false, canRotate: false, isInventory: false, ...extra };
}

describe('calculateReflection', () => {
  it('수평면(0°) 반사', () => {
    expect(calculateReflection(45, 0)).toBe(315);
    expect(calculateReflection(90, 0)).toBe(270);
  });
  it('135° 거울 반사 (우→상)', () => {
    expect(calculateReflection(0, 135)).toBe(270);
    expect(calculateReflection(90, 135)).toBe(180);
  });
});

describe('computeLaser — 기본 빔', () => {
  it('발사기 없으면 빈 결과', () => {
    const r = computeLaser(emptyGrid());
    expect(r.segments).toHaveLength(0);
    expect(r.solved).toBe(false);
  });

  it('빈 그리드에서 빔이 끝까지 직진하고 마지막은 partial 경계 세그먼트', () => {
    const g = emptyGrid();
    // rotation 90 → 진행방향 0(오른쪽)
    g[2][0] = piece('ray', 90);
    const r = computeLaser(g);
    // (0,2)→(1,2)…(4,2) 4개 full + 그리드 밖 partial 1개
    expect(r.segments).toHaveLength(5);
    expect(r.segments.slice(0, 4).every(s => !s.partial)).toBe(true);
    expect(r.segments[4].partial).toBe(true);
    expect(r.segments[4].x2).toBe(5);
  });

  it('block은 빔을 통과시킨다', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);
    g[2][2] = piece('block');
    const r = computeLaser(g);
    expect(r.segments).toHaveLength(5); // 통과 → 동일 길이
  });
});

describe('computeLaser — 거울', () => {
  it('mirror(135°) 가 오른쪽 빔을 위로 꺾는다', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);   // dir 0 (오른쪽)
    g[2][2] = piece('mirror');    // sa 135 → out 270 (위)
    const r = computeLaser(g);
    // 위로 꺾인 빔이 (2,1),(2,0) 지나 경계 밖으로
    const up = r.segments.filter(s => s.x1 === 2 && s.y2 < s.y1);
    expect(up.length).toBeGreaterThan(0);
    expect(r.segments.some(s => s.y2 === -1 && s.partial)).toBe(true);
  });

  it('half_mirror 는 통과 + 반사로 분기한다', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);
    g[2][2] = piece('half_mirror');
    const r = computeLaser(g);
    // 통과(오른쪽 계속) + 반사(위) 둘 다 존재
    expect(r.segments.some(s => s.x1 === 2 && s.y1 === 2 && s.x2 === 3)).toBe(true);
    expect(r.segments.some(s => s.x1 === 2 && s.y1 === 2 && s.y2 === 1)).toBe(true);
  });

  it('single_mirror 뒷면은 partial 차단', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90); // dir 0
    g[2][2] = piece('single_mirror'); // normal 225: rel(0-225)=135 → 반사면
    const r1 = computeLaser(g);
    expect(r1.segments.some(s => s.x2 === 2 && s.y2 === 2 && !s.partial)).toBe(true);

    const g2 = emptyGrid();
    g2[2][4] = piece('ray', 270); // dir 180 (왼쪽)
    g2[2][2] = piece('single_mirror'); // rel(180-225)=315 → 뒷면
    const r2 = computeLaser(g2);
    const hit = r2.segments.find(s => s.x2 === 2 && s.y2 === 2);
    expect(hit?.partial).toBe(true);
  });

  it('tunnel 은 회전축에 맞는 빔만 통과', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);   // dir 0 (수평 진행)
    g[2][2] = piece('tunnel');    // rot 0: 수직(90/270)만 통과 → 수평 차단
    const r = computeLaser(g);
    const hit = r.segments.find(s => s.x2 === 2 && s.y2 === 2);
    expect(hit?.partial).toBe(true);

    g[2][2] = piece('tunnel', 90); // rot 90: 수평(0/180) 통과
    const r2 = computeLaser(g);
    expect(r2.segments.find(s => s.x2 === 2 && s.y2 === 2)?.partial).toBe(false);
    expect(r2.segments.some(s => s.x1 === 2 && s.x2 === 3)).toBe(true);
  });

  it('거울 루프에서도 종료한다 (visited 가드)', () => {
    const g = emptyGrid();
    g[0][0] = piece('ray', 180);      // dir 90 (아래)
    g[2][0] = piece('mirror');        // 아래→오른쪽: refl(90,135)=180? 검증은 종료 자체
    g[2][2] = piece('mirror', 90);
    g[0][2] = piece('mirror', 180);
    const r = computeLaser(g);
    expect(r.segments.length).toBeLessThan(200);
  });
});

describe('computeLaser — 승리 판정', () => {
  it('표적 정면(위)에 빔이 닿으면 solved', () => {
    const g = emptyGrid();
    g[0][2] = piece('ray', 180); // dir 90 (아래)
    g[2][2] = piece('target');   // 정면=위 → rel 90 충족
    const r = computeLaser(g);
    expect(r.targetsTotal).toBe(1);
    expect(r.targetsHit).toBe(1);
    expect(r.solved).toBe(true);
  });

  it('표적은 정면(표식면)으로 온 빔만 인식한다', () => {
    // 측면(왼쪽)에서 들어오는 빔: 미충족
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);  // dir 0 (오른쪽) → 표적 왼쪽 측면
    g[2][2] = piece('target');   // 정면=위
    const r = computeLaser(g);
    expect(r.targetsTotal).toBe(1);
    expect(r.targetsHit).toBe(0);
    expect(r.solved).toBe(false);
  });

  it('표적을 회전시키면 정면도 함께 돈다 (측면 빔도 정면이 되면 충족)', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);       // dir 0 (오른쪽)
    g[2][2] = piece('target', 270);   // 정면이 왼쪽을 향함 → rel(0-270)=90 충족
    expect(computeLaser(g).solved).toBe(true);
  });

  it('표적 2개 중 1개만 정면 피격이면 미해결', () => {
    const g = emptyGrid();
    g[0][2] = piece('ray', 180); // dir 90 (아래) → (2,2) 정면 피격
    g[2][2] = piece('target');
    g[0][0] = piece('target');   // 빔 도달 안 함
    const r = computeLaser(g);
    expect(r.targetsTotal).toBe(2);
    expect(r.targetsHit).toBe(1);
    expect(r.solved).toBe(false);
  });

  it('표적이 없으면 solved=false', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);
    expect(computeLaser(g).solved).toBe(false);
  });
});

describe('computeLaser — NxN 그리드', () => {
  it('7×7 그리드에서 경계까지 진행한다', () => {
    const g = emptyGrid(7);
    g[3][0] = piece('ray', 90);
    const r = computeLaser(g);
    expect(r.segments).toHaveLength(7);
    expect(r.segments[6].x2).toBe(7);
  });
});

describe('computeLaser — excludeEmitterAt (회전 애니메이션 중 빔 끄기)', () => {
  it('제외된 발사기의 빔만 꺼지고 다른 발사기 빔은 유지된다', () => {
    const g = emptyGrid();
    g[1][0] = piece('ray', 90); // (0,1) → 오른쪽
    g[3][0] = piece('ray', 90); // (0,3) → 오른쪽
    const full = computeLaser(g);
    const excluded = computeLaser(g, { x: 0, y: 1 });
    // 두 발사기 각각 5세그먼트 → 제외 시 절반
    expect(full.segments).toHaveLength(10);
    expect(excluded.segments).toHaveLength(5);
    expect(excluded.segments.every(s => s.y1 === 3 && s.y2 === 3)).toBe(true);
  });

  it('제외된 발사기도 기물로는 남아 다른 빔을 흡수한다', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);   // (0,2) → 오른쪽
    g[2][4] = piece('ray', 270);  // (4,2) → 왼쪽 (마주봄)
    const excluded = computeLaser(g, { x: 4, y: 2 });
    // 왼쪽 발사기 빔은 (4,2) 발사기에 흡수 — 경계 밖 partial 세그먼트가 없어야 한다
    expect(excluded.segments.some(s => s.x2 > 4 || s.x2 < 0)).toBe(false);
    expect(excluded.segments).toHaveLength(4); // (0,2)→(4,2) 4칸 전진 후 흡수
  });

  it('사출 프로젝터 제외 시 사출 빔이 꺼진다', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);          // (0,2) → 오른쪽 (dir 0)
    g[2][2] = piece('target_projector'); // rel 0 측면 피격 → 활성 → rel 270 사출 (위)
    const full = computeLaser(g);
    const excluded = computeLaser(g, { x: 2, y: 2 });
    // full: 프로젝터까지 2 + 사출 빔 / excluded: 프로젝터까지 2 만
    expect(full.segments.length).toBeGreaterThan(2);
    expect(excluded.segments).toHaveLength(2);
  });
});
