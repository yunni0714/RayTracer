import { describe, it, expect } from 'vitest';
import {
  DIFFICULTIES, DIFFICULTY_RANK, DIFF_TONE, DIFF_VAR,
  isDifficulty, calculateUserDifficulty,
} from '../src/lib/difficulty';
import { describeCondition } from '../src/lib/catalogRules';
import type { Difficulty } from '../src/types/game';

/* 난이도 단일 소스의 계약.

   예전에는 난이도 배열/톤/변수/랭크가 9개 파일에 복사돼 있었다. Record<Difficulty,_>
   형태는 타입이 누락을 잡아주지만 Difficulty[] 배열 쪽은 컴파일이 조용히 통과해서,
   난이도를 하나 추가하면 화면마다 목록이 갈라졌다. 여기 테스트는 "난이도를 추가했을 때
   한 군데만 고치고 넘어가면 실패한다"를 보장한다. */

describe('난이도 단일 소스', () => {
  it('랭크는 배열 순서에서 파생된다 (수동 번호 매기기 없음)', () => {
    DIFFICULTIES.forEach((d, i) => expect(DIFFICULTY_RANK[d]).toBe(i));
    expect(Object.keys(DIFFICULTY_RANK)).toHaveLength(DIFFICULTIES.length);
  });

  it('랭크가 쉬운 것 → 어려운 것으로 단조 증가한다', () => {
    const ranks = DIFFICULTIES.map(d => DIFFICULTY_RANK[d]);
    for (let i = 1; i < ranks.length; i++) expect(ranks[i]).toBeGreaterThan(ranks[i - 1]);
  });

  it('모든 난이도에 Pill 톤과 CSS 변수가 있다', () => {
    for (const d of DIFFICULTIES) {
      expect(DIFF_TONE[d], `${d} 톤 누락`).toBeTruthy();
      expect(DIFF_VAR[d], `${d} CSS 변수 누락`).toMatch(/^--diff-/);
    }
    // 배열에 없는 값이 톤/변수에만 남아 있으면(제거하다 만 경우) 잡는다
    expect(Object.keys(DIFF_TONE).sort()).toEqual([...DIFFICULTIES].sort());
    expect(Object.keys(DIFF_VAR).sort()).toEqual([...DIFFICULTIES].sort());
  });

  it('isDifficulty 는 목록에 있는 값만 통과시킨다', () => {
    for (const d of DIFFICULTIES) expect(isDifficulty(d)).toBe(true);
    expect(isDifficulty('Moderate')).toBe(false); // 아직 없는 난이도
    expect(isDifficulty('normal')).toBe(false);   // 대소문자 구분
    expect(isDifficulty(undefined)).toBe(false);
    expect(isDifficulty(3)).toBe(false);
  });

  // DIFF_ALL = 5 하드코딩 회귀 방지 — 난이도가 늘면 "난이도 전체"가 영영 안 떴다
  it('난이도를 전부 고른 조건은 개수와 무관하게 "난이도 전체"로 요약된다', () => {
    expect(describeCondition({ kind: 'difficulty', values: [...DIFFICULTIES] }))
      .toBe('난이도 전체');
    expect(describeCondition({ kind: 'difficulty', values: [DIFFICULTIES[0]] }))
      .not.toBe('난이도 전체');
  });
});

describe('calculateUserDifficulty', () => {
  it('최다 득표 난이도를 돌려준다', () => {
    expect(calculateUserDifficulty({ Easy: 1, Normal: 5, Hard: 2 })).toBe('Normal');
  });

  it('표가 없으면 null', () => {
    expect(calculateUserDifficulty({})).toBeNull();
    expect(calculateUserDifficulty({ Easy: 0, Hard: 0 })).toBeNull();
  });

  // 예전에는 카드 4곳이 각자 복사본을 갖고 있었고 그중 3곳은 이 가드가 없어서,
  // diffVotes 가 없는 문서(어드민이 필드를 지운 맵 등)에서 Object.entries 가 던졌다
  it('diffVotes 가 없어도 던지지 않는다', () => {
    expect(calculateUserDifficulty(undefined)).toBeNull();
    expect(calculateUserDifficulty(null)).toBeNull();
  });

  it('동점이면 먼저 나온 쪽 (결정적)', () => {
    const votes: Partial<Record<Difficulty, number>> = { Easy: 3, Hard: 3 };
    expect(calculateUserDifficulty(votes)).toBe('Easy');
  });
});
