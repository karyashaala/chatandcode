/**
 * Picks the thread after `currentKey` (wrapping) among threads `rank` scores, sorted by
 * tier then display order; the first one when the current thread needs nothing; `null`
 * when nothing else qualifies. Ships to mobile: no ES2023 array methods (Hermes).
 */
export function resolveNextNeedsYouKey<T>(input: {
  readonly threads: readonly T[];
  readonly currentKey: string | null;
  readonly keyOf: (thread: T) => string;
  readonly rank: (thread: T) => number | null;
}): string | null {
  const candidates: { key: string; tier: number; position: number }[] = [];
  input.threads.forEach((thread, position) => {
    const tier = input.rank(thread);
    if (tier !== null) candidates.push({ key: input.keyOf(thread), tier, position });
  });
  candidates.sort((left, right) => left.tier - right.tier || left.position - right.position);
  const currentIndex = candidates.findIndex((candidate) => candidate.key === input.currentKey);
  if (currentIndex === -1) return candidates[0]?.key ?? null;
  if (candidates.length === 1) return null;
  return candidates[(currentIndex + 1) % candidates.length]?.key ?? null;
}
