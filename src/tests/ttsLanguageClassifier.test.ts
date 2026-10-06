import { describe, it, expect } from 'vitest';
import { detectContentLanguage, cleanTextForSpeech } from '../services/languageDetector';

describe('Deterministic Language & Script Classifier for TTS', () => {
  describe('detectContentLanguage', () => {
    it('accurately identifies pure English educational text', () => {
      const texts = [
        'An array is a linear data structure that stores elements in contiguous memory locations.',
        'What is the time complexity of accessing an element in an array by its index?',
        'A queue follows the First-In, First-Out (FIFO) principle for enqueue and dequeue operations.',
        'Let us look at how pointers connect nodes in a singly linked list.',
        'Great job! That is completely correct.',
      ];

      for (const text of texts) {
        expect(detectContentLanguage(text)).toBe('en');
      }
    });

    it('accurately identifies pure Hindi text in Devanagari script', () => {
      const texts = [
        'नमस्ते, आज हम कंप्यूटर साइंस के बारे में सीखेंगे।',
        'यह एक बहुत महत्वपूर्ण विषय है।',
        'क्या आप जानते हैं कि इसका उपयोग कहाँ होता है?',
      ];

      for (const text of texts) {
        expect(detectContentLanguage(text)).toBe('hi');
      }
    });

    it('accurately identifies natural Indian Hinglish text with technical terms', () => {
      const texts = [
        'Chalo, aaj arrays ke baare mein dekhte hain!',
        'Ek Array ek aisi data structure hai jo multiple items ko ek hi single name ke andar store karne mein help karti hai.',
        'Array mein hum elements ko index ke through access karte hain.',
        'Queue mein FIFO ka matlab kya hota hai?',
        'Stack mein push aur pop operations kaise work karte hain?',
        'Batao, agar ek array mein 5 elements hain, toh aakhri element ka index kya hoga?',
        'Node kya hota hai aur pointer isko kaise point karta hai?',
        'Mujhe samajh nahi aaya, ek example se samjhao.',
      ];

      for (const text of texts) {
        expect(detectContentLanguage(text)).toBe('hinglish');
      }
    });

    it('handles mixed Devanagari with English technical words as Hinglish', () => {
      expect(detectContentLanguage('Array में elements contiguous memory में store होते हैं।')).toBe('hinglish');
    });

    it('handles edge cases and empty text gracefully', () => {
      expect(detectContentLanguage('')).toBe('en');
      expect(detectContentLanguage('   ')).toBe('en');
      expect(detectContentLanguage('Array')).toBe('en');
      expect(detectContentLanguage('FIFO')).toBe('en');
    });
  });

  describe('cleanTextForSpeech', () => {
    it('removes raw database identifiers like arrays_1', () => {
      const cleaned = cleanTextForSpeech('Chalo, aaj arrays_1 ke baare mein dekhte hain!');
      expect(cleaned).not.toContain('_1');
      expect(cleaned).not.toContain('_');
      expect(cleaned).toContain('arrays');
    });

    it('cleans markdown formatting, code backticks, and math symbols', () => {
      const input = 'Here is `$O(1)$` access time: `arr[0]` and **important** note.';
      const cleaned = cleanTextForSpeech(input);
      expect(cleaned).not.toContain('`');
      expect(cleaned).not.toContain('$');
      expect(cleaned).not.toContain('**');
      expect(cleaned).toContain('O(1)');
      expect(cleaned).toContain('arr index 0');
      expect(cleaned).toContain('important');
    });
  });
});
