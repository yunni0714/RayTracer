import type { Difficulty, MapDocument, MapItemDTO, Rotation } from '../types/game';
import { DIFFICULTIES } from './difficulty';

/* ════════════════════════════════════════════════════════
   어드민 맵 관리의 순수 로직 (검색/정렬/통계/회전·특성).
   Firestore 비의존 — 단위 테스트는 tests/adminMaps.test.ts.
   컴포넌트는 렌더만, 계산은 여기 (laserEngine 의 계산/렌더 분리와 같은 결).
   ════════════════════════════════════════════════════════ */

// 난이도 목록은 lib/difficulty.ts 단일 소스 — 어드민 화면들이 여기서 쓰던 경로를 유지한다
export { DIFFICULTIES };
export const ROTATIONS: Rotation[] = [0, 45, 90, 135, 180, 225, 270, 315];

export type MapSortKey = 'createdAt' | 'reactionGod' | 'reactionOk';

// 제목·작성자 부분일치 (대소문자 무시). 빈 쿼리는 전체.
export function filterMaps(maps: MapDocument[], query: string): MapDocument[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...maps];
  return maps.filter(m =>
    (m.title ?? '').toLowerCase().includes(q) || (m.author ?? '').toLowerCase().includes(q)
  );
}

// createdAt = ISO 문자열 내림차순, 반응 = 숫자 내림차순 (누락은 0/빈문자 취급).
export function sortMaps(maps: MapDocument[], key: MapSortKey): MapDocument[] {
  const sorted = [...maps];
  if (key === 'createdAt') {
    sorted.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  } else {
    sorted.sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0));
  }
  return sorted;
}

export interface MapStats {
  total: number;
  totalOk: number;
  totalGod: number;
  byDifficulty: Record<Difficulty, number>;
  topGod: MapDocument[];
  topOk: MapDocument[];
}

const TOP_N = 5;

export function computeMapStats(maps: MapDocument[]): MapStats {
  const byDifficulty = Object.fromEntries(DIFFICULTIES.map(d => [d, 0])) as Record<Difficulty, number>;
  let totalOk = 0;
  let totalGod = 0;
  for (const m of maps) {
    totalOk += m.reactionOk ?? 0;
    totalGod += m.reactionGod ?? 0;
    if (m.difficulty in byDifficulty) byDifficulty[m.difficulty] += 1;
  }
  return {
    total: maps.length,
    totalOk,
    totalGod,
    byDifficulty,
    topGod: sortMaps(maps, 'reactionGod').slice(0, TOP_N),
    topOk: sortMaps(maps, 'reactionOk').slice(0, TOP_N),
  };
}

/* ── 회전 편집 ──────────────────────────────────────────── */

function normalizeRotation(deg: number): Rotation {
  return (((deg % 360) + 360) % 360) as Rotation;
}

// index 기물의 각도를 delta 만큼 돌린 새 배열. 원본은 건드리지 않는다.
export function rotateMapItem(items: MapItemDTO[], index: number, delta: number): MapItemDTO[] {
  return setMapItemRotation(items, index, normalizeRotation((items[index]?.rotation ?? 0) + delta));
}

export function setMapItemRotation(items: MapItemDTO[], index: number, rotation: number): MapItemDTO[] {
  if (index < 0 || index >= items.length) return items;
  const next = [...items];
  next[index] = { ...next[index], rotation: normalizeRotation(rotation) };
  return next;
}

// 좌표로 기물 인덱스 찾기 (없으면 -1)
export function findItemIndexAt(items: MapItemDTO[], x: number, y: number): number {
  return items.findIndex(i => i.x === x && i.y === y);
}

/* ── 일괄 편집 ──────────────────────────────────────────
   여러 맵 × 특정 기물 타입에 같은 연산을 건다. 단일 맵 회전 편집(MapRotationEditor)의
   확장 — 대상 선별(필터)과 연산(op)만 순수 함수로 두고, 저장은 호출부가 한다. */

export interface BulkFilter {
  types: string[];           // 대상 기물 타입. 빈 배열이면 대상 없음
  includeInventory: boolean; // 유저 지급(인벤토리) 기물 포함 여부
  rotatableOnly: boolean;    // canRotate 기물만 대상으로
}

export type BulkRotationOp =
  | { mode: 'delta'; delta: number }   // 현재 각도에서 상대 회전
  | { mode: 'set'; rotation: number }; // 절대 각도 지정

// 일괄 편집이 지원하는 연산. 새 연산은 이 union + planBulkEdit 의 분기에만 추가한다.
export type BulkOp =
  | { kind: 'rotate'; op: BulkRotationOp }
  | { kind: 'clearTraits' };

type TypeScanFilter = Omit<BulkFilter, 'types'>;

function passesScan(item: MapItemDTO, filter: TypeScanFilter): boolean {
  if (!filter.includeInventory && item.isInventory) return false;
  if (filter.rotatableOnly && !item.canRotate) return false;
  return true;
}

export function matchesBulkFilter(item: MapItemDTO, filter: BulkFilter): boolean {
  return filter.types.includes(item.type) && passesScan(item, filter);
}

export interface PieceTypeCount {
  type: string;
  pieces: number; // 대상 맵 전체에서의 기물 수
  maps: number;   // 이 타입을 가진 맵 수
}

// 스코프 맵들에 실제로 존재하는 기물 타입 집계 (많은 순 → 타입명 순)
export function collectPieceTypeCounts(
  maps: MapDocument[], filter: TypeScanFilter,
): PieceTypeCount[] {
  const byType = new Map<string, { pieces: number; maps: Set<string> }>();
  for (const m of maps) {
    for (const item of m.mapData ?? []) {
      if (!passesScan(item, filter)) continue;
      const entry = byType.get(item.type) ?? { pieces: 0, maps: new Set<string>() };
      entry.pieces += 1;
      entry.maps.add(m.id);
      byType.set(item.type, entry);
    }
  }
  return [...byType.entries()]
    .map(([type, e]) => ({ type, pieces: e.pieces, maps: e.maps.size }))
    .sort((a, b) => b.pieces - a.pieces || a.type.localeCompare(b.type));
}

// 필터에 걸린 기물만 회전시킨 새 배열. 실제 변경이 없으면 원본을 그대로 돌려준다.
export function applyBulkRotationToItems(
  items: MapItemDTO[], filter: BulkFilter, op: BulkRotationOp,
): { items: MapItemDTO[]; changed: number } {
  let changed = 0;
  const next = items.map(item => {
    if (!matchesBulkFilter(item, filter)) return item;
    const rotation = normalizeRotation(
      op.mode === 'delta' ? item.rotation + op.delta : op.rotation,
    );
    if (rotation === item.rotation) return item;
    changed += 1;
    return { ...item, rotation };
  });
  return changed === 0 ? { items, changed: 0 } : { items: next, changed };
}

/* ✨ 특성 삭제 — 필터에 걸린 기물의 특성 3종(유저지급·이동·회전)을 한 번에 끈다.
   인게임 clearTraits()(lib/pieceActions.ts)의 여러 맵 버전 — 기물 자체는 지우지 않고
   좌표·타입·회전도 건드리지 않는다. 3종을 함께 끄므로 "canMove 는 isInventory 에
   종속" 불변 규칙을 자동으로 만족한다. */
export function applyBulkTraitClearToItems(
  items: MapItemDTO[], filter: BulkFilter,
): { items: MapItemDTO[]; changed: number } {
  let changed = 0;
  const next = items.map(item => {
    if (!matchesBulkFilter(item, filter)) return item;
    // 이미 특성이 없는 기물은 변경으로 세지 않는다 (회전의 "이미 그 각도" 와 같은 규칙)
    if (!item.canMove && !item.canRotate && !item.isInventory) return item;
    changed += 1;
    return { ...item, canMove: false, canRotate: false, isInventory: false };
  });
  return changed === 0 ? { items, changed: 0 } : { items: next, changed };
}

export interface BulkPlanEntry {
  id: string;
  title: string;
  items: MapItemDTO[]; // 저장할 전체 mapData (연산 대상 외 필드는 원본 유지)
  changed: number;
}

// 실제로 바뀌는 맵만 담은 저장 계획. 빈 배열 = 적용할 것이 없음.
export function planBulkEdit(
  maps: MapDocument[], filter: BulkFilter, op: BulkOp,
): BulkPlanEntry[] {
  const plan: BulkPlanEntry[] = [];
  for (const m of maps) {
    const source = m.mapData ?? [];
    const { items, changed } = op.kind === 'rotate'
      ? applyBulkRotationToItems(source, filter, op.op)
      : applyBulkTraitClearToItems(source, filter);
    if (changed > 0) plan.push({ id: m.id, title: m.title, items, changed });
  }
  return plan;
}

// 날짜 표기 — 목록/제안에서 공용
export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '날짜 없음';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '날짜 없음' : d.toLocaleString('ko-KR');
}
