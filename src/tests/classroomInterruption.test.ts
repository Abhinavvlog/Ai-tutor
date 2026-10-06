import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isLikelyTeacherEcho } from '../services/speechRecognition';
import { useTutorStore } from '../store/tutorStore';

describe('Classroom Interruption & Echo Cancellation', () => {
  describe('isLikelyTeacherEcho', () => {
    const teacherSpokenText = 'An array stores elements at contiguous memory locations in memory.';

    it('never treats student interruption keywords as teacher echo', () => {
      expect(isLikelyTeacherEcho('wait why?', teacherSpokenText)).toBe(false);
      expect(isLikelyTeacherEcho('wait what is contiguous?', teacherSpokenText)).toBe(false);
      expect(isLikelyTeacherEcho('stop', teacherSpokenText)).toBe(false);
      expect(isLikelyTeacherEcho('hold on', teacherSpokenText)).toBe(false);
      expect(isLikelyTeacherEcho('kya matlab hai iska?', teacherSpokenText)).toBe(false);
      expect(isLikelyTeacherEcho('kyun use karte hain?', teacherSpokenText)).toBe(false);
      expect(isLikelyTeacherEcho('kaise store hota hai?', teacherSpokenText)).toBe(false);
      expect(isLikelyTeacherEcho('doubt hai sir', teacherSpokenText)).toBe(false);
      expect(isLikelyTeacherEcho('explain again', teacherSpokenText)).toBe(false);
    });

    it('identifies verbatim speaker feedback as echo', () => {
      // If speaker audio bleeds into mic verbatim:
      expect(isLikelyTeacherEcho('elements at contiguous memory', teacherSpokenText)).toBe(true);
      expect(isLikelyTeacherEcho('stores elements at contiguous', teacherSpokenText)).toBe(true);
      expect(isLikelyTeacherEcho('locations in memory', teacherSpokenText)).toBe(true);
    });

    it('allows genuine student questions that happen to share a word', () => {
      expect(isLikelyTeacherEcho('can memory be dynamic?', teacherSpokenText)).toBe(false);
      expect(isLikelyTeacherEcho('how many elements can it store?', teacherSpokenText)).toBe(false);
    });

    it('handles empty or missing parameters gracefully', () => {
      expect(isLikelyTeacherEcho('', teacherSpokenText)).toBe(false);
      expect(isLikelyTeacherEcho('wait why?', '')).toBe(false);
      expect(isLikelyTeacherEcho('', '')).toBe(false);
    });
  });

  describe('TutorStore Classroom Interruption State', () => {
    beforeEach(() => {
      useTutorStore.setState({
        sessionId: 'test-session',
        messages: [],
        isPlayingAudio: false,
        isListening: false,
        hasInterrupted: false,
        resumeTeaching: false,
        currentCaption: '',
        lessonProgress: {
          conceptId: '',
          step: 0,
          status: 'idle',
          lastSpokenSentence: '',
          completedSentences: [],
          interruptedSentence: null,
        },
      });
    });

    it('initializes lesson progress and enters teaching state on startLesson', async () => {
      const store = useTutorStore.getState();
      // Mock sendMessage so it doesn't trigger network calls
      const sendMock = vi.fn().mockResolvedValue(undefined);
      useTutorStore.setState({ sendMessage: sendMock });

      await store.startLesson('arrays');

      const state = useTutorStore.getState();
      expect(state.lessonProgress.conceptId).toBe('arrays_1');
      expect(state.lessonProgress.step).toBe(1);
      expect(state.lessonProgress.status).toBe('teaching');
      expect(state.hasInterrupted).toBe(false);
      expect(state.resumeTeaching).toBe(false);
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock).toHaveBeenCalledWith(
        '',
        'arrays_1',
        'voice',
        false,
        'lesson_start'
      );
    });

    it('immediately transitions to interrupted and sets resumeTeaching on interruptTutor', () => {
      useTutorStore.setState({
        isPlayingAudio: true,
        currentCaption: 'Arrays have continuous memory blocks.',
        lessonProgress: {
          conceptId: 'arrays',
          step: 1,
          status: 'teaching',
          lastSpokenSentence: 'Arrays have continuous memory blocks.',
          completedSentences: [],
          interruptedSentence: null,
        },
      });

      const store = useTutorStore.getState();
      store.interruptTutor();

      const state = useTutorStore.getState();
      expect(state.isPlayingAudio).toBe(false);
      expect(state.hasInterrupted).toBe(true);
      expect(state.resumeTeaching).toBe(true);
      expect(state.lessonProgress.status).toBe('interrupted');
      expect(state.lessonProgress.interruptedSentence).toBe('Arrays have continuous memory blocks.');
      expect(state.currentCaption).toBe('');
      expect(state.audioLevel).toBe(0);
    });
  });
});
