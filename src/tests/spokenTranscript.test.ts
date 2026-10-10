import { describe, expect, it } from 'vitest';
import { appendSpokenTranscript, getUnplayedSegments } from '../services/spokenTranscript';

describe('spoken transcript alignment', () => {
  it('adds segments as they begin without duplicating a resumed sentence', () => {
    const started = appendSpokenTranscript('', 'First sentence.');
    expect(appendSpokenTranscript(started, 'First sentence.')).toBe('First sentence.');
    expect(appendSpokenTranscript(started, 'Second sentence.')).toBe('First sentence. Second sentence.');
  });

  it('returns the current sentence and all following unplayed segments', () => {
    expect(getUnplayedSegments(['Already said.', 'Interrupted sentence.', 'Next sentence.'], 1))
      .toEqual(['Interrupted sentence.', 'Next sentence.']);
  });

  it('handles an index beyond the response and ignores blank segments', () => {
    expect(getUnplayedSegments(['  ', 'Done.'], 2)).toEqual([]);
  });
});
