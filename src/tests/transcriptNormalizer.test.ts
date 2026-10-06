import { describe, it, expect } from 'vitest';
import { normalizeTranscript } from '../services/transcriptNormalizer';

describe('Transcript Normalizer for Hinglish Voice Input', () => {
  describe('1. Individual Technical Terms', () => {
    it('normalizes single-word technical terms', () => {
      expect(normalizeTranscript('array')).toBe('array');
      expect(normalizeTranscript('queue')).toBe('queue');
      expect(normalizeTranscript('stack')).toBe('stack');
      expect(normalizeTranscript('node')).toBe('node');
      expect(normalizeTranscript('index')).toBe('index');
      expect(normalizeTranscript('pointer')).toBe('pointer');
      expect(normalizeTranscript('enqueue')).toBe('enqueue');
      expect(normalizeTranscript('dequeue')).toBe('dequeue');
      expect(normalizeTranscript('push')).toBe('push');
      expect(normalizeTranscript('pop')).toBe('pop');
      expect(normalizeTranscript('peek')).toBe('peek');
      expect(normalizeTranscript('traverse')).toBe('traverse');
      expect(normalizeTranscript('traversal')).toBe('traversal');
      expect(normalizeTranscript('element')).toBe('element');
      expect(normalizeTranscript('position')).toBe('position');
      expect(normalizeTranscript('FIFO')).toBe('FIFO');
      expect(normalizeTranscript('LIFO')).toBe('LIFO');
    });

    it('handles phonetic ASR mis-transcriptions of isolated words', () => {
      expect(normalizeTranscript('q')).toBe('queue');
      expect(normalizeTranscript('cue')).toBe('queue');
      expect(normalizeTranscript('stak')).toBe('stack');
      expect(normalizeTranscript('knowd')).toBe('node');
      expect(normalizeTranscript('nod')).toBe('node');
      expect(normalizeTranscript('indeks')).toBe('index');
      expect(normalizeTranscript('inqueue')).toBe('enqueue');
      expect(normalizeTranscript('dqueue')).toBe('dequeue');
      expect(normalizeTranscript('fifo')).toBe('FIFO');
      expect(normalizeTranscript('lifo')).toBe('LIFO');
    });
  });

  describe('2. English Question Sentences', () => {
    it('normalizes standard English questions correctly', () => {
      expect(normalizeTranscript('What is an array?')).toBe('What is an array?');
      expect(normalizeTranscript('What is a queue?')).toBe('What is a queue?');
      expect(normalizeTranscript('What is a stack?')).toBe('What is a stack?');
      expect(normalizeTranscript('What is q?')).toBe('What is queue?');
      expect(normalizeTranscript('What is cue?')).toBe('What is queue?');
      expect(normalizeTranscript('Explain arey in data structures')).toBe('Explain array in data structures');
      expect(normalizeTranscript('What is a knowd?')).toBe('What is a node?');
    });
  });

  describe('3. Required Hinglish Technical Sentences', () => {
    it('handles "array aur queue mai kya difference hai?" from all ASR variants', () => {
      expect(normalizeTranscript('array aur queue mai kya difference hai?'))
        .toBe('array aur queue mai kya difference hai?');
      expect(normalizeTranscript('array aur q mai kya difference hai?'))
        .toBe('array aur queue mai kya difference hai?');
      expect(normalizeTranscript('array aur kyon mai kya difference hai?'))
        .toBe('array aur queue mai kya difference hai?');
      expect(normalizeTranscript('array aur kyu mai kya difference hai?'))
        .toBe('array aur queue mai kya difference hai?');
      expect(normalizeTranscript('array aur cue mai kya difference hai?'))
        .toBe('array aur queue mai kya difference hai?');
      expect(normalizeTranscript('arey aur queue mai kya difference hai?'))
        .toBe('array aur queue mai kya difference hai?');
    });

    it('handles "array mein element kaise add karte hain?"', () => {
      expect(normalizeTranscript('array mein element kaise add karte hain?'))
        .toBe('array mein element kaise add karte hain?');
      expect(normalizeTranscript('arey mein element kaise add karte hain?'))
        .toBe('array mein element kaise add karte hain?');
      expect(normalizeTranscript('array mai element kaise add karte hain?'))
        .toBe('array mai element kaise add karte hain?');
    });

    it('handles "stack ka use kab karte hain?"', () => {
      expect(normalizeTranscript('stack ka use kab karte hain?'))
        .toBe('stack ka use kab karte hain?');
      expect(normalizeTranscript('stak ka use kab karte hain?'))
        .toBe('stack ka use kab karte hain?');
    });

    it('handles "queue mein FIFO ka matlab kya hai?"', () => {
      expect(normalizeTranscript('queue mein FIFO ka matlab kya hai?'))
        .toBe('queue mein FIFO ka matlab kya hai?');
      expect(normalizeTranscript('queue mein fifo ka matlab kya hai?'))
        .toBe('queue mein FIFO ka matlab kya hai?');
      expect(normalizeTranscript('q mein fifo ka matlab kya hai?'))
        .toBe('queue mein FIFO ka matlab kya hai?');
      expect(normalizeTranscript('kyon mein FIFO ka matlab kya hai?'))
        .toBe('queue mein FIFO ka matlab kya hai?');
    });

    it('handles "linked list kaise work karti hai?"', () => {
      expect(normalizeTranscript('linked list kaise work karti hai?'))
        .toBe('linked list kaise work karti hai?');
      expect(normalizeTranscript('link list kaise work karti hai?'))
        .toBe('linked list kaise work karti hai?');
      expect(normalizeTranscript('linkedlist kaise work karti hai?'))
        .toBe('linked list kaise work karti hai?');
    });

    it('handles "node kya hota hai?"', () => {
      expect(normalizeTranscript('node kya hota hai?'))
        .toBe('node kya hota hai?');
      expect(normalizeTranscript('knowd kya hota hai?'))
        .toBe('node kya hota hai?');
    });

    it('handles "stack mein push aur pop kaise work karte hain?"', () => {
      expect(normalizeTranscript('stack mein push aur pop kaise work karte hain?'))
        .toBe('stack mein push aur pop kaise work karte hain?');
      expect(normalizeTranscript('stak mein poosh aur popp kaise work karte hain?'))
        .toBe('stack mein push aur pop kaise work karte hain?');
    });
  });

  describe('4. Protection of Ordinary Hindi Words (NO Over-Correction)', () => {
    it('preserves genuine Hindi "kyon" (meaning "why")', () => {
      expect(normalizeTranscript('kyon hota hai?')).toBe('kyon hota hai?');
      expect(normalizeTranscript('stack ka use kyon karte hain?')).toBe('stack ka use kyon karte hain?');
      expect(normalizeTranscript('aap kyon bol rahe hain?')).toBe('aap kyon bol rahe hain?');
      expect(normalizeTranscript('array me aisa kyon hota hai')).toBe('array me aisa kyon hota hai');
    });

    it('preserves general Hindi question queries', () => {
      expect(normalizeTranscript('kya hota hai?')).toBe('kya hota hai?');
      expect(normalizeTranscript('kaise karte hain?')).toBe('kaise karte hain?');
      expect(normalizeTranscript('kab use karte hain?')).toBe('kab use karte hain?');
      expect(normalizeTranscript('kya hum ye kar sakte hain?')).toBe('kya hum ye kar sakte hain?');
      expect(normalizeTranscript('isse kya fayda hai?')).toBe('isse kya fayda hai?');
    });

    it('preserves Hindi colloquial expressions with "arey"', () => {
      expect(normalizeTranscript('arey bhai kya haal hai')).toBe('arey bhai kya haal hai');
      expect(normalizeTranscript('arey yaar aisa mat karo')).toBe('arey yaar aisa mat karo');
      expect(normalizeTranscript('arey re ye kya hua')).toBe('arey re ye kya hua');
    });

    it('preserves Hindi words that sound similar to English words', () => {
      expect(normalizeTranscript('kyon nahi chal raha')).toBe('kyon nahi chal raha');
      expect(normalizeTranscript('kaise pata chalega')).toBe('kaise pata chalega');
    });
  });

  describe('5. Multi-Word Technical Terms & Compounds', () => {
    it('normalizes Singly Linked List and Doubly Linked List', () => {
      expect(normalizeTranscript('single link list kya hai')).toBe('singly linked list kya hai');
      expect(normalizeTranscript('singly link list')).toBe('singly linked list');
      expect(normalizeTranscript('double link list kya hota hai')).toBe('doubly linked list kya hota hai');
      expect(normalizeTranscript('doubly linked list aur singly linked list'))
        .toBe('doubly linked list aur singly linked list');
    });

    it('normalizes Enqueue and Dequeue multi-word speech artifacts', () => {
      expect(normalizeTranscript('en cue operation in queue')).toBe('enqueue operation enqueue');
      expect(normalizeTranscript('de queue operation')).toBe('dequeue operation');
      expect(normalizeTranscript('d queue aur inqueue')).toBe('dequeue aur enqueue');
    });

    it('normalizes spaced acronyms (F I F O, L I F O)', () => {
      expect(normalizeTranscript('f i f o aur l i f o')).toBe('FIFO aur LIFO');
      expect(normalizeTranscript('fifo and lifo')).toBe('FIFO and LIFO');
      expect(normalizeTranscript('fyfo and lyfo')).toBe('FIFO and LIFO');
    });

    it('normalizes Data Structure and Complexity phrases', () => {
      expect(normalizeTranscript('data structur kya hota hai')).toBe('data structure kya hota hai');
      expect(normalizeTranscript('array ka time complxity kya hai')).toBe('array ka time complexity kya hai');
      expect(normalizeTranscript('stack ka space complxity')).toBe('stack ka space complexity');
      expect(normalizeTranscript('tym complexity aur spas complexity'))
        .toBe('time complexity aur space complexity');
    });
  });

  describe('6. Punctuation, Casing & Formatting', () => {
    it('preserves punctuation marks (e.g. ?, !, ., commas)', () => {
      expect(normalizeTranscript('array aur queue mai kya difference hai?'))
        .toBe('array aur queue mai kya difference hai?');
      expect(normalizeTranscript('What is a node?!')).toBe('What is a node?!');
      expect(normalizeTranscript('stack, queue, and array.')).toBe('stack, queue, and array.');
    });

    it('collapses unnecessary whitespace cleanly', () => {
      expect(normalizeTranscript('   array    aur    queue    ')).toBe('array aur queue');
      expect(normalizeTranscript('')).toBe('');
      expect(normalizeTranscript('   ')).toBe('');
    });
  });
});
