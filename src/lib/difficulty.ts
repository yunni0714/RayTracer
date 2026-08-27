import type { Difficulty } from '../types/game';
import type { PillTone } from '../components/ui/Pill';

/* ════════════════════════════════════════════════════════
   난이도 단일 소스 — 순서 · 정렬 랭크 · Pill 톤 · CSS 변수.

   예전에는 `['Tutor','Easy',...]` 배열과 톤/변수 매핑이 9개 파일에 복사돼
   있었다. `Record<Difficulty, ...>` 형태는 타입이 누락을 잡아주지만 그냥
   `Difficulty[]` 배열인 쪽은 컴파일이 조용히 통과해서, 난이도를 하나
   추가하면 "업로드 드롭다운에는 없는데 필터에는 있는" 식으로 어긋났다.

   ⚠️ 난이도를 추가/제거할 때 고쳐야 할 곳은 두 군데뿐이다:
     ① `types/game.ts` 의 Difficulty 유니온
     ② 이 파일의 DIFFICULTIES 배열 (+ TONE/VAR/LABEL — 타입이 강제한다)
   그 외에 색 토큰 4곳(`styles/global.css` :root/.dark/.diff-pill,
   `tailwind.config.js`)은 CSS 라 타입이 못 잡아준다 — 같이 추가할 것.

   난이도 **값**을 늘리는 건 기존 맵에 안전하다. 모든 맵이 이미 difficulty
   필드를 갖고 있어서 백필도 인덱스 재배포도 필요 없다 (없던 필드를 추가한
   gridSize 와 다른 점). 다만 이미 저장된 이름을 **바꾸는** 건 DB 마이그레이션이
   필요하니, 새 난이도 이름은 처음에 확정할 것.
   ════════════════════════════════════════════════════════ */

/** 쉬운 것 → 어려운 것 순. 화면의 모든 난이도 목록이 이 순서를 따른다. */
export const DIFFICULTIES: readonly Difficulty[] = [
  'Tutor', 'Easy', 'Normal', 'Tricky', 'Hard', 'Insane',
] as const;

/** 정렬용 랭크. 난이도는 문자열이라 사전순이 무의미하다 — 순서 배열에서 파생. */
export const DIFFICULTY_RANK: Record<Difficulty, number> = Object.fromEntries(
  DIFFICULTIES.map((d, i) => [d, i]),
) as Record<Difficulty, number>;

/** Pill 톤. 새 난이도를 추가하면 여기가 컴파일 에러로 잡아준다. */
export const DIFF_TONE: Record<Difficulty, PillTone> = {
  Tutor: 'tutor', Easy: 'easy', Normal: 'normal',
  Tricky: 'tricky', Hard: 'hard', Insane: 'insane',
};

/** 난이도 색 CSS 변수명 (투표 칩이 인라인 style 로 쓴다). */
export const DIFF_VAR: Record<Difficulty, string> = {
  Tutor: '--diff-tutor', Easy: '--diff-easy', Normal: '--diff-normal',
  Tricky: '--diff-tricky', Hard: '--diff-hard', Insane: '--diff-insane',
};

/** 난이도 값 검증 (config 오버레이 등 신뢰할 수 없는 입력용). */
export function isDifficulty(v: unknown): v is Difficulty {
  return typeof v === 'string' && (DIFFICULTIES as readonly string[]).includes(v);
}

/**
 * 투표 집계에서 최다 득표 난이도. 표가 하나도 없으면 null.
 * MapCard·LibraryScreen·LoadedMapInfo·NextMapPanel 이 각자 복사본을 갖고 있었다.
 */
export function calculateUserDifficulty(
  diffVotes: Partial<Record<Difficulty, number>> | undefined | null,
): Difficulty | null {
  if (!diffVotes) return null;
  const entries = Object.entries(diffVotes) as [Difficulty, number][];
  if (entries.length === 0) return null;
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}
