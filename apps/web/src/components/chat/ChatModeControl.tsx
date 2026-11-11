import { ProviderDriverKind, type RuntimeMode } from "@cctools/contracts";
import { memo } from "react";

import { cn } from "~/lib/utils";
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "../ui/menu";
import { chatRuntimeModeOptions } from "./ChatComposer.logic";
import { ComposerControl } from "./ComposerControl";
import { useComposerMenuProps } from "./composerEventScope";
import { useComposerMenuState } from "./useComposerMenuState";

// Chat mode runs on Claude only; the model picker offers nothing else.
export const CHAT_MODE_DRIVER = ProviderDriverKind.make("claudeAgent");

/** A draft chat's Chat or Work choice, for the mode pill and the overflow menu. */
export function ChatSubModeMenuItems(props: {
  chatSubMode: "chat" | "work";
  onChatSubModeChange: (mode: "chat" | "work") => void;
}) {
  return (
    <>
      <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">Mode</div>
      <MenuRadioGroup
        value={props.chatSubMode}
        onValueChange={(value) => {
          if (value === "chat" || value === "work") props.onChatSubModeChange(value);
        }}
      >
        <MenuRadioItem value="chat">Chat (search only)</MenuRadioItem>
        <MenuRadioItem value="work">Work (all tools on your Mac)</MenuRadioItem>
      </MenuRadioGroup>
    </>
  );
}

/** Work's Access choices, for the overflow menu once the Access control hides. */
export function ChatAccessMenuItems(props: {
  runtimeMode: RuntimeMode;
  onRuntimeModeChange: (mode: RuntimeMode) => void;
}) {
  return (
    <>
      <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">Access</div>
      <MenuRadioGroup
        value={props.runtimeMode}
        onValueChange={(value) => {
          if (!value || value === props.runtimeMode) return;
          props.onRuntimeModeChange(value as RuntimeMode);
        }}
      >
        {chatRuntimeModeOptions.map((option) => (
          <MenuRadioItem key={option.mode} value={option.mode}>
            {option.label}
          </MenuRadioItem>
        ))}
      </MenuRadioGroup>
    </>
  );
}

/**
 * A chat's mode pill. A draft picks Chat or Work; a started chat's mode is
 * fixed, so the pill is a plain label. Work's Access is its own control.
 */
export const ChatModeControl = memo(function ChatModeControl(props: {
  chatSubMode: "chat" | "work";
  size: "sm" | "xs";
  hidden: boolean;
  onChatSubModeChange: ((mode: "chat" | "work") => void) | undefined;
}) {
  const composerFloatingLayerProps = useComposerMenuProps();
  const [open, setOpen] = useComposerMenuState(props.hidden);
  if (props.onChatSubModeChange === undefined) {
    return (
      <span
        className={cn(
          "px-2 font-medium text-sm",
          props.chatSubMode === "work" ? "text-warning" : "text-muted-foreground",
        )}
      >
        {props.chatSubMode === "work" ? "Work" : "Chat"}
      </span>
    );
  }
  return (
    <Menu open={open} onOpenChange={setOpen}>
      <MenuTrigger
        render={
          <ComposerControl
            size={props.size}
            aria-label={`Mode: ${props.chatSubMode === "work" ? "Work" : "Chat"}`}
            className={cn(
              "shrink-0 font-medium",
              props.chatSubMode === "work"
                ? "bg-warning/10 text-warning hover:bg-warning/15 hover:text-warning"
                : "bg-muted/50",
            )}
          />
        }
      >
        {props.chatSubMode === "work" ? "Work" : "Chat"}
      </MenuTrigger>
      <MenuPopup align="start" {...composerFloatingLayerProps}>
        <ChatSubModeMenuItems
          chatSubMode={props.chatSubMode}
          onChatSubModeChange={props.onChatSubModeChange}
        />
      </MenuPopup>
    </Menu>
  );
});
