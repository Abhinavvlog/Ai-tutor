import { describe, it, expect } from 'vitest';
import { checkNumeric, checkMcq } from '../../supabase/functions/tutor-turn/logic/answer_checker';

describe('Answer Checker', () => {
  it('checks numeric answers with tolerance', () => {
    expect(checkNumeric('1008', '1008')).toBe(true);
    expect(checkNumeric('1008.0000001', '1008')).toBe(true);
    expect(checkNumeric('1009', '1008')).toBe(false);
  });

  it('evaluates math expressions', () => {
    expect(checkNumeric('1000 + 8', '1008')).toBe(true);
    expect(checkNumeric('2 * 504', '1008')).toBe(true);
  });

  it('fails safely on unparseable math', () => {
    expect(checkNumeric('I dont know', '1008')).toBe(false);
  });

  it('checks MCQ exactly but case insensitive', () => {
    expect(checkMcq(' True ', 'True')).toBe(true);
    expect(checkMcq('false', 'False')).toBe(true);
    expect(checkMcq('O(1)', 'O(1)')).toBe(true);
    expect(checkMcq('O(N)', 'O(1)')).toBe(false);
  });

  it('handles negative numbers and fractions in numeric checks', () => {
    expect(checkNumeric('-5 + 3', '-2')).toBe(true);
    expect(checkNumeric('1/2', '0.5')).toBe(true);
    expect(checkNumeric('3 * (4 + 2)', '18')).toBe(true);
    expect(checkNumeric('-10', '-10')).toBe(true);
    expect(checkNumeric('-10', '10')).toBe(false);
  });
});
