import {
  getPromptControlledTraits,
  getTraitSelectChange,
} from "@cctools/client-runtime/model-traits";
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
  // regression: #21406 bring model controls in line with web
  it("leaves out prompt-injected choices and keeps workflow choices in declared order", () => {
    expect(selectableChoices(effortDescriptor).map((choice) => choice.id)).toEqual([
      "low",
      "medium",
      "high",
      "ultracode",
    ]);
  });
});

describe("prompt-controlled reasoning", () => {
  it("removes the prefix when choosing a regular effort and saves Ultracode as an option", () => {
    const descriptors = [effortDescriptor];
    const prompt = "Ultrathink:\nsolve it";
    expect(
      getTraitSelectChange(
        { ...getPromptControlledTraits(descriptors, prompt), descriptors },
        effortDescriptor,
        prompt,
        "ultracode",
      ),
    ).toEqual({ prompt: "solve it", modelOptions: [{ id: "effort", value: "ultracode" }] });
  });

  it("keeps body-controlled Ultrathink locked", () => {
    const descriptors = [effortDescriptor];
    const prompt = "please ultrathink about this";
    const selected = { ...getPromptControlledTraits(descriptors, prompt), descriptors };
    expect(selected.ultrathinkInBodyText).toBe(true);
    expect(getTraitSelectChange(selected, effortDescriptor, prompt, "low")).toBeNull();
  });
});

describe("runtimeModeChoicesForSupportedModes", () => {
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
