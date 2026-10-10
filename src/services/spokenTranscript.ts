export function appendSpokenTranscript(current: string, next: string): string {
  const trimmed = next.trim();
  if (!trimmed || current.trimEnd().endsWith(trimmed)) return current;
  return `${current}${current && !/\s$/.test(current) ? ' ' : ''}${trimmed}`;
}

export function getUnplayedSegments(segments: string[], nextIndex: number): string[] {
  return segments
    .slice(Math.max(0, nextIndex))
    .filter((segment) => Boolean(segment?.trim()));
}
