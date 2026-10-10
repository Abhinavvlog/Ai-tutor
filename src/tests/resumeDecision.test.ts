import { describe, expect, it } from 'vitest';
import { getResumeDecision } from '../services/resumeDecision';

describe('getResumeDecision', () => {
  it.each(['yes', 'haan', 'Haan, chalo!', 'okay', 'please continue', 'haan continue karo', 'haan wahi se continue'])(
    'recognizes a continue confirmation: %s',
    (message) => {
      expect(getResumeDecision(message)).toBe('continue');
    },
  );

  it.each(['no', 'nahi', 'not now', 'rehne do'])(
    'recognizes a decline confirmation: %s',
    (message) => {
      expect(getResumeDecision(message)).toBe('decline');
    },
  );

  it.each(['yes, but explain this first', 'why does a queue use FIFO?', ''])(
    'does not mistake a new question for a confirmation: %s',
    (message) => {
      expect(getResumeDecision(message)).toBeNull();
    },
  );
});
