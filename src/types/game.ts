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
  | 'v_target_mirror_b';

export type Rotation = 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315;

export type Difficulty = 'Tutor' | 'Easy' | 'Normal' | 'Hard' | 'Insane';

export interface CellData {
  type: PieceType;
  rotation: Rotation;
  canMove: boolean;
  canRotate: boolean;
  isInventory: boolean;
}

export interface InventoryItem {
  count: number;
  type: PieceType;
  canRotate: boolean;
  rotation: Rotation;
}

export interface MapItemDTO {
  x: number;
  y: number;
  type: PieceType;
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
  reactionOk: number;
  reactionGod: number;
  diffVotes: Partial<Record<Difficulty, number>>;
  createdAt: string;
  version: number;
}

export interface SuggestionDocument {
  id: string;
  category: 'NG' | 'ABCD';
  comment: string;
  suggesterUid: string;
  suggesterNickname: string;
  createdAt: string;
  mapData: MapItemDTO[];
}

export type GameMode = 'editor' | 'test' | 'mapEdit';

export interface GameSnapshot {
  mapData: (CellData | null)[][];
  playerInventory: Record<string, InventoryItem>;
}

export interface SelectedTool {
  type: PieceType;
  source: 'palette' | 'grid' | 'inventory';
  fromRow?: number;
  fromCol?: number;
  inventoryKey?: string;
}
