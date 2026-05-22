import type { PieceType } from '../types/game';

export const SVG_ART: Record<PieceType, string> = {
  ray: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="none" stroke="#333" stroke-width="8"/><path d="M50 45.67 v-41.03" fill="#040000" stroke="#333" stroke-width="8" stroke-linecap="square"/></svg>`,
  target: `<svg viewBox="0 0 100 100"><path d="M50 12 l38 38 -38 38 -38 -38 38 -38 Z" fill="none" stroke="#333" stroke-width="8" stroke-linejoin="miter"/><path d="M40.5 23 l9 -9 10 9 -10 9 -9 -9 Z" fill="none" stroke="#333" stroke-width="8" stroke-linejoin="miter"/></svg>`,
  mirror: `<svg viewBox="0 0 100 100"><path d="M15 85 L85 15" stroke="#333" stroke-width="10" stroke-linecap="square"/></svg>`,
  half_mirror: `<svg viewBox="0 0 100 100"><path d="M10 80 L70 20 M30 90 L90 30" stroke="#333" stroke-width="8" stroke-linecap="square"/></svg>`,
  block: `<svg viewBox="0 0 100 100"><path d="M15 15 L85 85 M85 15 L15 85" stroke="#333" stroke-width="10" stroke-linecap="square"/></svg>`,
  tunnel: `<svg viewBox="0 0 100 100"><path d="M11.75 20 v60 M88.25 20 v60" fill="none" stroke="#333" stroke-width="10" stroke-linecap="square"/></svg>`,
  single_mirror: `<svg viewBox="0 0 100 100"><path d="M15 85 L85 15 L85 85 Z" fill="none" stroke="#333" stroke-width="10" stroke-linejoin="miter"/></svg>`,
  target_mirror_a: `<svg viewBox="0 0 100 100"><path d="M15 85 l70 -70 v70 h-70 Z" fill="none" stroke="#333" stroke-width="10"/><rect x="65" y="50" width="20" height="18" fill="none" stroke="#333" stroke-width="8"/></svg>`,
  target_mirror_b: `<svg viewBox="0 0 100 100"><path d="M15 85 l70 -70 v70 h-70 Z" fill="none" stroke="#333" stroke-width="10"/><rect x="50" y="65" width="18" height="20" fill="none" stroke="#333" stroke-width="8"/></svg>`,
  mirror_45: `<svg viewBox="0 0 100 100"><path d="M15 50 L85 50" stroke="#333" stroke-width="10" stroke-linecap="square"/></svg>`,
  half_mirror_45: `<svg viewBox="0 0 100 100"><path d="M15 50 L85 50" stroke="#333" stroke-width="8" stroke-dasharray="15 10" stroke-linecap="square"/></svg>`,
  diag_single_mirror_a: `<svg viewBox="0 0 100 100"><path d="M15 50 L85 50 L85 85 L15 85 Z" fill="none" stroke="#333" stroke-width="10" stroke-linejoin="miter"/></svg>`,
  diag_single_mirror_b: `<svg viewBox="0 0 100 100"><path d="M15 50 L85 50 L85 15 L15 15 Z" fill="none" stroke="#333" stroke-width="10" stroke-linejoin="miter"/></svg>`,
  v_mirror: `<svg viewBox="0 0 100 100"><path d="M50 15 L50 85" stroke="#333" stroke-width="10" stroke-linecap="square"/></svg>`,
  v_half_mirror: `<svg viewBox="0 0 100 100"><path d="M50 15 L50 85" stroke="#333" stroke-width="8" stroke-dasharray="15 10" stroke-linecap="square"/></svg>`,
  v_single_mirror: `<svg viewBox="0 0 100 100"><path d="M50 15 L50 85 L85 85 L85 15 Z" fill="none" stroke="#333" stroke-width="10" stroke-linejoin="miter"/></svg>`,
  v_target_mirror_a: `<svg viewBox="0 0 100 100"><path d="M50 15 L50 85 L85 85 L85 15 Z" fill="none" stroke="#333" stroke-width="10" stroke-linejoin="miter"/><rect x="65" y="40" width="20" height="20" fill="none" stroke="#333" stroke-width="8"/></svg>`,
  v_target_mirror_b: `<svg viewBox="0 0 100 100"><path d="M50 15 L50 85 L85 85 L85 15 Z" fill="none" stroke="#333" stroke-width="10" stroke-linejoin="miter"/><rect x="65" y="65" width="20" height="20" fill="none" stroke="#333" stroke-width="8"/></svg>`,
};

export const GRID_SIZE = 5;
export const CELL_SIZE = 100;
