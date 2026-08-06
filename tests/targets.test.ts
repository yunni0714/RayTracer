import { describe, it, expect } from 'vitest';
import { countInventoryTargets } from '../src/lib/targets';
import { computeLaser } from '../src/lib/laserEngine';
import { emptyGrid } from '../src/store/gameStore';
import type { CellData, InventoryItem } from '../src/types/game';

function inv(items: Array<[string, string, number]>): Record<string, InventoryItem> {
  const out: Record<string, InventoryItem> = {};
  for (const [key, type, count] of items) {
    out[key] = { count, type, canRotate: false, rotation: 0 };
  }
  return out;
}

function cell(type: string, rotation = 0): CellData {
  return { type, rotation: rotation as CellData['rotation'], canMove: false, canRotate: false, isInventory: false };
}

describe('countInventoryTargets', () => {
  it('빈 인벤토리는 0', () => {
    expect(countInventoryTargets({})).toBe(0);
  });

  it('표적이 아닌 기물은 세지 않는다', () => {
    expect(countInventoryTargets(inv([
      ['mirror_false_0', 'mirror', 3],
      ['block_false_0', 'block', 2],
    ]))).toBe(0);
  });

  it('표적은 count 만큼 더한다', () => {
    expect(countInventoryTargets(inv([['target_false_0', 'target', 2]]))).toBe(2);
  });

  it('표적 계열 여러 종류를 합산한다', () => {
    const n = countInventoryTargets(inv([
      ['target_false_0', 'target', 1],
      ['small_target_false_0', 'small_target', 2],
      ['omni_target_false_0', 'omni_target', 1],
      ['mirror_false_0', 'mirror', 5],
    ]));
    expect(n).toBe(4);
  });

  it('미지 타입은 표적으로 치지 않는다 (커스텀/삭제된 기물 방어)', () => {
    expect(countInventoryTargets(inv([['ghost_false_0', 'ghost_piece', 9]]))).toBe(0);
  });
});

// StatusBar 가 쓰는 보정 규칙 — 엔진(computeLaser)은 건드리지 않고
// 표시·판정에서만 인벤토리 표적을 더한다.
describe('인벤토리 표적 보정 (StatusBar 규칙)', () => {
  // laserEngine.test.ts 의 골든 케이스와 동일한 배치:
  // ray(180°) → dir 90(아래), target 정면=위 → rel 90 충족
  function solvedGrid(): (CellData | null)[][] {
    const g = emptyGrid(5);
    g[0][2] = cell('ray', 180);
    g[2][2] = cell('target');
    return g;
  }

  it('그리드만으로 풀린 맵은 그대로 해결', () => {
    const laser = computeLaser(solvedGrid());
    expect(laser.solved).toBe(true);

    const invTargets = countInventoryTargets({});
    expect(invTargets === 0 && laser.solved).toBe(true);
    expect(laser.targetsTotal + invTargets).toBe(1);
  });

  it('표적이 인벤토리에 남아 있으면 총계에 잡히고 해결이 아니다', () => {
    const laser = computeLaser(solvedGrid());
    const invTargets = countInventoryTargets(inv([['target_false_0', 'target', 1]]));

    expect(laser.targetsTotal + invTargets).toBe(2); // 보정 전에는 1 로 보였다
    expect(invTargets === 0 && laser.solved).toBe(false);
  });

  it('에디터 상태(인벤 기물이 그리드에 있음)에서는 보정이 동작하지 않는다', () => {
    const g = solvedGrid();
    g[4][4] = { ...cell('target'), isInventory: true };
    const laser = computeLaser(g);
    // 인벤토리 레코드가 비어 있으므로 보정값 0 — 기존 동작 그대로
    expect(countInventoryTargets({})).toBe(0);
    expect(laser.targetsTotal).toBe(2);
  });
});
