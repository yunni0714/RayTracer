import { test, expect } from '@playwright/test';
import { loadPlayMap, getCell, emptyGrid5, waitForGrid, makeMapDoc } from './helpers';

/**
 * Bug 3 회귀 방지
 * 두 번째 맵을 loadMapForPlay 할 때 currentLoadedMapObj·mapData가
 * 첫 맵이 아닌 두 번째 맵을 반영하는지 검증한다 (원자적 단일 set() 보장).
 */
test.describe('Bug 3 — 맵 전환 원자성', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('두 번째 맵을 로드하면 currentLoadedMapObj와 mapData가 두 번째 맵으로 교체된다', async ({ page }) => {
    // 맵 A 로드 (ray 기물 포함)
    const gridA = emptyGrid5();
    gridA[0][0] = { type: 'ray', rotation: 0, canMove: false, canRotate: true, isInventory: false };
    await loadPlayMap(page, gridA, makeMapDoc({ id: 'map-a', title: 'Map A' }));

    const mapAObj = await page.evaluate(() => window.__rayStore.getState().currentLoadedMapObj?.id);
    expect(mapAObj).toBe('map-a');

    const cellA = await getCell(page, 0, 0);
    expect(cellA?.type).toBe('ray');

    // 맵 B 로드 (mirror 기물 포함, 위치 다름)
    const gridB = emptyGrid5();
    gridB[3][3] = { type: 'mirror', rotation: 90, canMove: false, canRotate: false, isInventory: false };
    await loadPlayMap(page, gridB, makeMapDoc({ id: 'map-b', title: 'Map B' }));

    // currentLoadedMapObj가 B로 바뀌어야 한다
    const mapBObj = await page.evaluate(() => window.__rayStore.getState().currentLoadedMapObj?.id);
    expect(mapBObj).toBe('map-b');

    // 그리드도 B를 반영해야 한다
    const cellB = await getCell(page, 3, 3);
    expect(cellB?.type).toBe('mirror');
    expect(cellB?.rotation).toBe(90);

    // A의 기물은 사라져야 한다
    const oldA = await getCell(page, 0, 0);
    expect(oldA).toBeNull();
  });

  test('맵 B 로드 후 isLaserOn이 true이고 selectedTool이 null이다', async ({ page }) => {
    const gridB = emptyGrid5();
    gridB[1][1] = { type: 'target', rotation: 0, canMove: false, canRotate: false, isInventory: false };
    await loadPlayMap(page, gridB, makeMapDoc({ id: 'map-b2', title: 'Map B2' }));

    const state = await page.evaluate(() => {
      const s = window.__rayStore.getState();
      return { isLaserOn: (s as any).isLaserOn, selectedTool: s.selectedTool };
    });
    expect(state.isLaserOn).toBe(true);
    expect(state.selectedTool).toBeNull();
  });
});
