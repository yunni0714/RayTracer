import type { PieceType } from '../types/game';

export const SVG_ART: Record<PieceType, string> = {
  ray: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" stroke-width="8"/><path d="M50 45.67 v-41.03" fill="currentColor" stroke="currentColor" stroke-width="8" stroke-linecap="square"/></svg>`,
  target: `<svg viewBox="0 0 100 100"><path d="M50 12 l38 38 -38 38 -38 -38 38 -38 Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="miter"/><path d="M40.5 23 l9 -9 10 9 -10 9 -9 -9 Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="miter"/></svg>`,
  mirror: `<svg viewBox="0 0 100 100"><path d="M15 85 L85 15" stroke="currentColor" stroke-width="10" stroke-linecap="square"/></svg>`,
  half_mirror: `<svg viewBox="0 0 100 100"><path d="M10 80 L70 20 M30 90 L90 30" stroke="currentColor" stroke-width="8" stroke-linecap="square"/></svg>`,
  block: `<svg viewBox="0 0 100 100"><path d="M15 15 L85 85 M85 15 L15 85" stroke="currentColor" stroke-width="10" stroke-linecap="square"/></svg>`,
  tunnel: `<svg viewBox="0 0 100 100"><path d="M11.75 20 v60 M88.25 20 v60" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="square"/></svg>`,
  single_mirror: `<svg viewBox="0 0 100 100"><path d="M15 85 L85 15 L85 85 Z" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="miter"/></svg>`,
  target_mirror_a: `<svg viewBox="0 0 100 100"><path d="M15 85 l70 -70 v70 h-70 Z" fill="none" stroke="currentColor" stroke-width="10"/><rect x="65" y="50" width="20" height="18" fill="none" stroke="currentColor" stroke-width="8"/></svg>`,
  target_mirror_b: `<svg viewBox="0 0 100 100"><path d="M15 85 l70 -70 v70 h-70 Z" fill="none" stroke="currentColor" stroke-width="10"/><rect x="50" y="65" width="18" height="20" fill="none" stroke="currentColor" stroke-width="8"/></svg>`,
  mirror_45: `<svg viewBox="0 0 100 100"><path d="M15 50 L85 50" stroke="currentColor" stroke-width="10" stroke-linecap="square"/></svg>`,
  half_mirror_45: `<svg viewBox="0 0 100 100"><path d="M15 50 L85 50" stroke="currentColor" stroke-width="8" stroke-dasharray="15 10" stroke-linecap="square"/></svg>`,
  diag_single_mirror_a: `<svg viewBox="0 0 100 100"><path d="M15 50 L85 50 L85 85 L15 85 Z" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="miter"/></svg>`,
  diag_single_mirror_b: `<svg viewBox="0 0 100 100"><path d="M15 50 L85 50 L85 15 L15 15 Z" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="miter"/></svg>`,
  v_mirror: `<svg viewBox="0 0 100 100"><path d="M50 15 L50 85" stroke="currentColor" stroke-width="10" stroke-linecap="square"/></svg>`,
  v_half_mirror: `<svg viewBox="0 0 100 100"><path d="M50 15 L50 85" stroke="currentColor" stroke-width="8" stroke-dasharray="15 10" stroke-linecap="square"/></svg>`,
  v_single_mirror: `<svg viewBox="0 0 100 100"><path d="M50 15 L50 85 L85 85 L85 15 Z" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="miter"/></svg>`,
  v_target_mirror_a: `<svg viewBox="0 0 100 100"><path d="M50 15 L50 85 L85 85 L85 15 Z" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="miter"/><rect x="65" y="40" width="20" height="20" fill="none" stroke="currentColor" stroke-width="8"/></svg>`,
  v_target_mirror_b: `<svg viewBox="0 0 100 100"><path d="M50 15 L50 85 L85 85 L85 15 Z" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="miter"/><rect x="65" y="65" width="20" height="20" fill="none" stroke="currentColor" stroke-width="8"/></svg>`,

  // ── 중급(기믹) 기물 — Group A: 무상태 ──
  diode: `<svg viewBox="0 0 100 100"><path d="M50 18 L76 62 H24 Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="miter"/><path d="M26 80 H74" stroke="currentColor" stroke-width="8" stroke-linecap="square"/></svg>`,
  v_mirror_double: `<svg viewBox="0 0 100 100"><path d="M42 15 V85 M58 15 V85" stroke="currentColor" stroke-width="8" stroke-linecap="square"/></svg>`,
  v_half_mirror_double: `<svg viewBox="0 0 100 100"><path d="M42 15 V85 M58 15 V85" stroke="currentColor" stroke-width="7" stroke-dasharray="14 9" stroke-linecap="square"/></svg>`,
  small_target: `<svg viewBox="0 0 100 100"><path d="M50 26 l24 24 -24 24 -24 -24 Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="miter"/><path d="M50 12 V26" stroke="currentColor" stroke-width="8" stroke-linecap="square"/></svg>`,
  omni_target: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" stroke-width="8"/><path d="M50 32 l18 18 -18 18 -18 -18 Z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="miter"/></svg>`,
  high_block: `<svg viewBox="0 0 100 100"><rect x="18" y="18" width="64" height="64" fill="none" stroke="currentColor" stroke-width="10"/><path d="M18 18 L82 82 M82 18 L18 82" stroke="currentColor" stroke-width="8"/></svg>`,

  // ── 중급(기믹) 기물 — Group B: 조건부/상태형 ──
  transistor_gate: `<svg viewBox="0 0 100 100"><path d="M15 38 H85 M15 62 H85" stroke="currentColor" stroke-width="8" stroke-linecap="square"/><path d="M50 62 V88" stroke="currentColor" stroke-width="8" stroke-linecap="square"/><circle cx="50" cy="50" r="7" fill="currentColor"/></svg>`,
  cross_gate: `<svg viewBox="0 0 100 100"><path d="M50 12 V36 M50 64 V88 M12 50 H36 M64 50 H88" stroke="currentColor" stroke-width="8" stroke-linecap="square"/><rect x="38" y="38" width="24" height="24" fill="none" stroke="currentColor" stroke-width="7"/></svg>`,
  priority_gate: `<svg viewBox="0 0 100 100"><path d="M50 12 V36 M50 64 V88 M12 50 H36 M64 50 H88" stroke="currentColor" stroke-width="8" stroke-linecap="square"/><path d="M40 50 H60 M53 42 L62 50 L53 58" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="miter"/></svg>`,
  target_projector: `<svg viewBox="0 0 100 100"><path d="M50 34 l22 22 -22 22 -22 -22 Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="miter"/><path d="M50 8 V34" stroke="currentColor" stroke-width="8" stroke-linecap="square"/><path d="M28 78 H72" stroke="currentColor" stroke-width="7" stroke-linecap="square"/></svg>`,
  inverting_projector: `<svg viewBox="0 0 100 100"><circle cx="50" cy="58" r="24" fill="none" stroke="currentColor" stroke-width="8"/><path d="M50 8 V34" stroke="currentColor" stroke-width="8" stroke-linecap="square"/><path d="M38 58 H62" stroke="currentColor" stroke-width="8" stroke-linecap="square"/></svg>`,
};

export const GRID_SIZE = 5;
export const CELL_SIZE = 100;
