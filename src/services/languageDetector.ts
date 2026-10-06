/**
 * Deterministic Language and Script Classifier for MyGuru TTS
 * Accurately identifies English, pure Hindi (Devanagari), and Hinglish (Code-switched).
 */

export type ContentLanguage = 'en' | 'hi' | 'hinglish';

const HINGLISH_MARKERS = new Set([
  'hai', 'hain', 'mein', 'kya', 'kyun', 'kyu', 'kaise', 'hota', 'hoti', 'hote',
  'karte', 'karta', 'karti', 'karein', 'samjho', 'samjhao', 'dekhte', 'dekho',
  'chalo', 'aaj', 'ek', 'aur', 'ka', 'ki', 'ke', 'ko', 'se', 'par', 'bhi', 'toh',
  'agar', 'wala', 'wali', 'wale', 'raha', 'rahi', 'rahe', 'tha', 'thi', 'the',
  'baare', 'bilkul', 'pehle', 'aakhri', 'karo', 'lekin', 'kyunki', 'iska', 'iski',
  'iske', 'uske', 'inka', 'unka', 'hum', 'aap', 'tum', 'yeh', 'woh', 'yahan',
  'wahan', 'kahan', 'sirf', 'saath', 'andar', 'baahar', 'madad', 'batao', 'samajh',
  'ruko', 'suno', 'padhenge', 'seekhenge', 'tarah', 'karke', 'bhi'
]);

export function detectContentLanguage(text: string): ContentLanguage {
  if (!text || !text.trim()) return 'en';

  const trimmed = text.trim();

  // 1. Check for Devanagari script characters
  const hasDevanagari = /[\u0900-\u097F]/.test(trimmed);
  if (hasDevanagari) {
    const hasLatinWords = /[a-zA-Z]{2,}/.test(trimmed);
    if (hasLatinWords) {
      return 'hinglish';
    }
    return 'hi';
  }

  // 2. Tokenize Latin words
  const words = trimmed
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (words.length === 0) return 'en';

  let markerCount = 0;
  for (const word of words) {
    if (HINGLISH_MARKERS.has(word)) {
      markerCount++;
    }
  }

  const markerRatio = markerCount / words.length;

  // If there are at least 2 Hinglish markers or a high proportion of markers, classify as Hinglish
  if (markerCount >= 2 || (words.length >= 3 && markerRatio >= 0.12)) {
    return 'hinglish';
  }

  return 'en';
}

export function cleanTextForSpeech(raw: string): string {
  if (!raw) return '';

  return raw
    // Remove markdown code blocks and backticks
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    // Remove LaTeX math formatting ($...$ and $$...$$)
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$([^$]+)\$/g, '$1')
    // Convert array indices like [0], [1] to "index 0", "index 1" for spoken clarity
    .replace(/\[(\d+)\]/g, ' index $1 ')
    // Clean markdown headings, bullets, quotes, bold, italics
    .replace(/[#*~>]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Replace technical course IDs (e.g. arrays_1 -> arrays)
    .replace(/_1\b/g, '')
    .replace(/_2\b/g, ' part 2')
    .replace(/_/g, ' ')
    // Normalize punctuation & whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
