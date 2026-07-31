import type { Difficulty, MapDocument, MapItemDTO, Rotation } from '../types/game';

/* ════════════════════════════════════════════════════════
   어드민 맵 관리의 순수 로직 (검색/정렬/통계/회전).
   Firestore 비의존 — 단위 테스트는 tests/adminMaps.test.ts.
   컴포넌트는 렌더만, 계산은 여기 (laserEngine 의 계산/렌더 분리와 같은 결).
   ════════════════════════════════════════════════════════ */

export const DIFFICULTIES: Difficulty[] = ['Tutor', 'Easy', 'Normal', 'Hard', 'Insane'];
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

// 날짜 표기 — 목록/제안에서 공용
export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '날짜 없음';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '날짜 없음' : d.toLocaleString('ko-KR');
}
