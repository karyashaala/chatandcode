import { resolveThreadStatusPill, type ThreadStatusPill } from "./Sidebar.logic";

/** Tier 0 is blocked on you; tier 1 is finished work you have not seen. */
const NEEDS_YOU_TIER_BY_LABEL: Partial<Record<ThreadStatusPill["label"], number>> = {
  "Pending Approval": 0,
  "Awaiting Input": 0,
  "Guest Request": 0,
  Failed: 1,
  "Plan Ready": 1,
  Completed: 1,
};

/**
 * Ranks a sidebar thread for `thread.nextNeedsYou` from the same status pill its row
 * shows, so the command always goes where a pill says to go. Pass the row's resolved
 * `lastVisitedAt`. Returns `null` for threads that need nothing from you.
 */
export function sidebarNeedsYouRank(
  thread: Parameters<typeof resolveThreadStatusPill>[0]["thread"],
): number | null {
  const label = resolveThreadStatusPill({ thread })?.label;
  return label === undefined ? null : (NEEDS_YOU_TIER_BY_LABEL[label] ?? null);
}
