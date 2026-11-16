import type { ReactNode } from "react";
import { View } from "react-native";

import { CompactBrandTitle } from "../../../components/CompactBrandTitle";
import { Wordmark } from "../../../components/Wordmark";
import { WorkspaceConnectionTitle } from "../../home/WorkspaceConnectionTitle";

/** The title of a workspace list tab: the brand and the connection status. */
export function WorkspaceBrandTitle(props: {
  readonly accessibilityLabel: string;
  readonly onOpenEnvironments: () => void;
  /** Home's Chat / Code tabs, drawn beside the brand mark. */
  readonly tabs?: ReactNode;
}) {
  if (props.tabs !== undefined) {
    // The brand steps down to its mark so the tabs fit beside it.
    return (
      <View className="min-w-0 flex-1 flex-row items-center gap-3">
        <View className="min-w-0 shrink">
          <WorkspaceConnectionTitle
            grow
            onPress={props.onOpenEnvironments}
            brand={<Wordmark colorClassName="accent-icon" height={15} />}
          />
        </View>
        {props.tabs}
      </View>
    );
  }
  return (
    <WorkspaceConnectionTitle
      grow
      onPress={props.onOpenEnvironments}
      brand={
        <CompactBrandTitle
          allowFontScaling={false}
          accessibilityLabel={props.accessibilityLabel}
          fit
        />
      }
    />
  );
}
