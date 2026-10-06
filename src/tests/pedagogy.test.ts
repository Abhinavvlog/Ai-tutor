import { describe, it, expect } from 'vitest';
import { determineNextMove, type PedagogyState } from '../../supabase/functions/tutor-turn/logic/pedagogy';

const baseState: PedagogyState = {
  mastery: 0.5,
  hintsUsed: 0,
  correctStreak: 0,
  interruptions: 0,
  minutesOnConcept: 5,
  hasMisconception: false,
  currentDifficulty: 'easy',
  prereqsCleared: true,
};

describe('Pedagogy rules', () => {
  it('increases difficulty after 3 correct answers', () => {
    const state = { ...baseState, correctStreak: 2 };
    const res = determineNextMove(state, true, 'correct');
    expect(res.newDifficulty).toBe('medium');
    expect(res.move).toBe('practice_problem');
  });

  it('suggests break after 10 minutes', () => {
    const state = { ...baseState, minutesOnConcept: 11 };
    const res = determineNextMove(state, false);
    expect(res.move).toBe('encourage');
    expect(res.specialInstruction).toContain('break');
  });

  it('handles interruptions', () => {
    const state = { ...baseState, interruptions: 2 };
    const res = determineNextMove(state, false);
    expect(res.move).toBe('socratic_question');
    expect(res.specialInstruction).toContain('differently');
  });

  it('gives worked example on low mastery + 2 hints', () => {
    const state = { ...baseState, mastery: 0.5, hintsUsed: 2 };
    const res = determineNextMove(state, false);
    expect(res.move).toBe('worked_example');
  });

  it('advances on high mastery', () => {
    const state = { ...baseState, mastery: 0.85 };
    const res = determineNextMove(state, false);
    expect(res.move).toBe('advance');
  });
});
