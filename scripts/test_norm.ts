export function normalizeTranscript(raw: string): string {
  if (!raw) return '';
  let text = raw.trim();

  // 1. Acronyms & common compound terms
  text = text.replace(/\b(?:f\s*i\s*f\s*o|fi\s*fo|faifo)\b/gi, 'FIFO');
  text = text.replace(/\bfifo\b/gi, 'FIFO');
  text = text.replace(/\b(?:l\s*i\s*f\s*o|li\s*fo|laifo)\b/gi, 'LIFO');
  text = text.replace(/\blifo\b/gi, 'LIFO');

  // 2. Linked list variants
  text = text.replace(/\b(?:singly|single)\s+link(?:ed)?\s+lists?\b/gi, 'singly linked list');
  text = text.replace(/\b(?:doubly|double)\s+link(?:ed)?\s+lists?\b/gi, 'doubly linked list');
  text = text.replace(/\b(?:link\s*list|linkedlist)\b/gi, 'linked list');

  // 3. Enqueue / Dequeue
  text = text.replace(/\b(?:inqueue|en\s+queue|nqueue|n\s+queue)\b/gi, 'enqueue');
  text = text.replace(/\b(?:dqueue|de\s+queue|d\s+queue)\b/gi, 'dequeue');

  // 4. Queue contextual normalization
  // Data structure keywords
  const dsWords = '(?:array|arrays|stack|stacks|linked\\s+list|singly\\s+linked\\s+list|doubly\\s+linked\\s+list)';
  const conjWords = '(?:aur|and|or|vs|versus|tatha|ya)';

  // Pattern A: (array|stack|linked list) aur/and/vs (q|cue|que|kyon|kyu)
  // e.g. "array aur q", "array aur kyon", "array and cue"
  const postCoord = new RegExp(`(\\b${dsWords}\\s+${conjWords}\\s+)(?:q|cue|que|kyon|kyu)\\b`, 'gi');
  text = text.replace(postCoord, '$1queue');

  // Pattern B: (q|cue|que|kyon|kyu) aur/and/vs (array|stack|linked list)
  // e.g. "q aur stack", "kyon aur array", "cue and stack"
  const preCoord = new RegExp(`\\b(?:q|cue|que|kyon|kyu)(\\s+${conjWords}\\s+${dsWords}\\b)`, 'gi');
  text = text.replace(preCoord, 'queue$1');

  // Pattern C: q/cue/que followed by postposition (mein/me/mai/ka/ke/ki/se/ko)
  // e.g. "q mein FIFO", "q mai kya"
  text = text.replace(/\b(?:q|cue|que)\s+(mein|me|mai|ka|ke|ki|se|ko|pe|par)\b/gi, 'queue $1');

  // Pattern D: kyon/kyu followed by mein/me/mai AND FIFO
  // e.g. "kyon mein FIFO ka matlab" -> "queue mein FIFO ka matlab"
  text = text.replace(/\b(?:kyon|kyu)\s+(mein|me|mai)\s+FIFO\b/gi, 'queue $1 FIFO');

  // Pattern E: q/cue/que with data structure / operations / implementation
  text = text.replace(/\b(?:q|cue|que)\s+(data\s*structure|operation|operations|implementation)\b/gi, 'queue $1');
  text = text.replace(/\b(priority|circular|double\s*ended)\s+(?:q|cue|que|kyon|kyu)\b/gi, '$1 queue');

  // Pattern F: Standalone q / cue / que as isolated question
  text = text.replace(/^(?:q|cue|que)$/i, 'queue');
  text = text.replace(/\b(what\s+is|explain|define)\s+(?:q|cue|que)\b/gi, '$1 queue');
  text = text.replace(/\b(?:q|cue|que)\s+(kya\s+hai|kya\s+hota\s+hai|kise\s+kehte\s+hain)\b/gi, 'queue $1');

  // 5. Array typos
  text = text.replace(/\barey\s+(aur|and|or|vs)\s+(?:queue|stack|linked\s+list)\b/gi, 'array $1 $2');

  return text;
}

const testCases = [
  { in: 'queue', expected: 'queue' },
  { in: 'q', expected: 'queue' },
  { in: 'array', expected: 'array' },
  { in: 'stack', expected: 'stack' },
  { in: 'linked list', expected: 'linked list' },
  { in: 'link list', expected: 'linked list' },
  { in: 'array aur queue mai kya difference hai?', expected: 'array aur queue mai kya difference hai?' },
  { in: 'array aur q mai kya difference hai?', expected: 'array aur queue mai kya difference hai?' },
  { in: 'array aur kyon mai kya difference hai?', expected: 'array aur queue mai kya difference hai?' },
  { in: 'stack ka use kab karte hain?', expected: 'stack ka use kab karte hain?' },
  { in: 'stack ka use kyon karte hain?', expected: 'stack ka use kyon karte hain?' },
  { in: 'queue mein FIFO ka matlab kya hai?', expected: 'queue mein FIFO ka matlab kya hai?' },
  { in: 'q mein fifo ka matlab kya hai?', expected: 'queue mein FIFO ka matlab kya hai?' },
  { in: 'linked list kaise work karti hai?', expected: 'linked list kaise work karti hai?' },
  { in: 'link list kaise work karti hai?', expected: 'linked list kaise work karti hai?' },
  { in: 'q aur stack me kya antar hai', expected: 'queue aur stack me kya antar hai' },
  { in: 'aap kyon padha rahe hain', expected: 'aap kyon padha rahe hain' }
];

let failed = 0;
testCases.forEach((t, i) => {
  const out = normalizeTranscript(t.in);
  const pass = out.toLowerCase() === t.expected.toLowerCase();
  if (!pass) failed++;
  console.log((pass ? 'PASS ' : 'FAIL ') + i + ': "' + t.in + '" => "' + out + '" (expected: "' + t.expected + '")');
});

if (failed === 0) {
  console.log('\nALL 17 TESTS PASSED!');
} else {
  console.log(`\n${failed} TESTS FAILED`);
}
