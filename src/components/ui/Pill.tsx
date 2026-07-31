import { cx } from './cx';
import type { Difficulty } from '../../types/game';

export type PillTone =
  | 'tutor' | 'easy' | 'normal' | 'hard' | 'insane' | 'none'
  | 'neutral' | 'success' | 'danger' | 'info'
  | 'catBasic' | 'catLogic' | 'catAdvanced' | 'catAdvancedLogic';

const TONES: Record<PillTone, string> = {
  tutor:   'bg-[var(--diff-tutor)] text-white',
  easy:    'bg-[var(--diff-easy)] text-white',
  normal:  'bg-[var(--diff-normal)] text-white',
  hard:    'bg-[var(--diff-hard)] text-white',
  insane:  'bg-[var(--diff-insane)] text-white',
  none:    'bg-[var(--diff-none)] text-[var(--diff-none-ink)]',
  neutral: 'bg-surface-2 text-ink border border-line',
  success: 'bg-success text-white',
  danger:  'bg-danger text-white',
  info:    'bg-primary text-primary-ink',
  // 맵 카테고리 (기물 등급 파생 — lib/mapCategory.ts)
  catBasic:        'bg-[var(--cat-basic)] text-white',
  catLogic:        'bg-[var(--cat-logic)] text-white',
  catAdvanced:     'bg-[var(--cat-advanced)] text-white',
  catAdvancedLogic:'bg-[var(--cat-advanced-logic)] text-white',
};

interface PillProps {
  tone?: PillTone;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function Pill({ tone = 'neutral', children, className, title }: PillProps) {
  return (
    <span
      title={title}
      className={cx(
        'inline-block text-[11px] font-extrabold px-2 py-0.5 rounded-md text-center',
        'whitespace-nowrap overflow-hidden text-ellipsis',
        TONES[tone], className,
      )}
    >
      {children}
    </span>
  );
}

const DIFF_TONE: Record<Difficulty, PillTone> = {
  Tutor: 'tutor', Easy: 'easy', Normal: 'normal', Hard: 'hard', Insane: 'insane',
};

export function DifficultyPill({ difficulty, className }: { difficulty: Difficulty | null; className?: string }) {
  return (
    <Pill tone={difficulty ? DIFF_TONE[difficulty] : 'none'} className={className}>
      {difficulty ?? '미정'}
    </Pill>
  );
}
