import { describe, it, expect } from 'vitest';
import { updateMastery } from '../../supabase/functions/tutor-turn/logic/bkt';

describe('BKT updateMastery', () => {
  it('increases mastery on correct answer', () => {
    const newMastery = updateMastery(0.3, true);
    expect(newMastery).toBeGreaterThan(0.3);
  });

  it('decreases mastery on wrong answer', () => {
    const newMastery = updateMastery(0.5, false);
    expect(newMastery).toBeLessThan(0.5);
  });

  it('clamps to max 0.99', () => {
    let m = 0.98;
    for(let i = 0; i < 10; i++) {
      m = updateMastery(m, true);
    }
    expect(m).toBe(0.99);
  });

  // removed clamps to min 0.01 test because BKT formula asymptotes to > p_learn (0.15)


  it('calculates expected value for standard step', () => {
    // pL=0.3, pG=0.2, pS=0.1, pT=0.15
    // pObs(correct) = 0.3*0.9 + 0.7*0.2 = 0.27 + 0.14 = 0.41
    // pL_given_obs = (0.3*0.9)/0.41 = 0.27/0.41 = 0.6585
    // newMastery = 0.6585 + (1-0.6585)*0.15 = 0.6585 + 0.3415*0.15 = 0.6585 + 0.051225 = 0.7097
    const m = updateMastery(0.3, true);
    expect(m).toBeCloseTo(0.7097, 3);
  });

  it('converges gracefully on multiple consecutive incorrect answers', () => {
    let m = 0.8;
    for (let i = 0; i < 5; i++) {
      m = updateMastery(m, false);
    }
    // With p_learn = 0.15, mastery decreases and stabilizes without dropping below 0.01
    expect(m).toBeLessThan(0.3);
    expect(m).toBeGreaterThanOrEqual(0.01);
  });
});
