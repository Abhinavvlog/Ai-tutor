export const BKT_PARAMS = {
  p_init: 0.30,
  p_learn: 0.15,
  p_guess: 0.20,
  p_slip: 0.10,
};

export function updateMastery(
  currentMastery: number,
  isCorrect: boolean
): number {
  const pL = currentMastery;
  const pG = BKT_PARAMS.p_guess;
  const pS = BKT_PARAMS.p_slip;
  const pT = BKT_PARAMS.p_learn;

  let pL_given_obs = 0;
  if (isCorrect) {
    const pObs = pL * (1 - pS) + (1 - pL) * pG;
    pL_given_obs = pObs === 0 ? 0 : (pL * (1 - pS)) / pObs;
  } else {
    const pObs = pL * pS + (1 - pL) * (1 - pG);
    pL_given_obs = pObs === 0 ? 0 : (pL * pS) / pObs;
  }

  const newMastery = pL_given_obs + (1 - pL_given_obs) * pT;
  return Math.min(Math.max(newMastery, 0.01), 0.99); // clamp to prevent locking
}
