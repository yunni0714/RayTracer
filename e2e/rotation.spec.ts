import { test, expect } from '@playwright/test';
import { loadPlayMap, cellCenter, getCell, emptyGrid5, waitForGrid, makeMapDoc } from './helpers';

test.describe('테스트 모드 기물 회전', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('canRotate=true 기물을 클릭하면 rotation이 증가한다', async ({ page }) => {
    const grid = emptyGrid5();
    grid[2][2] = { type: 'mirror', rotation: 0, canMove: false, canRotate: true, isInventory: false };

    await loadPlayMap(page, grid, makeMapDoc({ id: 'test-rotation', title: '회전 테스트' }));

    const before = await getCell(page, 2, 2);
    expect(before?.rotation).toBe(0);

    const { x, y } = await cellCenter(page, 2, 2);
    await page.mouse.click(x, y);

    const after = await getCell(page, 2, 2);
    expect(after?.rotation).toBeGreaterThan(0);
  });

  test('canRotate=false 고정 기물을 클릭해도 rotation이 변하지 않는다', async ({ page }) => {
    const grid = emptyGrid5();
    grid[1][1] = { type: 'mirror', rotation: 45, canMove: false, canRotate: false, isInventory: false };

    await loadPlayMap(page, grid, makeMapDoc({ id: 'test-fixed', title: '고정 기물 테스트' }));

    const { x, y } = await cellCenter(page, 1, 1);
    await page.mouse.click(x, y);

    const after = await getCell(page, 1, 1);
    expect(after?.rotation).toBe(45);
  });

  test('canMove=true 기물을 드래그하면 다른 셀로 이동한다', async ({ page }) => {
    const grid = emptyGrid5();
    grid[0][0] = { type: 'mirror', rotation: 0, canMove: true, canRotate: false, isInventory: false };

    await loadPlayMap(page, grid, makeMapDoc({ id: 'test-move', title: '이동 테스트' }));

    const from = await cellCenter(page, 0, 0);
    const to = await cellCenter(page, 0, 2);

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.mouse.up();

    const fromCell = await getCell(page, 0, 0);
    const toCell = await getCell(page, 0, 2);
    expect(fromCell).toBeNull();
    expect(toCell?.type).toBe('mirror');
  });
});
