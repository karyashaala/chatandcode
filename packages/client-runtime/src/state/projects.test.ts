import { EnvironmentId, ProjectId } from "@cctools/contracts";
import { expect, it } from "vite-plus/test";

import { resolveChatsProjectKeys, splitSidebarThreads } from "./projects.ts";

it.each([
  {
    name: "missing config keeps all threads on Code",
    configs: [],
    expectedKeys: [],
    expectedChatIds: [],
    expectedCodeIds: ["local-first", "remote", "local-second"],
    preservesCodeArray: true,
  },
  {
    name: "normalized matching root classifies the Chats project",
    configs: [["environment-local", { chatsWorkspaceRoot: "/tmp/chats" }]],
    expectedKeys: ["environment-local:shared-project"],
    expectedChatIds: ["local-first", "local-second"],
    expectedCodeIds: ["remote"],
    preservesCodeArray: false,
  },
  {
    name: "identical project IDs remain scoped to their matching environment",
    configs: [
      ["environment-local", { chatsWorkspaceRoot: "/tmp/chats" }],
      ["environment-remote", { chatsWorkspaceRoot: "/other/chats" }],
    ],
    expectedKeys: ["environment-local:shared-project"],
    expectedChatIds: ["local-first", "local-second"],
    expectedCodeIds: ["remote"],
    preservesCodeArray: false,
  },
] as const)(
  "$name",
  ({ configs, expectedKeys, expectedChatIds, expectedCodeIds, preservesCodeArray }) => {
    const projects = ["environment-local", "environment-remote"].map((environmentId) => ({
      environmentId: EnvironmentId.make(environmentId),
      id: ProjectId.make("shared-project"),
      workspaceRoot: "/tmp/chats/",
    }));
    const threads = [
      { id: "local-first", environmentId: "environment-local", projectId: "shared-project" },
      { id: "remote", environmentId: "environment-remote", projectId: "shared-project" },
      { id: "local-second", environmentId: "environment-local", projectId: "shared-project" },
    ];
    const keys = resolveChatsProjectKeys(
      projects,
      new Map<string, { chatsWorkspaceRoot: string }>(configs),
    );
    const { chatThreads, codeThreads } = splitSidebarThreads(threads, keys);

    expect([...keys]).toEqual(expectedKeys);
    expect(chatThreads.map((thread) => thread.id)).toEqual(expectedChatIds);
    expect(codeThreads.map((thread) => thread.id)).toEqual(expectedCodeIds);
    if (preservesCodeArray) expect(codeThreads).toBe(threads);
  },
);
