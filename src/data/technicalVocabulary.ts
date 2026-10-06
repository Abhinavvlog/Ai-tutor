/**
 * Canonical course vocabulary definitions and ASR variant mappings for MyGuru.
 * Single maintainable source of truth for technical terminology.
 */

export interface CourseTerm {
  canonical: string;
  aliases: string[];
  asrVariants: string[];
  category: 'data_structure' | 'operation' | 'concept' | 'component';
  /** Ambiguous variants that are also legitimate words in Hindi or colloquial speech */
  ambiguousHindiVariants?: string[];
}

export const TECHNICAL_VOCABULARY: CourseTerm[] = [
  {
    canonical: 'array',
    aliases: ['array', 'arrays'],
    asrVariants: ['arey', 'arry', 'ari', 'arrayy', 'ere', 'aree'],
    category: 'data_structure',
    ambiguousHindiVariants: ['arey'],
  },
  {
    canonical: 'queue',
    aliases: ['queue', 'queues'],
    asrVariants: ['q', 'cue', 'que', 'kyu', 'kyon', 'queuey', 'kew'],
    category: 'data_structure',
    ambiguousHindiVariants: ['kyon', 'kyu'],
  },
  {
    canonical: 'stack',
    aliases: ['stack', 'stacks'],
    asrVariants: ['stak', 'stake', 'stackk', 'steck'],
    category: 'data_structure',
  },
  {
    canonical: 'linked list',
    aliases: ['linked list', 'linked lists'],
    asrVariants: ['link list', 'linkedlist', 'linked lis', 'linkd list', 'linklist', 'link lists'],
    category: 'data_structure',
  },
  {
    canonical: 'singly linked list',
    aliases: ['singly linked list', 'singly linked lists'],
    asrVariants: ['single link list', 'single linked list', 'singly link list', 'single link lists'],
    category: 'data_structure',
  },
  {
    canonical: 'doubly linked list',
    aliases: ['doubly linked list', 'doubly linked lists'],
    asrVariants: ['double link list', 'double linked list', 'doubly link list', 'double link lists'],
    category: 'data_structure',
  },
  {
    canonical: 'FIFO',
    aliases: ['FIFO', 'fifo'],
    asrVariants: ['f i f o', 'fyfo', 'faifo', 'first in first out'],
    category: 'concept',
  },
  {
    canonical: 'LIFO',
    aliases: ['LIFO', 'lifo'],
    asrVariants: ['l i f o', 'lyfo', 'laifo', 'last in first out'],
    category: 'concept',
  },
  {
    canonical: 'node',
    aliases: ['node', 'nodes'],
    asrVariants: ['knowd', 'nod', 'noad', 'nodd'],
    category: 'component',
  },
  {
    canonical: 'pointer',
    aliases: ['pointer', 'pointers'],
    asrVariants: ['pointr', 'poynter', 'pointerr'],
    category: 'component',
  },
  {
    canonical: 'index',
    aliases: ['index'],
    asrVariants: ['indeks', 'indexs', 'indix', 'endex'],
    category: 'concept',
  },
  {
    canonical: 'indices',
    aliases: ['indices'],
    asrVariants: ['indises', 'indecies'],
    category: 'concept',
  },
  {
    canonical: 'enqueue',
    aliases: ['enqueue', 'enqueues', 'enqueued', 'enqueuing'],
    asrVariants: ['en cue', 'in queue', 'inqueue', 'n queue', 'nqueue', 'enq', 'encue'],
    category: 'operation',
  },
  {
    canonical: 'dequeue',
    aliases: ['dequeue', 'dequeues', 'dequeued', 'dequeuing'],
    asrVariants: ['de queue', 'd queue', 'dqueue', 'dequeuey', 'deq', 'decue'],
    category: 'operation',
  },
  {
    canonical: 'push',
    aliases: ['push', 'pushes', 'pushed', 'pushing'],
    asrVariants: ['poosh', 'pussh'],
    category: 'operation',
  },
  {
    canonical: 'pop',
    aliases: ['pop', 'pops', 'popped', 'popping'],
    asrVariants: ['popp', 'paap'],
    category: 'operation',
  },
  {
    canonical: 'peek',
    aliases: ['peek', 'peeks'],
    asrVariants: ['peke', 'peak'],
    category: 'operation',
  },
  {
    canonical: 'traverse',
    aliases: ['traverse', 'traverses', 'traversed', 'traversing'],
    asrVariants: ['travers', 'travurse'],
    category: 'operation',
  },
  {
    canonical: 'traversal',
    aliases: ['traversal', 'traversals'],
    asrVariants: ['traversel', 'treversal'],
    category: 'operation',
  },
  {
    canonical: 'element',
    aliases: ['element', 'elements'],
    asrVariants: ['eliment', 'elemnt', 'alimint'],
    category: 'concept',
  },
  {
    canonical: 'position',
    aliases: ['position', 'positions'],
    asrVariants: ['pozition', 'posishun'],
    category: 'concept',
  },
  {
    canonical: 'data structure',
    aliases: ['data structure'],
    asrVariants: ['data structur', 'datastructure'],
    category: 'concept',
  },
  {
    canonical: 'data structures',
    aliases: ['data structures'],
    asrVariants: ['data structurs', 'datastructures'],
    category: 'concept',
  },
  {
    canonical: 'time complexity',
    aliases: ['time complexity'],
    asrVariants: ['tym complexity', 'time complxity', 'timecomplexiti'],
    category: 'concept',
  },
  {
    canonical: 'space complexity',
    aliases: ['space complexity'],
    asrVariants: ['spas complexity', 'space complxity', 'spacecomplexiti'],
    category: 'concept',
  },
];

/**
 * Genuine Hindi words that must NEVER be modified or converted
 * into technical English unless strict context rules match.
 */
export const PROTECTED_HINDI_WORDS = new Set([
  'kya',
  'kyon',
  'kyu',
  'ka',
  'ki',
  'ke',
  'ko',
  'se',
  'me',
  'mein',
  'mai',
  'hai',
  'hain',
  'ho',
  'hota',
  'hoti',
  'hote',
  'kaise',
  'kab',
  'kahan',
  'kaha',
  'karte',
  'karta',
  'karti',
  'karna',
  'karo',
  'batao',
  'samjhao',
  'aur',
  'ya',
  'bhi',
  'to',
  'toh',
  'par',
  'pe',
  'ek',
  'do',
  'nahi',
  'nahin',
  'matlab',
  'use',
  'work',
  'chal',
  'raha',
  'rahi',
  'rahe',
  'bhai',
  'yaar',
  'sir',
  'mam',
  'bol',
  'aise',
  'jaise',
  'waisa',
  'isme',
  'usme',
  'jisme',
]);

/**
 * Hindi colloquial markers that confirm conversational Hindi rather than technical terms
 */
export const HINDI_COLLOQUIAL_MARKERS = new Set([
  'bhai',
  'yaar',
  're',
  'na',
  'arre',
  'arrey',
  'haan',
  'achha',
  'theek',
]);

/**
 * Co-occurring technical context indicators that strongly suggest
 * a computer science / data structures question.
 */
export const TECHNICAL_CONTEXT_INDICATORS = new Set([
  'difference',
  'differ',
  'diff',
  'antar',
  'tulna',
  'compare',
  'versus',
  'vs',
  'complexity',
  'operation',
  'operations',
  'element',
  'elements',
  'order',
  'first',
  'last',
  'index',
  'indices',
  'memory',
  'contiguous',
  'pointer',
  'node',
  'nodes',
  'insert',
  'delete',
  'insertion',
  'deletion',
  'structure',
  'structures',
  'fifo',
  'lifo',
  'add',
  'remove',
  'size',
  'length',
  'array',
  'arrays',
  'queue',
  'queues',
  'stack',
  'stacks',
  'list',
  'lists',
]);
