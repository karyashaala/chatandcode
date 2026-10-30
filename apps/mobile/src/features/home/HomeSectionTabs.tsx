import { Pressable, View } from "react-native";

import { AppText as Text } from "../../components/AppText";
import { cn } from "../../lib/cn";
import type { HomeSectionSummary } from "../threads/threadListV2";
import type { HomeListSection } from "./home-list-options";

/**
 * Attention dots read as the side they belong to: a chat waiting on you is
 * blue, code work that needs you is amber. Only the inactive side carries
 * one — the active side's rows are already on screen.
 */
const ATTENTION_DOT_CLASS: Record<HomeListSection, string> = {
  chat: "bg-blue-500",
  code: "bg-amber-500",
};

function SectionTab(props: {
  readonly label: "Chat" | "Code";
  readonly section: HomeListSection;
  readonly selectedSection: HomeListSection;
  readonly summary: HomeSectionSummary;
  readonly onSelect: (section: HomeListSection) => void;
}) {
  const selected = props.section === props.selectedSection;
  return (
    <Pressable
      accessibilityLabel={`${props.label}, ${props.summary.count}`}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      className="flex-row items-center gap-1.5 py-1"
      hitSlop={{ bottom: 10, left: 4, right: 4, top: 10 }}
      onPress={() => {
        if (!selected) props.onSelect(props.section);
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
    >
      {/* The underline is absolutely positioned so selecting a tab never
          changes the row's height or the labels' baseline. */}
      <View>
        <View className="flex-row items-baseline gap-1">
          <Text
            className={cn(
              "text-[17px] font-t3-bold",
              selected ? "text-foreground" : "text-foreground-muted",
            )}
          >
            {props.label}
          </Text>
          <Text className="text-[13px] tabular-nums text-foreground-muted">
            {props.summary.count}
          </Text>
        </View>
        {selected ? (
          <View className="absolute -bottom-1.5 h-0.5 w-full rounded-full bg-foreground" />
        ) : null}
      </View>
      {!selected && props.summary.needsAttention ? (
        <View
          accessibilityLabel={`${props.label} needs attention`}
          className={cn("size-2 rounded-full", ATTENTION_DOT_CLASS[props.section])}
        />
      ) : null}
    </Pressable>
  );
}

/** The Chat / Code sides as underline tabs, sharing the header's brand row. */
export function HomeSectionTabs(props: {
  readonly section: HomeListSection;
  readonly chat: HomeSectionSummary;
  readonly code: HomeSectionSummary;
  readonly onSelect: (section: HomeListSection) => void;
}) {
  return (
    <View accessibilityRole="tablist" className="shrink-0 flex-row items-center gap-4">
      <SectionTab
        label="Chat"
        section="chat"
        selectedSection={props.section}
        summary={props.chat}
        onSelect={props.onSelect}
      />
      <SectionTab
        label="Code"
        section="code"
        selectedSection={props.section}
        summary={props.code}
        onSelect={props.onSelect}
      />
    </View>
  );
}
