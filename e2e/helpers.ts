import type { Page } from '@playwright/test';
import type { CellData, MapDocument } from '../src/types/game';
import { CELL_SIZE } from '../src/lib/svgArt';

/** 완전한 MapDocument 픽스처 생성 (LoadedMapInfo 렌더에 필요한 모든 필드 포함) */
export function makeMapDoc(partial: { id: string; title: string }): MapDocument {
  return {
    id: partial.id,
    title: partial.title,
    author: 'test',
    authorUid: '',
    difficulty: 'Easy',
    description: '',
    mapData: [],
    reactionOk: 0,
    reactionGod: 0,
    diffVotes: {},
    createdAt: new Date().toISOString(),
    version: 1,
  };
}

type RayStore = {
  getState: () => {
    mapData: (CellData | null)[][];
    playerInventory: Record<string, { count: number; type: string; canRotate: boolean; rotation: number }>;
    selectedTool: { source: string; type: string } | null;
    isEditorMode: boolean;
    currentLoadedMapObj: MapDocument | null;
    loadMapForPlay: (grid: (CellData | null)[][], mapDoc: MapDocument | null) => void;
  };
};

declare global {
  interface Window { __rayStore: RayStore }
}

/** React 앱이 마운트되어 그리드가 DOM에 나타날 때까지 대기 */
export async function waitForGrid(page: Page) {
  await page.waitForSelector('[data-row="0"][data-col="0"]', { state: 'visible' });
}

/** 스토어를 통해 맵을 테스트 모드로 직접 로드 (Firebase 불필요) */
export async function loadPlayMap(
  page: Page,
  grid: (CellData | null)[][],
  mapDoc: Partial<MapDocument> & { id: string; title: string },
) {
  await page.evaluate(
    ({ g, m }) => window.__rayStore.getState().loadMapForPlay(g as (CellData | null)[][], m as MapDocument),
    { g: grid, m: mapDoc },
  );
  // React 리렌더링이 DOM에 반영될 때까지 대기
  await page.waitForFunction(() => typeof window.__rayStore !== 'undefined');
}

/** grid[row][col] 셀의 화면 중심 좌표 반환 */
export async function cellCenter(page: Page, row: number, col: number) {
  const loc = page.locator(`[data-row="${row}"][data-col="${col}"]`);
  await loc.waitFor({ state: 'visible' });
  const box = await loc.boundingBox();
  if (!box) throw new Error(`Cell [${row}][${col}] not found`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** 스토어 상태의 mapData[row][col] 읽기 */
export function getCell(page: Page, row: number, col: number) {
  return page.evaluate(
    ({ r, c }) => window.__rayStore.getState().mapData[r][c],
    { r: row, c: col },
  );
}

/** 인벤토리 key의 count 읽기 */
export function getInvCount(page: Page, key: string) {
  return page.evaluate(
    (k) => window.__rayStore.getState().playerInventory[k]?.count ?? 0,
    key,
  );
}

/** selectedTool 읽기 */
export function getSelectedTool(page: Page) {
  return page.evaluate(() => window.__rayStore.getState().selectedTool);
}

/** CELL_SIZE 크기의 빈 5×5 그리드 */
export function emptyGrid5(): (CellData | null)[][] {
  return Array.from({ length: 5 }, () => Array(5).fill(null));
}

export { CELL_SIZE };
