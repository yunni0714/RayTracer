import type { PieceType } from '../types/game';

export const SVG_ART: Record<PieceType, string> = {
  ray: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" stroke-width="8"/><path d="M50 45.67 v-41.03" fill="currentColor" stroke="currentColor" stroke-width="8" stroke-linecap="square"/></svg>`,
  target: `<svg viewBox="0 0 100 100"><path d="M50 12 l38 38 -38 38 -38 -38 38 -38 Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="miter"/><path d="M40.5 23 l9 -9 10 9 -10 9 -9 -9 Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="miter"/></svg>`,
  mirror: `<svg viewBox="0 0 100 100"><path d="M15 85 L85 15" stroke="currentColor" stroke-width="10" stroke-linecap="square"/></svg>`,
  half_mirror: `<svg viewBox="0 0 100 100"><path d="M10 80 L70 20 M30 90 L90 30" stroke="currentColor" stroke-width="8" stroke-linecap="square"/></svg>`,
  block: `<svg viewBox="0 0 100 100"><path d="M15 15 L85 85 M85 15 L15 85" stroke="currentColor" stroke-width="10" stroke-linecap="square"/></svg>`,
  tunnel: `<svg viewBox="0 0 100 100"><path d="M38 32 L66 50 L38 68 Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="miter"/></svg>`,
  single_mirror: `<svg viewBox="0 0 100 100"><path d="M15 85 L85 15 L85 85 Z" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="miter"/></svg>`,
  target_mirror_a: `<svg viewBox="0 0 100 100"><path d="M15 85 l70 -70 v70 h-70 Z" fill="none" stroke="currentColor" stroke-width="10"/><rect x="65" y="50" width="20" height="18" fill="none" stroke="currentColor" stroke-width="8"/></svg>`,
  target_mirror_b: `<svg viewBox="0 0 100 100"><path d="M15 85 l70 -70 v70 h-70 Z" fill="none" stroke="currentColor" stroke-width="10"/><rect x="50" y="65" width="18" height="20" fill="none" stroke="currentColor" stroke-width="8"/></svg>`,
  mirror_45: `<svg viewBox="0 0 100 100"><path d="M12 66 L88 34" stroke="currentColor" stroke-width="10" stroke-linecap="square"/></svg>`,
  half_mirror_45: `<svg viewBox="0 0 100 100"><path d="M6 60 L74 31 M26 69 L94 40" stroke="currentColor" stroke-width="8" stroke-linecap="square"/></svg>`,
  diag_single_mirror_a: `<svg viewBox="0 0 100 100"><path d="M12 66 L88 34 L88 80 L12 80 Z" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="miter"/></svg>`,
  diag_single_mirror_b: `<svg viewBox="0 0 100 100"><path d="M12 34 L88 66 L88 20 L12 20 Z" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="miter"/></svg>`,
  v_mirror: `<svg viewBox="0 0 100 100"><path d="M50 15 L50 85" stroke="currentColor" stroke-width="10" stroke-linecap="square"/></svg>`,
  v_half_mirror: `<svg viewBox="0 0 100 100"><path d="M50 15 L50 85" stroke="currentColor" stroke-width="8" stroke-dasharray="15 10" stroke-linecap="square"/></svg>`,
  v_single_mirror: `<svg viewBox="0 0 100 100"><path d="M50 15 L50 85 L85 85 L85 15 Z" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="miter"/></svg>`,
  v_target_mirror_a: `<svg viewBox="0 0 100 100"><path d="M50 15 L50 85 L85 85 L85 15 Z" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="miter"/><rect x="65" y="40" width="20" height="20" fill="none" stroke="currentColor" stroke-width="8"/></svg>`,
  v_target_mirror_b: `<svg viewBox="0 0 100 100"><path d="M50 15 L50 85 L85 85 L85 15 Z" fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="miter"/><rect x="65" y="65" width="20" height="20" fill="none" stroke="currentColor" stroke-width="8"/></svg>`,

  // ── 중급(기믹) 기물 — Group A: 무상태 ──
  diode: `<svg viewBox="0 0 100 100"><path d="M26 30 L60 50 L26 70 Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="miter"/><path d="M70 28 V72" stroke="currentColor" stroke-width="8" stroke-linecap="square"/></svg>`,
  v_mirror_double: `<svg viewBox="0 0 100 100"><path d="M42 15 V85 M58 15 V85" stroke="currentColor" stroke-width="8" stroke-linecap="square"/></svg>`,
  v_half_mirror_double: `<svg viewBox="0 0 100 100"><path d="M42 15 V85 M58 15 V85" stroke="currentColor" stroke-width="7" stroke-dasharray="14 9" stroke-linecap="square"/></svg>`,
  small_target: `<svg viewBox="0 0 100 100"><path d="M50 34 l16 16 -16 16 -16 -16 Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="miter"/><path d="M10 50 H34 M66 50 H90" stroke="currentColor" stroke-width="8" stroke-linecap="square"/></svg>`,
  omni_target: `<svg viewBox="0 0 100 100"><path d="M50 18 L82 50 50 82 18 50 Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="miter"/><path d="M50 42 l8 8 -8 8 -8 -8 Z" fill="currentColor"/></svg>`,
  high_block: `<svg viewBox="0 0 100 100"><rect x="18" y="18" width="64" height="64" fill="none" stroke="currentColor" stroke-width="10"/><path d="M18 18 L82 82 M82 18 L18 82" stroke="currentColor" stroke-width="8"/></svg>`,

  // ── 중급(기믹) 기물 — Group B: 조건부/상태형 ──
  transistor_gate: `<svg viewBox="0 0 100 100"><path d="M50 14 V60" stroke="currentColor" stroke-width="8" stroke-linecap="square"/><path d="M40 25 L50 14 L60 25 M32 44 L50 28 L68 44" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="miter"/><path d="M50 60 l11 13 -11 13 -11 -13 Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="miter"/></svg>`,
  cross_gate: `<svg viewBox="0 0 100 100"><path d="M34 14 H14 V34 M66 14 H86 V34 M86 66 V86 H66 M14 66 V86 H34" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="miter"/></svg>`,
  priority_gate: `<svg viewBox="0 0 100 100"><path d="M50 12 V36 M50 64 V88 M12 50 H36 M64 50 H88" stroke="currentColor" stroke-width="8" stroke-linecap="square"/><path d="M40 50 H60 M53 42 L62 50 L53 58" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="miter"/></svg>`,
  target_projector: `<svg viewBox="0 0 100 100"><path d="M41 40 A17 17 0 1 0 59 40" fill="none" stroke="currentColor" stroke-width="8"/><path d="M50 28 V54" stroke="currentColor" stroke-width="8" stroke-linecap="square"/><path d="M22 40 L11 55 L22 70 M78 40 L89 55 L78 70" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="miter"/></svg>`,
  inverting_projector: `<svg viewBox="0 0 100 100"><path d="M41 40 A17 17 0 1 0 59 40" fill="none" stroke="currentColor" stroke-width="8"/><path d="M50 28 V54" stroke="currentColor" stroke-width="8" stroke-linecap="square"/><path d="M26 26 Q12 55 26 84 M74 26 Q88 55 74 84" fill="none" stroke="currentColor" stroke-width="7"/></svg>`,
};

// 레거시 상수 — 런타임은 store gridSize / mapData.length 를 쓴다.
// (e2e 헬퍼와 기본값 호환을 위해 유지)
export const GRID_SIZE = 5;
export const CELL_SIZE = 100;

/* ── 어드민 config SVG 오버라이드 (pieceConfig.ts 가 주입) ── */

// 미지 타입 폴백: 점선 박스 + ? — config 가 지워진 커스텀 기물도 보이게 한다.
export const PLACEHOLDER_SVG =
  `<svg viewBox="0 0 100 100"><rect x="16" y="16" width="68" height="68" fill="none" stroke="currentColor" stroke-width="6" stroke-dasharray="12 8"/><text x="50" y="63" text-anchor="middle" font-size="38" font-weight="bold" fill="currentColor">?</text></svg>`;

let svgOverrides: Partial<Record<string, string>> = {};

export function setSvgOverrides(overrides: Partial<Record<string, string>>): void {
  svgOverrides = overrides;
}

export function getSvgArt(type: string): string {
  return svgOverrides[type] ?? (SVG_ART as Partial<Record<string, string>>)[type] ?? PLACEHOLDER_SVG;
}
