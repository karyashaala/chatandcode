import { EnvironmentId } from "@cctools/contracts";
import { expect, it } from "vite-plus/test";

import { presentThreadShell, type EnvironmentThreadShell } from "./models.ts";
import { v2ThreadShell } from "./orchestrationV2TestFixtures.ts";
import { resolveChatRowSummary } from "./threadRowSummary.ts";

const now = "2026-10-11T12:00:00.000Z";
const zeros = { commands: 0, fileChanges: 0, searches: 0, otherTools: 0, messages: 0 };
const thread = presentThreadShell(EnvironmentId.make("environment-1"), v2ThreadShell);
const resolve = (overrides: Partial<EnvironmentThreadShell> = {}) =>
  resolveChatRowSummary({ ...thread, ...overrides }, { now });
const runtime = {
  status: "running" as const,
  activeRunId: null,
  providerInstanceId: thread.providerInstanceId,
  providerName: "Codex",
  lastError: null,
  updatedAt: now,
};

it("prioritizes both input flags over working and counts", () => {
  for (const flag of ["hasPendingApprovals", "hasPendingUserInput"] as const) {
    expect(resolve({ [flag]: true, runtime, activityCounts: { ...zeros, commands: 2 } })).toEqual({
      kind: "input",
      text: "Input needed",
    });
  }
});

it("prioritizes working over counts", () => {
  expect(resolve({ runtime, activityCounts: { ...zeros, commands: 2, messages: 3 } })).toEqual({
    kind: "working",
    text: "Working",
  });
});

it("resolves all four tool buckets in priority order with singular and plural wording", () => {
  expect(
    resolve({
      activityCounts: { commands: 1, fileChanges: 2, searches: 3, otherTools: 4, messages: 5 },
    }),
  ).toEqual({ kind: "activity", text: "Ran 1 command" });
  expect(resolve({ activityCounts: { ...zeros, commands: 7 } })).toEqual({
    kind: "activity",
    text: "Ran 7 commands",
  });
  expect(
    resolve({
      activityCounts: { ...zeros, fileChanges: 1, searches: 3, otherTools: 4, messages: 5 },
    }),
  ).toEqual({ kind: "activity", text: "Edited 1 file" });
  expect(resolve({ activityCounts: { ...zeros, fileChanges: 2 } })).toEqual({
    kind: "activity",
    text: "Edited 2 files",
  });
  expect(
    resolve({ activityCounts: { ...zeros, searches: 1, otherTools: 4, messages: 5 } }),
  ).toEqual({ kind: "activity", text: "Searched 1 source" });
  expect(resolve({ activityCounts: { ...zeros, searches: 3 } })).toEqual({
    kind: "activity",
    text: "Searched 3 sources",
  });
  expect(resolve({ activityCounts: { ...zeros, otherTools: 1, messages: 5 } })).toEqual({
    kind: "activity",
    text: "Used 1 tool",
  });
  expect(resolve({ activityCounts: { ...zeros, otherTools: 2 } })).toEqual({
    kind: "activity",
    text: "Used 2 tools",
  });
});

it("resolves singular and plural messages and returns null for zero counts", () => {
  expect(resolve({ activityCounts: { ...zeros, messages: 1 } })).toEqual({
    kind: "messages",
    text: "1 message",
  });
  expect(resolve({ activityCounts: { ...zeros, messages: 12 } })).toEqual({
    kind: "messages",
    text: "12 messages",
  });
  expect(resolve({ activityCounts: zeros })).toBeNull();
});
