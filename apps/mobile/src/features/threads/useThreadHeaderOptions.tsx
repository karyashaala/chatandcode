import { useWorkspaceSidebarHeaderItem } from "../layout/useWorkspaceSidebarHeaderItem";
import { StackActions, useNavigation } from "@react-navigation/native";
import { threadHeaderAppearance } from "./thread-header-appearance";
import { isDuoDevice } from "../../lib/device-type";
import type { AppNativeStackNavigationOptions } from "../../native/StackHeader";
import { useDeviceType } from "../../native/native-layout-metrics";
import { useNativeWorkspaceColumnsSupported } from "../../native/NativeWorkspaceColumns";
import { useAdaptiveWorkspaceLayout } from "../layout/AdaptiveWorkspaceLayout";
import { withNativeGlassHeaderItem } from "../layout/native-glass-header-items";
import {
  ThreadGitControls,
  useThreadGitCenterHeaderItems,
  useThreadGitRightHeaderItems,
} from "./ThreadGitControls";
import type { ThreadRouteChrome } from "./thread-route-chrome";

type NativeHeaderItems = ReadonlyArray<Record<string, unknown>>;

export function useThreadHeaderOptions(props: {
  readonly title: string;
  readonly subtitle: string;
  readonly headerColor: string;
  readonly usesNativeHeaderGlass: boolean;
  readonly gitControls: Parameters<typeof ThreadGitControls>[0];
  readonly onReturnToThread?: () => void;
  readonly draft?: boolean;
  /** Hides header items a chat does not use; absent shows them all. */
  readonly chrome?: ThreadRouteChrome;
}) {
  const usesNativeWorkspaceColumns = useNativeWorkspaceColumnsSupported();
  const deviceType = useDeviceType();
  const usesDuoHeader = usesNativeWorkspaceColumns && isDuoDevice(deviceType);
  const navigation = useNavigation();
  const { layout, startNewTask } = useAdaptiveWorkspaceLayout();
  const sidebarHeaderItem = useWorkspaceSidebarHeaderItem();
  const threadCenterHeaderItems = useThreadGitCenterHeaderItems(props.gitControls);
  const compactRightHeaderItems = useThreadGitRightHeaderItems(props.gitControls);
  const showGitActions = props.chrome?.showGitActions ?? true;
  const showInspector = props.chrome?.showInspector ?? true;
  const showTerminal = props.chrome?.showTerminal ?? true;
  const keepsHeaderItem = (item: NativeHeaderItems[number]) => {
    switch (item.identifier) {
      case "thread-right-git":
        return showGitActions;
      case "thread-right-files":
        return showInspector;
      case "thread-right-terminal":
        return showTerminal;
      default:
        return true;
    }
  };
  const rightHeaderItems = (
    usesDuoHeader || layout.usesSplitView ? threadCenterHeaderItems : compactRightHeaderItems
  ).filter(keepsHeaderItem);
  const splitLeftHeaderItems: NativeHeaderItems = [
    ...(!usesDuoHeader
      ? [
          {
            spacing: 18,
            type: "spacing" as const,
          },
        ]
      : []),
    ...(props.onReturnToThread
      ? [
          withNativeGlassHeaderItem({
            accessibilityLabel: "Return to chat",
            icon: { name: "chevron.left", type: "sfSymbol" as const },
            identifier: "thread-left-return",
            onPress: props.onReturnToThread,
            type: "button" as const,
          }),
        ]
      : []),
    sidebarHeaderItem,
    ...(!usesDuoHeader && !props.draft
      ? [
          withNativeGlassHeaderItem({
            accessibilityLabel: "New task",
            icon: { name: "square.and.pencil", type: "sfSymbol" as const },
            identifier: "thread-left-new-task",
            label: "New task",
            onPress: startNewTask,
            type: "button" as const,
          }),
        ]
      : []),
  ];
  const canGoBack = navigation.canGoBack();
  const compactHomeHeaderItems: NativeHeaderItems = [
    withNativeGlassHeaderItem({
      accessibilityLabel: "Go to threads list",
      icon: { name: "list.bullet", type: "sfSymbol" as const },
      identifier: "thread-left-home",
      onPress: () => navigation.dispatch(StackActions.replace("Home")),
      type: "button" as const,
    }),
  ];

  const options: AppNativeStackNavigationOptions = {
    ...threadHeaderAppearance(props.usesNativeHeaderGlass),
    headerTitle: props.title,
    title: props.title,
    headerBackVisible: !layout.usesSplitView,
    unstable_headerLeftItems: layout.usesSplitView
      ? () => splitLeftHeaderItems
      : canGoBack
        ? undefined
        : () => compactHomeHeaderItems,
    // The workspace navigator adds compose to the Duo detail column's bar.
    unstable_headerRightItems: () => rightHeaderItems,
    unstable_headerToolbarItems: () => [],
    unstable_headerSubtitle: props.usesNativeHeaderGlass ? props.subtitle : undefined,
    contentStyle: undefined,
  };
  const { environmentId, threadId, gitStatus } = props.gitControls;
  return {
    options,
    // Factories re-read only on version changes; include displayed items and hidden callback state such as default refs.
    optionsVersion: [
      splitLeftHeaderItems,
      threadCenterHeaderItems,
      compactRightHeaderItems,
      usesDuoHeader,
      showGitActions,
      showInspector,
      showTerminal,
      environmentId,
      threadId,
      gitStatus?.isDefaultRef,
      gitStatus?.refName,
      gitStatus?.pr?.url,
    ],
    sidebar: false,
    fallback:
      showGitActions && !layout.usesSplitView && !props.usesNativeHeaderGlass ? (
        <ThreadGitControls {...props.gitControls} showActionControls />
      ) : null,
  };
}
