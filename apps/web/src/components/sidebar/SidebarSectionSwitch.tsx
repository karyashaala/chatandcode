import { memo } from "react";

import type { SidebarSectionSummary } from "../Sidebar.logic";
import type { SidebarSide } from "../../uiStateStore";
import { cn } from "../../lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

type SideHalf = {
  side: SidebarSide;
  label: string;
  summary: SidebarSectionSummary;
  shortcutLabel: string | null;
};

/**
 * The sidebar shows chats or code threads, never both. Each half carries the
 * number of live rows behind it; the half you are not looking at raises a dot
 * when something over there is working or unread, so switching away never
 * means going deaf.
 */
export const SidebarSectionSwitch = memo(function SidebarSectionSwitch({
  side,
  chat,
  code,
  chatShortcutLabel,
  codeShortcutLabel,
  onSelect,
}: {
  side: SidebarSide;
  chat: SidebarSectionSummary;
  code: SidebarSectionSummary;
  chatShortcutLabel: string | null;
  codeShortcutLabel: string | null;
  onSelect: (side: SidebarSide) => void;
}) {
  const halves: SideHalf[] = [
    { side: "chat", label: "Chat", summary: chat, shortcutLabel: chatShortcutLabel },
    { side: "code", label: "Code", summary: code, shortcutLabel: codeShortcutLabel },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Sidebar list"
      data-testid="sidebar-section-switch"
      className="flex items-center gap-0.5 rounded-lg bg-sidebar-control-surface p-0.5"
    >
      {halves.map((half) => {
        const isSelected = half.side === side;
        return (
          <Tooltip key={half.side}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  data-testid={`sidebar-section-${half.side}`}
                  onClick={() => onSelect(half.side)}
                  className={cn(
                    "flex h-7 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    isSelected
                      ? "bg-sidebar-row-active text-sidebar-foreground shadow-xs"
                      : "text-sidebar-muted-foreground hover:text-sidebar-foreground",
                  )}
                >
                  <span className="truncate">{half.label}</span>
                  <span
                    className={cn(
                      "shrink-0 text-xs tabular-nums",
                      isSelected
                        ? "rounded-full bg-sidebar-control-surface px-1.5 py-px text-sidebar-muted-foreground"
                        : "text-sidebar-muted-foreground/70",
                    )}
                  >
                    {half.summary.count}
                  </span>
                  {/* Only the hidden side reports in — the visible one is already
                      showing its rows, and a second dot there would be noise. */}
                  {!isSelected && half.summary.needsAttention ? (
                    <span
                      aria-label={`${half.label} needs attention`}
                      role="status"
                      className="size-1.5 shrink-0 rounded-full bg-success"
                    />
                  ) : null}
                </button>
              }
            />
            <TooltipPopup side="bottom">
              {half.shortcutLabel ? `${half.label} (${half.shortcutLabel})` : half.label}
            </TooltipPopup>
          </Tooltip>
        );
      })}
    </div>
  );
});
