/**
 * Voice Manager for MyGuru
 * Handles deterministic voice selection and preloading for English, Hindi, and Hinglish.
 */

import type { ContentLanguage } from './languageDetector';

let cachedVoices: SpeechSynthesisVoice[] = [];

export function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices && voices.length > 0) {
    cachedVoices = voices;
  }
  return cachedVoices;
}

// Pre-populate voices and listen for updates
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    loadVoices();
  };
}

export function getBestVoiceForLanguage(lang: ContentLanguage): { voice?: SpeechSynthesisVoice; locale: string } {
  const voices = loadVoices();

  const getVoiceByPriority = (priorities: string[], fallbackLang: string) => {
    for (const priority of priorities) {
      const match = voices.find(v => v.name.includes(priority) || v.voiceURI.includes(priority));
      if (match) return { voice: match, locale: match.lang };
    }
    // Fallback to first voice matching the language code
    const fallback = voices.find(v => v.lang.startsWith(fallbackLang));
    return { voice: fallback, locale: fallback ? fallback.lang : fallbackLang };
  };

  if (lang === 'en') {
    // English Teacher: Natural, clear English female voice
    const enPriorities = [
      'Google US English',
      'Google UK English Female',
      'Microsoft Jenny Online (Natural)',
      'Microsoft Aria Online (Natural)',
      'Samantha',
      'Microsoft Zira'
    ];
    return getVoiceByPriority(enPriorities, 'en-US');
  }

  if (lang === 'hi') {
    // Pure Hindi Teacher: Authentic Hindi voice
    const hiPriorities = [
      'Google हिन्दी',
      'Kalpana',
      'Swara',
      'Madhur',
      'Microsoft Hemant',
      'Microsoft Swara',
      'Neerja',
      'Heera',
      'Ravi'
    ];
    return getVoiceByPriority(hiPriorities, 'hi-IN');
  }

  // Hinglish Teacher: Indian English / Multilingual voice capable of natural code-switching
  const hinglishPriorities = [
    'Google English (India)',
    'Microsoft Neerja Online (Natural)',
    'Neerja',
    'Heera',
    'Ravi',
    'Google हिन्दी',
    'Kalpana',
    'Swara'
  ];
  return getVoiceByPriority(hinglishPriorities, 'en-IN');
}