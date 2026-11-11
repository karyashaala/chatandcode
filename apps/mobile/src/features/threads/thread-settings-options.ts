import type { RuntimeMode } from "@cctools/contracts";

export const RUNTIME_MODE_CHOICES: ReadonlyArray<{
  readonly mode: RuntimeMode;
  readonly label: string;
  readonly description: string;
}> = [
  {
    mode: "approval-required",
    label: "Supervised",
    description: "Ask before commands and file changes.",
  },
  {
    mode: "auto-accept-edits",
    label: "Auto-accept edits",
    description: "Auto-approve edits, ask before other actions.",
  },
  {
    mode: "auto",
    label: "Auto",
    description: "Supported providers approve routine actions; others still ask.",
  },
  {
    mode: "full-access",
    label: "Full access",
    description: "Allow commands and edits without prompts.",
  },
];

/** A Work chat's Access choices: Supervised and Full access only. */
export const chatRuntimeModeChoices = RUNTIME_MODE_CHOICES.filter(
  (choice) => choice.mode === "approval-required" || choice.mode === "full-access",
);

/**
 * Runtime choices for a model's supported modes (all four when none are advertised).
 * A chat's sub-mode overrides them: Chat offers none, Work offers Supervised and Full access.
 */
export function runtimeModeChoicesForSupportedModes(
  supportedRuntimeModes: ReadonlyArray<RuntimeMode> | undefined,
  chatSubMode?: "chat" | "work",
) {
  if (chatSubMode) {
    return chatSubMode === "chat" ? [] : chatRuntimeModeChoices;
  }
  return supportedRuntimeModes && supportedRuntimeModes.length > 0
    ? RUNTIME_MODE_CHOICES.filter((choice) => supportedRuntimeModes.includes(choice.mode))
    : RUNTIME_MODE_CHOICES;
}

export function compatibleRuntimeModeForChoices(
  runtimeMode: RuntimeMode,
  choices: ReadonlyArray<{ readonly mode: RuntimeMode }>,
): RuntimeMode {
  return choices.some((choice) => choice.mode === runtimeMode)
    ? runtimeMode
    : (choices[0]?.mode ?? runtimeMode);
}

export { selectableProviderOptionChoices as selectableChoices } from "@cctools/client-runtime/model-traits";
