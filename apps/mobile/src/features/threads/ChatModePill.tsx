import type { MenuAction } from "@react-native-menu/menu";
import type { RuntimeMode } from "@cctools/contracts";
import { useMemo } from "react";

import { ComposerInlineControl } from "../../components/ComposerToolbar";
import { ControlPillMenu } from "../../components/ControlPill";
import { chatRuntimeModeChoices, RUNTIME_MODE_CHOICES } from "./thread-settings-options";

/** A new chat's mode menu: Chat or Work, and in Work the Access it runs with. */
export function ChatModePill(props: {
  readonly mode: "chat" | "work";
  readonly runtimeMode: RuntimeMode;
  readonly disabled: boolean;
  readonly onModeChange: (mode: "chat" | "work") => void;
  readonly onRuntimeModeChange: (mode: RuntimeMode) => void;
}) {
  const pillLabel = props.mode === "work" ? "Work" : "Chat";
  const actions = useMemo<MenuAction[]>(
    () => [
      {
        id: "chat",
        title: "Chat",
        subtitle: "Search only",
        state: props.mode === "chat" ? "on" : "off",
        attributes: { disabled: props.disabled },
      },
      {
        id: "work",
        title: "Work",
        subtitle: "All tools on your Mac",
        state: props.mode === "work" ? "on" : "off",
        attributes: { disabled: props.disabled },
      },
      ...(props.mode === "work"
        ? [
            {
              id: "access",
              title: `Access · ${RUNTIME_MODE_CHOICES.find((choice) => choice.mode === props.runtimeMode)?.label ?? props.runtimeMode}`,
              attributes: { disabled: props.disabled },
              subactions: chatRuntimeModeChoices.map((choice): MenuAction => ({
                id: choice.mode,
                title: choice.label,
                subtitle: choice.description,
                state: choice.mode === props.runtimeMode ? "on" : "off",
                attributes: { disabled: props.disabled },
              })),
            },
          ]
        : []),
    ],
    [props.disabled, props.mode, props.runtimeMode],
  );
  return (
    <ControlPillMenu
      title="Mode"
      actions={actions}
      onPressAction={({ nativeEvent }) => {
        if (props.disabled) return;
        if (nativeEvent.event === "chat" || nativeEvent.event === "work") {
          props.onModeChange(nativeEvent.event);
          return;
        }
        const choice = chatRuntimeModeChoices.find(
          (candidate) => candidate.mode === nativeEvent.event,
        );
        if (props.mode === "work" && choice) props.onRuntimeModeChange(choice.mode);
      }}
    >
      <ComposerInlineControl
        accessibilityLabel={`Mode: ${pillLabel}`}
        disabled={props.disabled}
        label={pillLabel}
      />
    </ControlPillMenu>
  );
}
