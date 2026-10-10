export type TutorResponseLanguage = 'en' | 'hi' | 'hinglish';

const HINGLISH_MARKERS = new Set([
  'aap', 'accha', 'aur', 'batao', 'hai', 'hain', 'ka', 'kaise', 'karna',
  'karo', 'ke', 'ki', 'kyun', 'kyu', 'kya', 'matlab', 'mein', 'mera',
  'mujhe', 'nahi', 'samjhao', 'se', 'theek', 'tum',
]);

export function resolveResponseLanguage(
  preferredLanguage: string,
  message: string,
): TutorResponseLanguage {
  if (preferredLanguage === 'hinglish') return 'hinglish';

  const hasDevanagari = /[\u0900-\u097f]/.test(message);
  const hasLatin = /[a-z]/i.test(message);
  if (hasDevanagari) return hasLatin ? 'hinglish' : 'hi';

  const words = message.toLowerCase().match(/[a-z]+/g) ?? [];
  if (words.some((word) => HINGLISH_MARKERS.has(word))) return 'hinglish';

  return preferredLanguage === 'hi' ? 'hi' : 'en';
}
