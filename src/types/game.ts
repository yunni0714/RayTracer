export type PieceType =
  | 'ray'
  | 'target'
  | 'mirror'
  | 'half_mirror'
  | 'block'
  | 'tunnel'
  | 'single_mirror'
  | 'target_mirror_a'
  | 'target_mirror_b'
  | 'mirror_45'
  | 'half_mirror_45'
  | 'diag_single_mirror_a'
  | 'diag_single_mirror_b'
  | 'v_mirror'
  | 'v_half_mirror'
  | 'v_single_mirror'
  | 'v_target_mirror_a'
  | 'v_target_mirror_b'
  // ── 중급(기믹) 기물 — Group A: 무상태 ──
  | 'diode'
  | 'v_mirror_double'
  | 'v_half_mirror_double'
  | 'small_target'
  | 'omni_target'
  | 'high_block'
  // ── 중급(기믹) 기물 — Group B: 조건부/상태형 ──
  | 'transistor_gate'
  | 'cross_gate'
  | 'priority_gate'
  | 'target_projector'
  | 'inverting_projector';

// 저장·렌더 경계의 기물 타입 — 빌트인(PieceType) 또는 config 가 정의한 커스텀 id.
// 접근자(getSvgArt/getBehavior/...)가 미지 문자열에도 안전 폴백을 보장한다.
export type AnyPieceType = string;

export type Rotation = 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315;

export type Difficulty = 'Tutor' | 'Easy' | 'Normal' | 'Hard' | 'Insane';

export interface CellData {
  type: AnyPieceType;
  rotation: Rotation;
  canMove: boolean;
  canRotate: boolean;
  isInventory: boolean;
}

export interface InventoryItem {
  count: number;
  type: AnyPieceType;
  canRotate: boolean;
  rotation: Rotation;
}

export interface MapItemDTO {
  x: number;
  y: number;
  type: AnyPieceType;
  rotation: Rotation;
  canMove: boolean;
  canRotate: boolean;
  isInventory: boolean;
}

export interface MapDocument {
  id: string;
  title: string;
  author: string;
  authorUid: string;
  difficulty: Difficulty;
  description?: string;
  mapData: MapItemDTO[];
  gridSize?: number; // 균일 NxN. 없으면 5 (하위호환)
  reactionOk: number;
  reactionGod: number;
  diffVotes: Partial<Record<Difficulty, number>>;
  createdAt: string;
  version: number;
}

export type SuggestionCategory = 'NG' | 'ABCD';

// 제안 카테고리 표시 문구 단일 소스. 저장 값은 'NG'/'ABCD' 그대로 두고
// 화면 문구만 여기서 가져간다 — 제안 등록·제작자 목록·어드민·알림함 공용.
export const SUGGESTION_CATEGORY_LABELS: Record<SuggestionCategory, string> = {
  NG: '🆖 기물 줄임',
  ABCD: '🔠 복수정답',
};

export interface SuggestionDocument {
  id: string;
  category: SuggestionCategory;
  comment: string;
  suggesterUid: string;
  suggesterNickname: string;
  createdAt: string;
  mapData: MapItemDTO[];
}

// ── 알림함(메일함) ──────────────────────────────────────
// Firestore users/{uid}/inbox/{notifId}. Cloud Functions 가 없으므로
// 제안자의 클라이언트가 맵 소유자의 알림함에 직접 쓴다 — 스팸 주입 방어는
// firestore.rules 가 맵 문서를 get() 해 소유권을 검증하는 쪽에서 한다.
export type NotificationType = 'suggestion';

export interface NotificationDocument {
  id: string;
  type: NotificationType;
  read: boolean;
  createdAt: string; // ISO 8601
  fromUid: string;
  fromNickname: string;
  mapId: string;
  mapTitle: string;
  suggestionCategory?: SuggestionCategory;
}

export type GameMode = 'editor' | 'test' | 'mapEdit';

// 필기 오버레이(PenLayer) 획. 좌표는 캔버스 기준 0~1 정규화.
// 커밋된 획은 불변으로 취급 — 배열은 항상 통째로 교체한다 (undo 스냅샷이 참조 공유).
export interface PenPoint { x: number; y: number }
export interface PenStroke {
  tool: 'blue' | 'green' | 'red';
  width: number;
  pts: PenPoint[];
}

export interface GameSnapshot {
  mapData: (CellData | null)[][];
  playerInventory: Record<string, InventoryItem>;
  penStrokes: PenStroke[];
}

export interface SelectedTool {
  type: AnyPieceType;
  source: 'palette' | 'grid' | 'inventory';
  fromRow?: number;
  fromCol?: number;
  inventoryKey?: string;
  isInvTool?: boolean;
  canRotate?: boolean;
  rotation?: Rotation;
}
