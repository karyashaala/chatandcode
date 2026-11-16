import { ProviderInstanceId } from "@cctools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { sidebarNeedsYouRank } from "./Sidebar.needsYou";

const runtime = {
  status: "completed" as const,
  providerName: "Codex",
  providerInstanceId: ProviderInstanceId.make("codex"),
  activeRunId: null,
  lastError: null,
  updatedAt: "2026-03-09T10:00:00.000Z",
};
const finishedRun = {
  runId: "turn-1" as never,
  status: "completed" as const,
  assistantMessageId: null,
  requestedAt: "2026-03-09T10:00:00.000Z",
  startedAt: "2026-03-09T10:00:00.000Z",
  completedAt: "2026-03-09T10:05:00.000Z",
};
const idle = {
  hasActionableProposedPlan: false,
  hasPendingApprovals: false,
  hasPendingUserInput: false,
  interactionMode: "default" as const,
  latestRun: null,
  lastVisitedAt: "2026-03-09T10:04:00.000Z",
  runtime,
};

describe("sidebarNeedsYouRank", () => {
  it.each([
    ["pending approval", { ...idle, hasPendingApprovals: true }, 0],
    ["awaiting input", { ...idle, hasPendingUserInput: true }, 0],
    ["guest request", { ...idle, pendingGuestMessageCount: 1 }, 0],
    ["unseen failure", { ...idle, latestRun: { ...finishedRun, status: "failed" as const } }, 1],
    [
      "plan ready",
      {
        ...idle,
        interactionMode: "plan" as const,
        hasActionableProposedPlan: true,
        latestRun: finishedRun,
      },
      1,
    ],
    ["unseen completion", { ...idle, latestRun: finishedRun }, 1],
    ["working", { ...idle, runtime: { ...runtime, status: "running" as const } }, null],
    [
      "waiting on a thread",
      { ...idle, runtime: { ...runtime, status: "running" as const }, blockedOnThreadWait: true },
      null,
    ],
    [
      "seen completion",
      { ...idle, latestRun: finishedRun, lastVisitedAt: "2026-03-09T10:06:00.000Z" },
      null,
    ],
  ])("%s", (_name, thread, tier) => {
    expect(sidebarNeedsYouRank(thread)).toBe(tier);
  });
});
