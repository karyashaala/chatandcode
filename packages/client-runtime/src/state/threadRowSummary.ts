import type { EnvironmentThreadShell } from "./models.ts";

import { isThreadWorking } from "./threadInbox.ts";

export function resolveChatRowSummary(
  thread: EnvironmentThreadShell,
  _options: { now: string },
): { kind: "input" | "working" | "activity" | "messages"; text: string } | null {
  if (thread.hasPendingApprovals || thread.hasPendingUserInput) {
    return { kind: "input", text: "Input needed" };
  }
  if (isThreadWorking(thread)) {
    return { kind: "working", text: "Working" };
  }

  const counts = thread.activityCounts;
  if (counts.commands > 0) {
    return {
      kind: "activity",
      text: `Ran ${counts.commands} ${counts.commands === 1 ? "command" : "commands"}`,
    };
  }
  if (counts.fileChanges > 0) {
    return {
      kind: "activity",
      text: `Edited ${counts.fileChanges} ${counts.fileChanges === 1 ? "file" : "files"}`,
    };
  }
  if (counts.searches > 0) {
    return {
      kind: "activity",
      text: `Searched ${counts.searches} ${counts.searches === 1 ? "source" : "sources"}`,
    };
  }
  if (counts.otherTools > 0) {
    return {
      kind: "activity",
      text: `Used ${counts.otherTools} ${counts.otherTools === 1 ? "tool" : "tools"}`,
    };
  }
  if (counts.messages > 0) {
    return {
      kind: "messages",
      text: `${counts.messages} ${counts.messages === 1 ? "message" : "messages"}`,
    };
  }

  return null;
}
