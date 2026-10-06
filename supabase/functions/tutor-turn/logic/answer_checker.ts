// @ts-ignore: Deno npm specifier
import { evaluate } from 'npm:mathjs';

export type AnswerType = 'mcq' | 'numeric' | 'short';

export function checkNumeric(studentAnswer: string, correctAnswer: string): boolean {
  try {
    const studentVal = evaluate(studentAnswer);
    const correctVal = evaluate(correctAnswer);
    return Math.abs(studentVal - correctVal) <= 1e-6;
  } catch (e) {
    // If it can't be parsed, it's probably wrong (e.g. they typed words for a math question)
    return false;
  }
}

export function checkMcq(studentAnswer: string, correctAnswer: string): boolean {
  // exact match but case insensitive and trimmed
  return studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
}

// For short answers, we just define the interface and the edge function will call Gemini.
export type ShortAnswerResult = {
  verdict: 'correct' | 'partial' | 'wrong';
  misconception_tag: string | null;
};
