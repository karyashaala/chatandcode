import { expect, it } from "vite-plus/test";

import { resolveChatComposerCopy } from "@cctools/client-runtime/chat-composer-copy";

it("resolves chat copy from mode", () => {
  expect(resolveChatComposerCopy("chat")).toEqual({
    placeholder: "Ask anything…",
    heading: "What do you want to know?",
    subLine: "Search only. Nothing on your Mac is read or changed.",
  });
  expect(resolveChatComposerCopy("work")).toEqual({
    placeholder: "Describe the task…",
    heading: "What should we work on?",
    subLine: "All tools on your Mac, in the shared Chats folder.",
  });
});
