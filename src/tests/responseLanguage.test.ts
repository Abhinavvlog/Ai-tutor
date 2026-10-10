import { describe, expect, it } from 'vitest';
import { resolveResponseLanguage } from '../../supabase/functions/tutor-turn/logic/responseLanguage';

describe('resolveResponseLanguage', () => {
  it('keeps the learner-selected Hinglish response language', () => {
    expect(resolveResponseLanguage('hinglish', 'Explain a queue')).toBe('hinglish');
  });

  it('responds in Hinglish when an English-configured learner asks in Hinglish', () => {
    expect(resolveResponseLanguage('en', 'Queue ka use kya hai?')).toBe('hinglish');
  });

  it('recognizes Hindi written in Devanagari', () => {
    expect(resolveResponseLanguage('en', 'क्यू का उपयोग क्या है?')).toBe('hi');
  });

  it('recognizes mixed Hindi and Latin-script terms as Hinglish', () => {
    expect(resolveResponseLanguage('en', 'Queue का use क्या है?')).toBe('hinglish');
  });

  it('preserves English for English messages', () => {
    expect(resolveResponseLanguage('en', 'How does a queue work?')).toBe('en');
  });

  it('respects a Hindi preference for English-language messages', () => {
    expect(resolveResponseLanguage('hi', 'How does a queue work?')).toBe('hi');
  });
});
