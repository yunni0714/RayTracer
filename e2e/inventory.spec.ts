import { test, expect } from '@playwright/test';
import { loadPlayMap, cellCenter, getCell, getInvCount, emptyGrid5, waitForGrid, makeMapDoc } from './helpers';

const INV_KEY = 'mirror_true_0';

test.describe('인벤토리 배치·환수', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  async function setupWithInventory(page: Parameters<typeof loadPlayMap>[0]) {
    const grid = emptyGrid5();
    // isInventory=true 기물을 그리드에 포함 → loadMapForPlay가 인벤토리로 분리
    grid[4][4] = { type: 'mirror', rotation: 0, canMove: true, canRotate: true, isInventory: true };

    await loadPlayMap(page, grid, makeMapDoc({ id: 'test-inv', title: '인벤토리 테스트' }));
  }

  test('인벤토리 기물을 선택해 빈 셀에 배치하면 count가 줄고 셀에 기물이 놓인다', async ({ page }) => {
    await setupWithInventory(page);

    // 초기 count 확인
    const countBefore = await getInvCount(page, INV_KEY);
    expect(countBefore).toBe(1);

    // 인벤토리 ToolItem 클릭 → selectedTool 설정
    await page.locator('.grid.grid-cols-3 button').first().click();

    // 빈 셀 클릭 → 배치
    const { x, y } = await cellCenter(page, 2, 2);
    await page.mouse.click(x, y);

    const placed = await getCell(page, 2, 2);
    expect(placed?.type).toBe('mirror');
    expect(placed?.isInventory).toBe(true);

    const countAfter = await getInvCount(page, INV_KEY);
    expect(countAfter).toBe(0);
  });

  test('배치한 isInventory 기물을 우클릭하면 인벤토리로 환수된다', async ({ page }) => {
    await setupWithInventory(page);

    // 인벤토리 선택 후 배치
    await page.locator('.grid.grid-cols-3 button').first().click();
    const { x, y } = await cellCenter(page, 2, 2);
    await page.mouse.click(x, y);

    expect(await getCell(page, 2, 2)).not.toBeNull();

    // 우클릭 환수
    await page.mouse.click(x, y, { button: 'right' });

    expect(await getCell(page, 2, 2)).toBeNull();
    expect(await getInvCount(page, INV_KEY)).toBe(1);
  });
});
