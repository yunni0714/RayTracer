import { test, expect } from '@playwright/test';
import { loadPlayMap, cellCenter, getCell, getSelectedTool, emptyGrid5, waitForGrid, makeMapDoc } from './helpers';

/**
 * Bug 1 · 2 회귀 방지
 *
 * Race condition 재현:
 * 1. 에디터에서 팔레트 기물을 선택해 selectedTool에 저장
 * 2. grid 셀에서 mousedown → onMouseDown이 selectedTool을 lastActiveToolRef에 보관, dragSourceRef 세팅
 * 3. 외부 이벤트로 toggleMode() 호출 (isEditorMode: false, selectedTool: null)
 * 4. mouseup → onMouseUp의 restoreLastActiveTool()이 실행됨
 *
 * 수정 전: restoreLastActiveTool이 팔레트 도구를 테스트 모드에 복원 → 버그
 * 수정 후: isEditorMode가 false이고 source==='palette'이면 복원하지 않음 → 수정됨
 */
test.describe('Bug 1 · 2 — 팔레트 도구 테스트 모드 누수 없음', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGrid(page);
  });

  test('drag 중 toggleMode()가 호출되어 테스트 모드로 전환돼도 selectedTool은 null이다', async ({ page }) => {
    // 에디터 모드에서 mirror 기물 배치
    await page.evaluate(() => {
      const s = window.__rayStore.getState() as any;
      const grid = Array.from({ length: 5 }, () => Array(5).fill(null));
      grid[2][2] = { type: 'mirror', rotation: 0, canMove: true, canRotate: true, isInventory: false };
      s.setMapData(grid);
    });

    // 팔레트에서 mirror 선택 (에디터 모드)
    await page.locator('[data-tool="mirror"]').click();
    const toolBefore = await getSelectedTool(page);
    expect(toolBefore?.source).toBe('palette');

    // grid 셀 위에서 mousedown → lastActiveToolRef에 palette tool 보관, dragSourceRef 세팅
    const { x, y } = await cellCenter(page, 2, 2);
    await page.mouse.move(x, y);
    await page.mouse.down();

    // Race: drag 진행 중 외부 이벤트처럼 toggleMode() 직접 호출
    await page.evaluate(() => (window.__rayStore.getState() as any).toggleMode());

    // 이제 isEditorMode === false, selectedTool === null, 하지만 dragSourceRef는 여전히 grid drag
    const modeAfter = await page.evaluate(() => (window.__rayStore.getState() as any).isEditorMode);
    expect(modeAfter).toBe(false);

    // mouseup 발생 → onMouseUp 실행 → restoreLastActiveTool() 호출됨
    await page.mouse.up();

    // 수정 후: 팔레트 도구가 테스트 모드에서 복원되지 않아야 한다
    const toolAfter = await getSelectedTool(page);
    expect(toolAfter).toBeNull();
  });

  test('테스트 모드에서 selectedTool이 없을 때 빈 셀을 클릭해도 아무것도 배치되지 않는다', async ({ page }) => {
    await loadPlayMap(page, emptyGrid5(), makeMapDoc({ id: 'empty', title: 'Empty' }));

    const { x, y } = await cellCenter(page, 2, 2);
    await page.mouse.click(x, y);

    const cell = await getCell(page, 2, 2);
    expect(cell).toBeNull();
  });

  test('테스트 모드에서 팔레트 tool이 강제로 selectedTool에 들어갔어도 빈 셀 클릭이 기물을 배치하지 않는다', async ({ page }) => {
    // loadMapForPlay로 테스트 모드 진입
    await loadPlayMap(page, emptyGrid5(), makeMapDoc({ id: 't', title: 'T' }));

    // 강제로 palette tool을 selectedTool에 주입 (버그 상황 시뮬레이션)
    await page.evaluate(() => {
      (window.__rayStore.getState() as any).setSelectedTool({ type: 'mirror', source: 'palette' });
    });

    const { x, y } = await cellCenter(page, 1, 1);
    await page.mouse.click(x, y);

    // 팔레트 도구는 test mode에서 배치 불가
    const cell = await getCell(page, 1, 1);
    expect(cell).toBeNull();
  });
});
