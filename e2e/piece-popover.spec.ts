import { test, expect } from '@playwright/test';
import { cellCenter, getCell, getSelectedTool, waitForGrid } from './helpers';
import type { CellData } from '../src/types/game';

/**
 * Phase 5 — 에디터 기물 조작 UX
 * - 도구 든 채 기물 좌클릭 = 도구 해제 우선(덮어쓰기 안 함)
 * - 좌클릭 = 팝오버(특성 토글·특성 삭제·기물 삭제)
 * - 우클릭 = 회전
 */
test.describe('에디터 기물 팝오버 · 도구 해제 우선', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
    // 에디터 모드(기본)에서 (2,2)에 mirror 배치
    await page.evaluate(() => {
      const s = window.__rayStore.getState() as unknown as {
        setMapData: (g: (CellData | null)[][]) => void;
      };
      const grid: (CellData | null)[][] = Array.from({ length: 5 }, () => Array(5).fill(null));
      grid[2][2] = { type: 'mirror', rotation: 0, canMove: false, canRotate: false, isInventory: false };
      s.setMapData(grid);
    });
  });

  test('도구를 든 채 기물을 좌클릭하면 덮어쓰지 않고 도구만 해제된다', async ({ page }) => {
    await page.locator('[data-tool="target"]').click();
    expect((await getSelectedTool(page))?.type).toBe('target');

    const { x, y } = await cellCenter(page, 2, 2);
    await page.mouse.click(x, y);

    // 덮어쓰기 없음 + 도구 해제 + 팝오버 미표시
    expect((await getCell(page, 2, 2))?.type).toBe('mirror');
    expect(await getSelectedTool(page)).toBeNull();
    await expect(page.getByTestId('piece-popover')).toBeHidden();

    // 다음 클릭부터 팝오버
    await page.mouse.click(x, y);
    await expect(page.getByTestId('piece-popover')).toBeVisible();
  });

  test('좌클릭 팝오버에서 유저지급 토글·특성 삭제·기물 삭제가 동작한다', async ({ page }) => {
    const { x, y } = await cellCenter(page, 2, 2);
    await page.mouse.click(x, y);

    const popover = page.getByTestId('piece-popover');
    await expect(popover).toBeVisible();

    // 🎒 유저지급 토글
    await popover.getByRole('button', { name: '유저지급 토글' }).click();
    let cell = await getCell(page, 2, 2);
    expect(cell?.isInventory).toBe(true);
    expect(cell?.canMove).toBe(true);

    // ✨ 특성 삭제 → 기본 상태로
    await popover.getByRole('button', { name: '특성 삭제' }).click();
    cell = await getCell(page, 2, 2);
    expect(cell?.isInventory).toBe(false);
    expect(cell?.canMove).toBe(false);
    expect(cell?.canRotate).toBe(false);

    // 🗑 기물 삭제 → 셀 비움 + 팝오버 닫힘
    await popover.getByRole('button', { name: '기물 삭제' }).click();
    expect(await getCell(page, 2, 2)).toBeNull();
    await expect(popover).toBeHidden();
  });

  test('에디터에서 우클릭하면 기물이 회전한다', async ({ page }) => {
    const { x, y } = await cellCenter(page, 2, 2);
    await page.mouse.click(x, y, { button: 'right' });
    expect((await getCell(page, 2, 2))?.rotation).toBe(90);
  });

  test('Esc로 팝오버가 닫힌다', async ({ page }) => {
    const { x, y } = await cellCenter(page, 2, 2);
    await page.mouse.click(x, y);
    await expect(page.getByTestId('piece-popover')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('piece-popover')).toBeHidden();
  });

  test('데스크탑에서는 인스펙터 액션 버튼이 숨겨진다 (팝오버가 전담)', async ({ page }) => {
    const { x, y } = await cellCenter(page, 2, 2);
    await page.mouse.click(x, y);
    await expect(page.getByTestId('piece-popover')).toBeVisible();
    // 정보(미리보기·좌표·배지)는 남고 조작 버튼만 숨는다.
    // 인스펙터는 데스크탑 aside 와 모바일 시트 양쪽에 렌더되므로 개수로 센다.
    await expect(page.locator('[data-testid="selected-piece-info"]:visible')).toHaveCount(1);
    await expect(page.locator('[data-piece-controls]:visible')).toHaveCount(0);
  });
});

/**
 * 회귀 방지 — PiecePopover 의 바깥클릭 해제가 인스펙터 버튼의 클릭을 훔치던 문제.
 * 선택은 pointerup, 해제는 pointerdown 이라 인스펙터 버튼은 click 도착 전에
 * 언마운트됐다. 팝오버가 안 보이는 모바일에서는 조작 수단이 통째로 죽어 있었다.
 */
test.describe('모바일 인스펙터 기물 조작', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
    await page.evaluate(() => {
      const s = window.__rayStore.getState() as unknown as {
        setMapData: (g: (CellData | null)[][]) => void;
      };
      const grid: (CellData | null)[][] = Array.from({ length: 5 }, () => Array(5).fill(null));
      grid[2][2] = { type: 'mirror', rotation: 0, canMove: false, canRotate: false, isInventory: false };
      s.setMapData(grid);
    });
  });

  test('기물을 탭하면 하단 시트 정보탭에 액션 버튼이 보인다', async ({ page }) => {
    const { x, y } = await cellCenter(page, 2, 2);
    await page.mouse.click(x, y);
    // 데스크탑 aside 는 lg 미만에서 숨으므로 보이는 건 시트 쪽 하나뿐
    await expect(page.locator('[data-piece-controls]:visible')).toHaveCount(1);
    // 팝오버는 lg 미만에서 숨겨져 있다
    await expect(page.getByTestId('piece-popover')).toBeHidden();
  });

  test('인스펙터의 유저지급·특성삭제·기물삭제가 실제로 반영된다', async ({ page }) => {
    const { x, y } = await cellCenter(page, 2, 2);
    await page.mouse.click(x, y);

    const controls = page.locator('[data-piece-controls]:visible');
    await expect(controls).toHaveCount(1);

    await controls.getByRole('button', { name: /유저지급/ }).click();
    let cell = await getCell(page, 2, 2);
    expect(cell?.isInventory).toBe(true);
    expect(cell?.canMove).toBe(true);

    // 선택이 유지돼야 연속 조작이 가능하다 (버그 시점엔 여기서 패널이 비었다)
    await expect(controls).toHaveCount(1);

    await controls.getByRole('button', { name: /특성 삭제/ }).click();
    cell = await getCell(page, 2, 2);
    expect(cell?.isInventory).toBe(false);
    expect(cell?.canMove).toBe(false);
    expect(cell?.canRotate).toBe(false);

    await controls.getByRole('button', { name: /기물 삭제/ }).click();
    expect(await getCell(page, 2, 2)).toBeNull();
  });
});
