import { resolveChatComposerCopy } from "@cctools/client-runtime/chat-composer-copy";
import { ProviderDriverKind } from "@cctools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { chatRuntimeModeOptions, getChatModeSendBlockReason } from "./ChatComposer.logic";

describe("resolveChatComposerCopy", () => {
  it("phrases the hero and placeholder for each mode", () => {
    expect(resolveChatComposerCopy("chat")).toEqual({
      heading: "What do you want to know?",
      subLine: "Search only. Nothing on your Mac is read or changed.",
      placeholder: "Ask anything…",
    });
    expect(resolveChatComposerCopy("work")).toEqual({
      heading: "What should we work on?",
      subLine: "All tools on your Mac, in the shared Chats folder.",
      placeholder: "Describe the task…",
    });
  });
});

describe("getChatModeSendBlockReason", () => {
  it("blocks only a non-Claude model in Chat mode", () => {
    const claude = ProviderDriverKind.make("claudeAgent");
    const codex = ProviderDriverKind.make("codex");
    expect(getChatModeSendBlockReason({ chatSubMode: "chat", selectedDriver: claude })).toBeNull();
    expect(getChatModeSendBlockReason({ chatSubMode: "chat", selectedDriver: codex })).toBe(
      "Chat mode supports Claude only. Pick a Claude model, or switch to Work.",
    );
    expect(getChatModeSendBlockReason({ chatSubMode: "work", selectedDriver: claude })).toBeNull();
    expect(getChatModeSendBlockReason({ chatSubMode: "work", selectedDriver: codex })).toBeNull();
  });
});

describe("chatRuntimeModeOptions", () => {
  it("offers Supervised and Full access", () => {
    expect(chatRuntimeModeOptions.map(({ mode, label }) => [mode, label])).toEqual([
      ["approval-required", "Supervised"],
      ["full-access", "Full access"],
    ]);
  });
});
