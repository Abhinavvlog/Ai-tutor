/**
 * Robust technical vocabulary normalizer for SpeechRecognition transcripts in MyGuru.
 * Corrects acoustic & phonetic ASR mis-transcriptions of course technical vocabulary
 * while safely preserving genuine Hindi words (kyon, kya, ka, mai, mein, hai, kaise, etc.).
 *
 * Runs locally, deterministically, and instantaneously (0 network/Gemini calls).
 */

import {
  TECHNICAL_VOCABULARY,
  PROTECTED_HINDI_WORDS,
  HINDI_COLLOQUIAL_MARKERS,
  TECHNICAL_CONTEXT_INDICATORS,
} from '../data/technicalVocabulary';

/**
 * Fast Levenshtein distance calculation between two lowercased strings.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

/**
 * Pre-compiled lookup maps for high performance.
 */
const EXACT_ASR_MAP = new Map<string, string>();
const MULTI_WORD_VARIANTS: { pattern: RegExp; replacement: string }[] = [];

// Initialize multi-word replacements & exact alias mappings
for (const term of TECHNICAL_VOCABULARY) {
  // If the canonical term itself is multi-word, prepare regex
  for (const variant of term.asrVariants) {
    if (variant.includes(' ')) {
      // Multi-word phrase variant
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      MULTI_WORD_VARIANTS.push({
        pattern: new RegExp(`\\b${escaped}\\b`, 'gi'),
        replacement: term.canonical,
      });
    } else {
      // Single-word variant
      if (!term.ambiguousHindiVariants?.includes(variant.toLowerCase())) {
        EXACT_ASR_MAP.set(variant.toLowerCase(), term.canonical);
      }
    }
  }

  // Also map aliases
  for (const alias of term.aliases) {
    if (alias.includes(' ')) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      MULTI_WORD_VARIANTS.push({
        pattern: new RegExp(`\\b${escaped}\\b`, 'gi'),
        replacement: term.canonical,
      });
    }
  }
}

/**
 * Main normalization function.
 * Transforms raw speech recognition transcripts into normalized text with correct technical terms.
 */
export function normalizeTranscript(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw.trim();
  if (!text) return '';

  // ----------------------------------------------------
  // Stage 1: Specific Multi-Word Compounds & Acronyms
  // ----------------------------------------------------
  // Acronyms: FIFO & LIFO
  text = text.replace(/\b(?:f\s*i\s*f\s*o|fi\s*fo|fyfo|faifo)\b/gi, 'FIFO');
  text = text.replace(/\bfifo\b/gi, 'FIFO');
  text = text.replace(/\b(?:l\s*i\s*f\s*o|li\s*fo|lyfo|laifo)\b/gi, 'LIFO');
  text = text.replace(/\blifo\b/gi, 'LIFO');

  // Multi-word data structures
  text = text.replace(/\b(?:singly|single)\s+link(?:ed)?\s+lists?\b/gi, 'singly linked list');
  text = text.replace(/\b(?:doubly|double)\s+link(?:ed)?\s+lists?\b/gi, 'doubly linked list');
  text = text.replace(/\b(?:link\s*list|linkedlist|linkd\s+list|linked\s+lis)\b/gi, 'linked list');

  // Operations: Enqueue & Dequeue
  text = text.replace(/\b(?:inqueue|en\s+queue|nqueue|n\s+queue|in\s+queue)\b/gi, 'enqueue');
  text = text.replace(/\b(?:dqueue|de\s+queue|d\s+queue)\b/gi, 'dequeue');

  // Concepts: Data structure & complexities
  text = text.replace(/\b(?:data\s+structurs|datastructures)\b/gi, 'data structures');
  text = text.replace(/\b(?:data\s+structur|datastructure)\b/gi, 'data structure');
  text = text.replace(/\b(?:tym\s+complexity|time\s+complxity|timecomplexity)\b/gi, 'time complexity');
  text = text.replace(/\b(?:spas\s+complexity|space\s+complxity|spacecomplexity)\b/gi, 'space complexity');

  // Apply general multi-word table
  for (const { pattern, replacement } of MULTI_WORD_VARIANTS) {
    text = text.replace(pattern, replacement);
  }

  // ----------------------------------------------------
  // Stage 2: Context Assessment
  // ----------------------------------------------------
  const lowerText = text.toLowerCase();
  const tokens = lowerText.split(/\s+/).map((t) => t.replace(/^[^\w]+|[^\w]+$/g, ''));

  // Detect technical context indicators
  let technicalSignalCount = 0;
  for (const t of tokens) {
    if (TECHNICAL_CONTEXT_INDICATORS.has(t)) {
      technicalSignalCount++;
    }
  }

  // Detect Hindi colloquial markers (e.g. "arey bhai", "arey yaar")
  const hasColloquialMarker = tokens.some((t) => HINDI_COLLOQUIAL_MARKERS.has(t));

  // Data structure keywords for coordinate patterns
  const dsGroup = '(?:array|arrays|queue|queues|stack|stacks|linked\\s+list|singly\\s+linked\\s+list|doubly\\s+linked\\s+list)';
  const conjGroup = '(?:aur|and|or|vs|versus|tatha|ya)';

  // ----------------------------------------------------
  // Stage 3: Contextual Normalization for Ambiguous Words
  // ----------------------------------------------------

  // Rule 3A: Standalone words with optional punctuation (e.g. "q?", "arey?", "cue.")
  text = text.replace(/^([^\w]*)(?:q|cue|que)([^\w]*)$/i, '$1queue$2');
  text = text.replace(/^([^\w]*)arey([^\w]*)$/i, '$1array$2');
  text = text.replace(/^([^\w]*)stak([^\w]*)$/i, '$1stack$2');

  // Rule 3B: Explicit Question Openers ("What is an arey?", "What is a q?", "Explain cue")
  text = text.replace(/\b(what\s+is|what's|define|explain|tell\s+me\s+about)\s+(?:an?\s+)?(?:q|cue|que)\b/gi, '$1 queue');
  text = text.replace(/\b(what\s+is|what's|define|explain|tell\s+me\s+about)\s+(?:an?\s+)?arey\b/gi, '$1 array');
  text = text.replace(/\b(what\s+is|what's|define|explain|tell\s+me\s+about)\s+(?:an?\s+)?(?:kyon|kyu)\b/gi, '$1 queue');

  // Rule 3C: "kyon" / "kyu" / "q" / "cue" -> "queue"
  // In Hindi grammar, interrogative "why" (kyon) CANNOT take genitive postpositions (ka, ki, ke)
  // Phrases like "kyon ka use", "kyon ka matlab", "kyon kya hota hai" are unambiguous ASR errors for "queue".
  text = text.replace(/\b(?:q|cue|que|kyon|kyu)\s+(ka\s+(?:use|kya\s+use|kahan\s+use|kab\s+use|matlab)|ke\s+(?:use|operations?|elements?)|ki\s+(?:complexity|size))\b/gi, 'queue $1');
  text = text.replace(/\b(?:q|cue|que|kyon|kyu)\s+(kya\s+hota\s+hai|kya\s+hai|kise\s+kehte\s+hain|kaise\s+work\s+karta\s+hai|kaise\s+kaam\s+karta\s+hai)\b/gi, 'queue $1');
  text = text.replace(/\b(?:q|cue|que)\s+(mein|me|mai|ka|ke|ki|se|ko|pe|par)\b/gi, 'queue $1');
  text = text.replace(/\b(?:kyon|kyu)\s+(mein|me|mai)\s+(FIFO|LIFO|enqueue|dequeue|element|elements|front|rear)\b/gi, 'queue $1 $2');
  text = text.replace(/\b(?:q|cue|que|kyon|kyu)\s+(data\s+structure|operations?|implementation)\b/gi, 'queue $1');
  text = text.replace(/\b(priority|circular|double\s*ended)\s+(?:kyon|kyu|q|cue|que)\b/gi, '$1 queue');

  // Coordinated data structure pairs ("array aur kyon", "kyon aur stack", "q aur array")
  const postCoordQueue = new RegExp(`(\\b${dsGroup}\\s+${conjGroup}\\s+)(?:kyon|kyu|q|cue|que)\\b`, 'gi');
  text = text.replace(postCoordQueue, '$1queue');
  const preCoordQueue = new RegExp(`\\b(?:kyon|kyu|q|cue|que)(\\s+${conjGroup}\\s+${dsGroup}\\b)`, 'gi');
  text = text.replace(preCoordQueue, 'queue$1');

  // Comparison context: "array ... kyon ... difference/antar"
  if (
    /\b(?:array|stack|linked\s+list)\b/i.test(text) &&
    /\b(?:difference|antar|compare|vs|versus)\b/i.test(text)
  ) {
    text = text.replace(/\b(?:kyon|kyu)\b/gi, 'queue');
  }

  // Rule 3D: "arey" -> "array"
  // "arey" is often Hindi colloquial ("arey yaar", "arey bhai"). Only normalize to "array" in technical/pedagogical context.
  if (!hasColloquialMarker) {
    text = text.replace(/\barey\s+(ka\s+(?:use|kya\s+use|kahan\s+use|kab\s+use|matlab|index|size)|ke\s+(?:elements?|items?)|ki\s+(?:length|size|complexity))\b/gi, 'array $1');
    text = text.replace(/\barey\s+(kya\s+hai|kya\s+hota\s+hai|kise\s+kehte\s+hain|kaise\s+work\s+karta\s+hai|kaise\s+kaam\s+karta\s+hai)\b/gi, 'array $1');
    text = text.replace(new RegExp(`(\\b${dsGroup}\\s+${conjGroup}\\s+)arey\\b`, 'gi'), '$1array');
    text = text.replace(new RegExp(`\\barey(\\s+${conjGroup}\\s+${dsGroup}\\b)`, 'gi'), 'array$1');
    text = text.replace(/\barey\s+(mein|me|mai)\s+(element|elements|index|indices|data|size|item|items)\b/gi, 'array $1 $2');
    text = text.replace(/\barey\s+(mein|me|mai)\b/gi, 'array $1');
    text = text.replace(/\barey\s+(?:element|index|indices|traversal|size)\b/gi, 'array element');
  }

  // ----------------------------------------------------
  // Stage 4: Word-by-Word Exact & Fuzzy Matching
  // ----------------------------------------------------
  // Split preserving words and punctuation
  const wordTokens = text.split(/(\s+)/);
  const normalizedWords = wordTokens.map((token) => {
    // If whitespace, return as is
    if (/^\s+$/.test(token)) return token;

    // Extract leading punctuation, raw word, trailing punctuation
    const match = token.match(/^([^\w]*)([\w'-]+)([^\w]*)$/);
    if (!match) return token;

    const [, leadingPunct, word, trailingPunct] = match;
    const lowerWord = word.toLowerCase();

    // 1. NEVER modify genuine protected Hindi words
    if (PROTECTED_HINDI_WORDS.has(lowerWord)) {
      return token;
    }

    // 2. Exact match in ASR dictionary
    if (EXACT_ASR_MAP.has(lowerWord)) {
      const canonical = EXACT_ASR_MAP.get(lowerWord)!;
      // Preserve uppercase if original word was uppercase
      const formatted = word === word.toUpperCase() && canonical.length <= 4
        ? canonical.toUpperCase()
        : canonical;
      return `${leadingPunct}${formatted}${trailingPunct}`;
    }

    // 3. Fuzzy similarity for single technical words (length >= 4)
    // Avoid short words (<=3 chars) to avoid false positives with Hindi/English grammar
    if (lowerWord.length >= 4) {
      for (const term of TECHNICAL_VOCABULARY) {
        // Only evaluate single-word canonical terms
        if (term.canonical.includes(' ')) continue;

        const target = term.canonical.toLowerCase();
        const dist = levenshteinDistance(lowerWord, target);

        // Distance threshold: <= 1 for 4-5 chars, <= 2 for 6+ chars
        const maxDist = target.length >= 6 ? 2 : 1;
        if (dist <= maxDist) {
          const sim = 1 - dist / Math.max(lowerWord.length, target.length);
          // High confidence threshold (>= 0.80)
          if (sim >= 0.8) {
            const formatted = term.canonical === 'FIFO' || term.canonical === 'LIFO'
              ? term.canonical
              : term.canonical.toLowerCase();
            return `${leadingPunct}${formatted}${trailingPunct}`;
          }
        }
      }
    }

    // Fallback: return token unmodified
    return token;
  });

  let result = normalizedWords.join('');

  // ----------------------------------------------------
  // Stage 5: Final Polish & Whitespace Cleanup
  // ----------------------------------------------------
  result = result.replace(/\s{2,}/g, ' ').trim();

  return result;
}
