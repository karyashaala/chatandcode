import type { ProviderDriverKind } from "@cctools/contracts";

import { runtimeModeConfig } from "./runtimeModeConfig";

/** Why Send is disabled in a chat, or null: Chat mode runs on Claude only. */
export function getChatModeSendBlockReason({
  chatSubMode,
  selectedDriver,
}: {
  chatSubMode: "chat" | "work";
  selectedDriver: ProviderDriverKind | null;
}) {
  return chatSubMode === "chat" && selectedDriver !== "claudeAgent"
    ? "Chat mode supports Claude only. Pick a Claude model, or switch to Work."
    : null;
}

/** The Access choices a Work chat offers. */
export const chatRuntimeModeOptions = (["approval-required", "full-access"] as const).map(
  (mode) => ({ mode, ...runtimeModeConfig[mode] }),
);
