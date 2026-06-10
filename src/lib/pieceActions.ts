import { useGameStore } from '../store/gameStore';
import type { CellData, PieceType, Rotation } from '../types/game';

export const PIECE_LABELS: Record<PieceType, string> = {
  ray: '발사기',
  target: '표적',
  mirror: '거울',
  half_mirror: '반거울',
  block: '블럭',
  tunnel: '터널',
  single_mirror: '단면거울',
  target_mirror_a: '표적거울 A',
  target_mirror_b: '표적거울 B',
  mirror_45: '45° 거울',
  half_mirror_45: '45° 반거울',
  diag_single_mirror_a: '대각 단면거울 A',
  diag_single_mirror_b: '대각 단면거울 B',
  v_mirror: '수직거울',
  v_half_mirror: '수직 반거울',
  v_single_mirror: '수직 단면거울',
  v_target_mirror_a: '수직 표적거울 A',
  v_target_mirror_b: '수직 표적거울 B',
  diode: '다이오드',
  v_mirror_double: '수직 양면거울',
  v_half_mirror_double: '수직 양면 반거울',
  small_target: '소형 표적',
  omni_target: '전방위 표적',
  high_block: '높은 블럭',
  transistor_gate: '관문',
  cross_gate: '교차 관문',
  priority_gate: '우선순위 관문',
  target_projector: '표적 프로젝터',
  inverting_projector: '반전 프로젝터',
};

const ADVANCED_TYPES: PieceType[] = [
  'mirror_45', 'half_mirror_45', 'diag_single_mirror_a', 'v_target_mirror_a',
  'diag_single_mirror_b', 'v_target_mirror_b', 'v_mirror', 'v_half_mirror', 'v_single_mirror',
];

function isAdvancedMap(
  mapData: (CellData | null)[][],
  inventory: Record<string, { type: PieceType; count: number }>,
): boolean {
  for (const row of mapData) {
    for (const cell of row) {
      if (cell && ADVANCED_TYPES.includes(cell.type)) return true;
    }
  }
  for (const key in inventory) {
    if (ADVANCED_TYPES.includes(inventory[key].type) && inventory[key].count > 0) return true;
  }
  return false;
}

export function getRotationStep(type: PieceType): 45 | 90 {
  if (type === 'mirror_45' || type === 'half_mirror_45') return 45;
  if (type === 'ray' || type === 'target') {
    const { mapData, playerInventory } = useGameStore.getState();
    return isAdvancedMap(mapData, playerInventory) ? 45 : 90;
  }
  return 90;
}

// 회전이 무의미한 기물 (방향성 없음)
export const NON_ROTATABLE: PieceType[] = ['block', 'high_block', 'omni_target'];

// 회전. 에디터: 방향성 기물 전부, 테스트: canRotate 기물만. 성공 여부 반환.
export function rotatePiece(row: number, col: number): boolean {
  const state = useGameStore.getState();
  const cell = state.mapData[row][col];
  if (!cell || NON_ROTATABLE.includes(cell.type)) return false;
  if (!state.isEditorMode && !cell.canRotate) return false;
  state.saveUndoSnapshot();
  const step = getRotationStep(cell.type);
  let newRotation: number;
  if (step === 90 && cell.rotation % 90 !== 0) {
    newRotation = (Math.floor(cell.rotation / 90) * 90 + 90) % 360;
  } else {
    newRotation = (cell.rotation + step) % 360;
  }
  state.setCell(row, col, { ...cell, rotation: newRotation as Rotation });
  return true;
}

// 기물 삭제 (에디터 전용)
export function deletePiece(row: number, col: number): void {
  const state = useGameStore.getState();
  if (!state.isEditorMode || !state.mapData[row][col]) return;
  state.saveUndoSnapshot();
  state.setCell(row, col, null);
  state.setSelectedCell(null);
}

// 인벤토리 회수 (테스트 모드, isInventory 기물)
export function refundPiece(row: number, col: number): void {
  const state = useGameStore.getState();
  const cell = state.mapData[row][col];
  if (state.isEditorMode || !cell?.isInventory) return;
  state.saveUndoSnapshot();
  state.refundToInventory(cell);
  state.setCell(row, col, null);
  state.setSelectedCell(null);
}

// 🔒 회전잠금 토글 (에디터)
export function toggleRotateLock(row: number, col: number): void {
  const state = useGameStore.getState();
  const cell = state.mapData[row][col];
  if (!state.isEditorMode || !cell) return;
  state.saveUndoSnapshot();
  state.setCell(row, col, { ...cell, canRotate: !cell.canRotate });
}

// 🎒 유저지급 토글 (에디터) — 덧칠과 동일하게 인벤 기물은 이동 가능
export function toggleUserSupply(row: number, col: number): void {
  const state = useGameStore.getState();
  const cell = state.mapData[row][col];
  if (!state.isEditorMode || !cell) return;
  state.saveUndoSnapshot();
  const isInventory = !cell.isInventory;
  state.setCell(row, col, { ...cell, isInventory, canMove: isInventory });
}

// ✨ 특성 삭제 — 팔레트 기본 배치 상태로 초기화
export function clearTraits(row: number, col: number): void {
  const state = useGameStore.getState();
  const cell = state.mapData[row][col];
  if (!state.isEditorMode || !cell) return;
  state.saveUndoSnapshot();
  state.setCell(row, col, { ...cell, isInventory: false, canMove: false, canRotate: false });
}
