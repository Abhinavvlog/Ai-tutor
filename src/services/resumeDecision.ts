export type ResumeDecision = 'continue' | 'decline' | null;

export function getResumeDecision(message: string): ResumeDecision {
  const normalized = message
    .toLowerCase()
    .trim()
    .replace(/[,.!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/^(yes|yeah|yep|sure|okay|ok|haan|han|ha|bilkul|theek hai|chalo|continue|continue karo|aage chalo|please continue|yes please|yes continue|yeah continue|continue please|haan continue|haan continue karo|haan chalo|haan aage chalo|haan wahi se|haan wahin se|haan wahi se continue|haan wahin se continue)$/.test(normalized)) {
    return 'continue';
  }

  if (/^(no|nope|nah|nahi|nahin|not now|leave it|rehne do|baad mein|baad me)$/.test(normalized)) {
    return 'decline';
  }

  return null;
}
