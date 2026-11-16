import type { RuntimeMode } from "@cctools/contracts";
import { memo, type ReactNode, useRef } from "react";
import { EllipsisIcon } from "lucide-react";
import { Menu, MenuPopup, MenuTrigger } from "../ui/menu";
import { ComposerControl, ComposerControlIcon } from "./ComposerControl";
import { focusRequestedPermission, useComposerMenuProps } from "./composerEventScope";
import { useComposerMenuState } from "./useComposerMenuState";
import { ComposerPermissionsSection, type RuntimeModeOption } from "./ComposerFooterControls";

export const CompactComposerControlsMenu = memo(function CompactComposerControlsMenu(props: {
  runtimeMode: RuntimeMode;
  runtimeModeOptions: ReadonlyArray<RuntimeModeOption>;
  showPermissions: boolean;
  /**
   * Set in a chat: replaces the code Access choices with the chat's own mode
   * items, or with nothing when null.
   */
  chatModeMenuContent?: ReactNode;
  size?: "sm" | "xs";
  /** Close the portaled popup when its trigger hides. */
  hidden?: boolean;
  onRuntimeModeChange: (mode: RuntimeMode) => void;
}) {
  const composerFloatingLayerProps = useComposerMenuProps();
  const size = props.size ?? "sm";
  const [open, setOpen] = useComposerMenuState(props.hidden);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const accessSection =
    props.chatModeMenuContent !== undefined ? (
      props.chatModeMenuContent
    ) : props.showPermissions ? (
      <ComposerPermissionsSection
        runtimeMode={props.runtimeMode}
        runtimeModeOptions={props.runtimeModeOptions}
        onRuntimeModeChange={props.onRuntimeModeChange}
      />
    ) : null;

  return (
    <Menu
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(isOpen) => focusRequestedPermission(isOpen, triggerRef.current)}
    >
      <MenuTrigger
        render={
          <ComposerControl
            ref={triggerRef}
            size={size}
            className="shrink-0"
            aria-label="More composer controls"
            data-composer-shortcut={props.showPermissions ? "composer.mode" : undefined}
          />
        }
      >
        <ComposerControlIcon icon={EllipsisIcon} size={size} />
      </MenuTrigger>
      <MenuPopup align="start" {...composerFloatingLayerProps}>
        {accessSection}
      </MenuPopup>
    </Menu>
  );
});
