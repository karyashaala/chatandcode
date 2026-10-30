import type { ProviderOptionDescriptor } from "@cctools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  chatRuntimeModeChoices,
  runtimeModeChoicesForSupportedModes,
  selectableChoices,
} from "./thread-settings-options";

const effortDescriptor: Extract<ProviderOptionDescriptor, { type: "select" }> = {
  id: "effort",
  label: "Reasoning",
  type: "select",
  options: [
    { id: "low", label: "Low" },
    { id: "medium", label: "Medium", isDefault: true },
    { id: "high", label: "High" },
    { id: "ultrathink", label: "Ultrathink" },
    { id: "ultracode", label: "Ultracode" },
  ],
  currentValue: "high",
  promptInjectedValues: ["ultrathink"],
};

describe("selectableChoices", () => {
  it("hides prompt-injected and workflow-trigger choices, keeping declared order", () => {
    expect(selectableChoices(effortDescriptor).map((choice) => choice.id)).toEqual([
      "low",
      "medium",
      "high",
    ]);
  });
});

describe("runtimeModeChoicesForSupportedModes", () => {
  it("keeps controls usable when forward-compatible decoding removes every advertised mode", () => {
    expect(runtimeModeChoicesForSupportedModes([])).toHaveLength(4);
  });

  it("offers no choices to a Chat draft despite advertised modes", () => {
    expect(
      runtimeModeChoicesForSupportedModes(["approval-required", "full-access"], "chat"),
    ).toEqual([]);
  });

  it("offers a Work draft exactly Supervised and Full access despite an auto-only list", () => {
    expect(
      runtimeModeChoicesForSupportedModes(["auto"], "work").map(({ mode, label }) => ({
        mode,
        label,
      })),
    ).toEqual([
      { mode: "approval-required", label: "Supervised" },
      { mode: "full-access", label: "Full access" },
    ]);
  });
});

describe("chatRuntimeModeChoices", () => {
  it("offers exactly Supervised and Full access, in that order", () => {
    expect(chatRuntimeModeChoices.map((choice) => choice.mode)).toEqual([
      "approval-required",
      "full-access",
    ]);
    expect(chatRuntimeModeChoices.map((choice) => choice.label)).toEqual([
      "Supervised",
      "Full access",
    ]);
  });
});
