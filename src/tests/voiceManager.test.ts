import { describe, it, expect, beforeEach } from 'vitest';
import { getBestVoiceForLanguage } from '../services/voiceManager';

describe('VoiceManager deterministic routing', () => {
  const mockVoices = [
    { name: 'Microsoft Zira Desktop - English (United States)', lang: 'en-US' } as SpeechSynthesisVoice,
    { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' } as SpeechSynthesisVoice,
    { name: 'Microsoft Jenny Online (Natural) - English (United States)', lang: 'en-US' } as SpeechSynthesisVoice,
    { name: 'Google हिन्दी', lang: 'hi-IN' } as SpeechSynthesisVoice,
    { name: 'Microsoft Kalpana - Hindi (India)', lang: 'hi-IN' } as SpeechSynthesisVoice,
    { name: 'Microsoft Swara Online (Natural) - Hindi (India)', lang: 'hi-IN' } as SpeechSynthesisVoice,
    { name: 'Microsoft Neerja Online (Natural) - English (India)', lang: 'en-IN' } as SpeechSynthesisVoice,
    { name: 'Microsoft Heera - English (India)', lang: 'en-IN' } as SpeechSynthesisVoice,
  ];

  beforeEach(() => {
    (globalThis as any).window = {
      speechSynthesis: {
        getVoices: () => mockVoices,
        onvoiceschanged: null,
      },
    };
  });

  it('selects natural English female voice for English mode', () => {
    const { voice, locale } = getBestVoiceForLanguage('en');
    expect(voice).toBeDefined();
    expect(locale).toBe('en-US');
    expect(voice?.name).toContain('Jenny');
  });

  it('selects native Hindi voice for Pure Hindi mode', () => {
    const { voice, locale } = getBestVoiceForLanguage('hi');
    expect(voice).toBeDefined();
    expect(locale).toBe('hi-IN');
    expect(voice?.name.includes('हिन्दी') || voice?.name.includes('Kalpana') || voice?.name.includes('Swara')).toBe(true);
  });

  it('selects Indian multilingual voice for Hinglish mode', () => {
    const { voice, locale } = getBestVoiceForLanguage('hinglish');
    expect(voice).toBeDefined();
    expect(locale).toBe('en-IN');
    expect(voice?.name).toContain('Neerja');
  });
});
