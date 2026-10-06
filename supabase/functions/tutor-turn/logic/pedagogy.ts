export type PedagogyState = {
  mastery: number;
  hintsUsed: number;
  correctStreak: number;
  interruptions: number;
  minutesOnConcept: number;
  hasMisconception: boolean;
  currentDifficulty: 'easy' | 'medium' | 'hard';
  prereqsCleared: boolean;
};

export type PedagogyAction = {
  move: 'explain' | 'example' | 'socratic_question' | 'hint_1' | 'hint_2' | 'hint_3' | 'worked_example' | 'practice_problem' | 'revisit_prerequisite' | 'retrieve_fact' | 'encourage' | 'advance';
  newDifficulty: 'easy' | 'medium' | 'hard';
  specialInstruction?: string;
};

export function determineNextMove(state: PedagogyState, isAnswerTurn: boolean, verdict?: 'correct' | 'partial' | 'wrong'): PedagogyAction {
  let newDifficulty = state.currentDifficulty;

  if (isAnswerTurn && verdict === 'correct') {
    if (state.correctStreak + 1 >= 3) {
      if (newDifficulty === 'easy') newDifficulty = 'medium';
      else if (newDifficulty === 'medium') newDifficulty = 'hard';
    }
  }

  // 1. Advance if mastery is high enough and prereqs are cleared (actually we check prereqs before advancing to next concept, but for this concept, we just emit advance)
  if (state.mastery >= 0.80 && state.prereqsCleared) {
    return { move: 'advance', newDifficulty };
  }

  // 2. Break suggestion
  if (state.minutesOnConcept > 10) {
    return { move: 'encourage', newDifficulty, specialInstruction: 'Suggest a short break to the student.' };
  }

  // 3. Interruption handling
  if (state.interruptions >= 2) {
    return { move: 'socratic_question', newDifficulty, specialInstruction: 'Ask "Would you like me to explain this differently?"' };
  }

  // 4. Low mastery + hints used
  if (state.mastery < 0.60 && state.hintsUsed >= 2) {
    return { move: 'worked_example', newDifficulty };
  }

  // 5. Misconception handling
  if (state.hasMisconception) {
    return { move: 'socratic_question', newDifficulty, specialInstruction: 'Add a contrast question to address the known misconception.' };
  }

  // 6. Normal answering flow
  if (isAnswerTurn) {
    if (verdict === 'correct') {
      return { move: 'practice_problem', newDifficulty };
    } else {
      if (state.hintsUsed === 0) return { move: 'hint_1', newDifficulty };
      if (state.hintsUsed === 1) return { move: 'hint_2', newDifficulty };
      return { move: 'hint_3', newDifficulty };
    }
  }

  // Default
  return { move: 'explain', newDifficulty };
}
