import { describe, it, expect } from 'vitest';
import { computeLaser } from '../src/lib/laserEngine';
import type { CellData, PieceType, Rotation } from '../src/types/game';

function emptyGrid(size = 5): (CellData | null)[][] {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function piece(type: PieceType, rotation: Rotation = 0): CellData {
  return { type, rotation, canMove: false, canRotate: false, isInventory: false };
}

function passedThrough(r: ReturnType<typeof computeLaser>, x: number, y: number, toX: number, toY: number) {
  return r.segments.some(s => s.x1 === x && s.y1 === y && s.x2 === toX && s.y2 === toY);
}

describe('transistor_gate — 관문', () => {
  it('제어 빔 없으면 수평 빔 차단', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);          // dir 0 (오른쪽)
    g[2][2] = piece('transistor_gate');
    const r = computeLaser(g);
    const hit = r.segments.find(s => s.x2 === 2 && s.y2 === 2);
    expect(hit?.partial).toBe(true);
    expect(passedThrough(r, 2, 2, 3, 2)).toBe(false);
  });

  it('아래 제어축 피격 시 수평 빔 개방', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);          // dir 0 → 게이트 수평축
    g[4][2] = piece('ray', 0);           // dir 270 (위) → 게이트 아래 제어축
    g[2][2] = piece('transistor_gate');
    const r = computeLaser(g);
    expect(passedThrough(r, 2, 2, 3, 2)).toBe(true);
  });
});

describe('cross_gate — 교차 관문 (AND)', () => {
  it('한 축만 오면 차단', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);
    g[2][2] = piece('cross_gate');
    const r = computeLaser(g);
    expect(passedThrough(r, 2, 2, 3, 2)).toBe(false);
  });

  it('H·V 둘 다 오면 둘 다 통과', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);   // dir 0
    g[0][2] = piece('ray', 180);  // dir 90 (아래)
    g[2][2] = piece('cross_gate');
    const r = computeLaser(g);
    expect(passedThrough(r, 2, 2, 3, 2)).toBe(true); // 수평 통과
    expect(passedThrough(r, 2, 2, 2, 3)).toBe(true); // 수직 통과
  });
});

describe('priority_gate — 우선순위 관문', () => {
  it('한 축만 오면 그대로 통과', () => {
    const g = emptyGrid();
    g[0][2] = piece('ray', 180);  // dir 90 (아래) — 수직 단독
    g[2][2] = piece('priority_gate');
    const r = computeLaser(g);
    expect(passedThrough(r, 2, 2, 2, 3)).toBe(true);
  });

  it('둘 다 오면 직선축(수평)만 통과', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);   // dir 0 — 직선축
    g[0][2] = piece('ray', 180);  // dir 90 — 수직
    g[2][2] = piece('priority_gate');
    const r = computeLaser(g);
    expect(passedThrough(r, 2, 2, 3, 2)).toBe(true);  // 수평 통과
    expect(passedThrough(r, 2, 2, 2, 3)).toBe(false); // 수직 차단
  });
});

describe('target_projector — 표적 프로젝터', () => {
  it('측면 피격 시 충족 + 정면으로 발사', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);            // dir 0 → 측면 피격
    g[2][2] = piece('target_projector');   // rot 0 → 위로 발사
    g[0][2] = piece('omni_target');        // 발사 빔이 닿을 표적
    const r = computeLaser(g);
    expect(r.targetsTotal).toBe(2);
    expect(r.targetsHit).toBe(2);          // 프로젝터 충족 + 표적 충족
    expect(r.solved).toBe(true);
  });

  it('피격 없으면 발사하지 않는다', () => {
    const g = emptyGrid();
    g[2][2] = piece('target_projector');
    g[0][2] = piece('omni_target');
    const r = computeLaser(g);
    expect(r.targetsHit).toBe(0);
    expect(r.segments).toHaveLength(0);
  });
});

describe('inverting_projector — 반전 프로젝터', () => {
  it('기본 상태에서 정면으로 발사한다', () => {
    const g = emptyGrid();
    g[2][2] = piece('inverting_projector'); // rot 0 → 위로 발사
    g[0][2] = piece('omni_target');
    const r = computeLaser(g);
    expect(r.solved).toBe(true);
  });

  it('측면 피격 시 꺼진다', () => {
    const g = emptyGrid();
    g[2][0] = piece('ray', 90);             // dir 0 → 측면 피격
    g[2][2] = piece('inverting_projector');
    g[0][2] = piece('omni_target');
    const r = computeLaser(g);
    expect(r.solved).toBe(false);
  });

  it('프로젝터 → 관문 체인이 수렴한다', () => {
    const g = emptyGrid();
    // 반전 프로젝터(기본 ON, 위로 발사) → 관문 제어축 → 관문 개방 → 수평 빔 통과
    g[4][2] = piece('inverting_projector'); // (2,4) 위로 발사
    g[2][2] = piece('transistor_gate');     // (2,2) 아래 제어축 피격 → 개방
    g[2][0] = piece('ray', 90);             // 수평 빔
    g[2][4] = piece('omni_target');         // 통과한 빔이 닿는 표적
    const r = computeLaser(g);
    expect(passedThrough(r, 2, 2, 3, 2)).toBe(true);
    expect(r.solved).toBe(true);
  });

  it('자기 소등 진동은 OFF 강제로 결정적으로 종결한다', () => {
    const g = emptyGrid();
    // 프로젝터가 쏜 빔이 거울로 꺾여 자신의 측면으로 돌아옴 → ON→OFF→ON… 진동
    g[2][2] = piece('inverting_projector'); // 위로 발사
    g[0][2] = piece('mirror');              // (2,0) 위 빔 → 반사
    g[0][4] = piece('mirror', 90);
    g[2][4] = piece('mirror', 180);         // 측면으로 돌아오는 경로 구성
    const r1 = computeLaser(g);
    const r2 = computeLaser(g);
    // 결정성: 두 번 계산해도 동일 결과
    expect(r1.segments).toEqual(r2.segments);
  });
});
