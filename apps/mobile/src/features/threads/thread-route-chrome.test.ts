import { describe, expect, it } from "vite-plus/test";

import { resolveThreadRouteChrome } from "./thread-route-chrome";

describe("resolveThreadRouteChrome", () => {
  it("hides git, inspector, terminal and the project subtitle for a chat", () => {
    expect(resolveThreadRouteChrome({ isChatThread: true })).toEqual({
      showGitActions: false,
      showInspector: false,
      showTerminal: false,
      showProjectSubtitle: false,
    });
  });

  it("hides nothing for a code thread", () => {
    expect(resolveThreadRouteChrome({ isChatThread: false })).toEqual({
      showGitActions: true,
      showInspector: true,
      showTerminal: true,
      showProjectSubtitle: true,
    });
  });
});
