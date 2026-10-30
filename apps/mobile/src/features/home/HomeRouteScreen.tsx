import { useAtomValue } from "@effect/atom-react";
import { use } from "react";
import { NativePrimaryColumnContext } from "../../native/v5-workspace-context";
import * as Arr from "effect/Array";
import * as Order from "effect/Order";
import { useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, useWindowDimensions } from "react-native";

import {
  resolveChatsProjectKeys,
  splitSidebarThreads,
} from "@cctools/client-runtime/state/projects";
import type { EnvironmentThreadShell } from "@cctools/client-runtime/state/shell";

import { NativeHeaderToolbar, NativeStackScreenOptions } from "../../native/StackHeader";
import { useProjects, useServerConfigs } from "../../state/entities";
import { threadListEnvironmentsAtom } from "../../state/server";
import { environmentThreadShells } from "../../state/threads";
import { usePendingNewTasks } from "../../state/use-pending-new-tasks";
import { useWorkspaceState } from "../../state/workspace";
import { useSavedRemoteConnections } from "../../state/use-remote-environment-registry";
import { useAdaptiveWorkspaceLayout } from "../layout/AdaptiveWorkspaceLayout";
import { useNativeColumnLayoutMetrics } from "../../native/native-layout-metrics";
import { WorkspaceEmptyDetail } from "../layout/WorkspaceEmptyDetail";
import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { checkForAppUpdateOnLaunch, startAppUpdateForegroundRecheck } from "../updates/app-updates";
import { AndroidHomeFabLayout } from "./AndroidHomeFab";
import { HomeScreen } from "./HomeScreen";
import { HomeHeader } from "./HomeHeader";
import { HomeSectionTabs } from "./HomeSectionTabs";
import { resolveHomeSectionSummary } from "../threads/threadListV2";
import { useHomeListOptions, useHomeListSection } from "./home-list-options";
import { useAtomValueWhileVisible, useHomeRouteVisible } from "./home-route-visibility";
import { useHomeThreadSelection } from "./home-thread-navigation";
import { buildHomeProjectScopes } from "./homeThreadList";
import { usePendingTaskListActions } from "./usePendingTaskListActions";
import { useThreadListActions } from "./useThreadListActions";
import { getConnectionAwareBrandHeaderOptions } from "./WorkspaceConnectionTitle";

/* ─── Route screen ───────────────────────────────────────────────────── */

export function HomeRouteScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const nativePrimaryColumn = use(NativePrimaryColumnContext);
  const columnMetrics = useNativeColumnLayoutMetrics();
  const headerWidth = nativePrimaryColumn ? (columnMetrics?.width ?? windowWidth) : windowWidth;
  const { layout, panes } = useAdaptiveWorkspaceLayout();
  const projects = useProjects();
  // Streaming turns rewrite thread shells many times a second. While a Thread
  // covers Home, rebuilding this list is invisible work.
  const visible = useHomeRouteVisible();
  const threads = useAtomValueWhileVisible(
    environmentThreadShells.navigationThreadShellsAtom,
    visible,
  );
  const { environments: workspaceEnvironments, state: catalogState } = useWorkspaceState();
  const { savedConnectionsById } = useSavedRemoteConnections();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState("");
  const handleSelectThread = useHomeThreadSelection();
  const handleNewThreadOnBranch = useCallback(
    (thread: EnvironmentThreadShell) => {
      navigation.navigate("NewTaskSheet", {
        screen: "NewTaskDraft",
        params: {
          environmentId: String(thread.environmentId),
          projectId: String(thread.projectId),
          branch: thread.branch,
          worktreePath: thread.worktreePath,
        },
      });
    },
    [navigation],
  );

  useEffect(() => {
    void checkForAppUpdateOnLaunch();
    startAppUpdateForegroundRecheck();
  }, []);

  const {
    archiveThread,
    confirmDeleteThread,
    settleThread,
    snoozeThread,
    unsnoozeThread,
    pinThread,
    unpinThread,
    setThreadAutoSettle,
    moveThread,
    renameThread,
    regenerateThreadTitle,
    unsettleThread,
  } = useThreadListActions();
  const pendingTasks = usePendingNewTasks();
  const { openPendingTask, confirmDeletePendingTask } = usePendingTaskListActions();
  const environments = useMemo(() => {
    const connectionStateByEnvironmentId = new Map(
      workspaceEnvironments.map(
        (environment) => [environment.environmentId, environment.connectionState] as const,
      ),
    );
    return Arr.sort(
      Object.values(savedConnectionsById).map((connection) => ({
        environmentId: connection.environmentId,
        label: connection.environmentLabel,
        connectionState:
          connectionStateByEnvironmentId.get(connection.environmentId) ?? "available",
      })),
      Order.mapInput(Order.String, (environment: { readonly label: string }) => environment.label),
    );
  }, [savedConnectionsById, workspaceEnvironments]);
  const availableEnvironmentIds = useMemo(
    () => new Set(environments.map((environment) => environment.environmentId)),
    [environments],
  );
  const { options: listOptions, setSelectedEnvironmentId } =
    useHomeListOptions(availableEnvironmentIds);
  const selectedEnvironmentId = listOptions.selectedEnvironmentId;
  const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(null);
  const { section, setSection, chatsSupported } = useHomeListSection();
  // Each environment's Chats project, found by its folder like Scratch.
  const serverConfigs = useServerConfigs();
  const chatsWorkspaceRoots = useMemo(
    () =>
      new Map(
        Array.from(
          serverConfigs,
          ([environmentId, config]) => [environmentId, config.chatsWorkspaceRoot] as const,
        ),
      ),
    [serverConfigs],
  );
  const chatsProjectKeys = useMemo(
    () => resolveChatsProjectKeys(projects, serverConfigs),
    [projects, serverConfigs],
  );
  const { settlementEnvironmentIds } = useAtomValue(threadListEnvironmentsAtom);
  // Tab counts follow the environment filter; chats have no project scope.
  const sectionSummary = useMemo(() => {
    const { chatThreads, codeThreads } = splitSidebarThreads(
      threads.filter(
        (thread) =>
          selectedEnvironmentId === null || thread.environmentId === selectedEnvironmentId,
      ),
      chatsProjectKeys,
    );
    return resolveHomeSectionSummary({
      section,
      chatThreads,
      codeThreads,
      settlementEnvironmentIds,
    });
  }, [chatsProjectKeys, section, selectedEnvironmentId, settlementEnvironmentIds, threads]);
  const projectFilterOptions = useMemo(
    () =>
      buildHomeProjectScopes({
        projects,
        environmentId: selectedEnvironmentId,
        projectGroupingMode: listOptions.projectGroupingMode,
        chatsWorkspaceRoots,
      }).map((scope) => ({
        key: scope.key,
        label: scope.title,
      })),
    [chatsWorkspaceRoots, listOptions.projectGroupingMode, projects, selectedEnvironmentId],
  );
  // On the Chat tab the compose buttons start a chat instead of a task.
  const startNewThread = () =>
    section === "chat"
      ? navigation.navigate("NewTaskSheet", { screen: "NewChatDraft" })
      : navigation.navigate("NewTaskSheet", { screen: "NewTask" });
  useEffect(() => {
    if (
      selectedProjectKey !== null &&
      !projectFilterOptions.some((project) => project.key === selectedProjectKey)
    ) {
      setSelectedProjectKey(null);
    }
  }, [projectFilterOptions, selectedProjectKey]);

  // In split layouts the persistent sidebar IS the thread list — Home becomes
  // an empty detail pane so selecting a thread never transitions layouts.
  if (layout.usesSplitView && !nativePrimaryColumn) {
    return (
      <>
        <NativeStackScreenOptions
          options={
            Platform.OS === "android"
              ? { headerShown: false }
              : { title: "", headerTitle: "", unstable_headerLeftItems: () => [] }
          }
        />
        {Platform.OS === "ios" ? (
          <NativeHeaderToolbar placement="left">
            <NativeHeaderToolbar.Button
              accessibilityLabel="New task"
              icon="square.and.pencil"
              onPress={() => navigation.navigate("NewTaskSheet", { screen: "NewTask" })}
            />
          </NativeHeaderToolbar>
        ) : null}
        {Platform.OS === "android" ? <AndroidScreenHeader title="Threads" /> : null}
        <WorkspaceEmptyDetail
          onAddConnection={
            Platform.OS === "android" && !catalogState.hasConnections
              ? () =>
                  navigation.navigate("SettingsSheet", {
                    screen: "SettingsContent",
                    params: { screen: "SettingsEnvironmentNew" },
                  })
              : undefined
          }
          onStartNewTask={
            Platform.OS === "android" && panes.primarySidebarVisible
              ? undefined
              : () => navigation.navigate("NewTaskSheet", { screen: "NewTask" })
          }
        />
      </>
    );
  }

  return (
    <AndroidHomeFabLayout onStartNewTask={startNewThread}>
      <>
        {/* Restore the header after leaving split view; screen options are
            shallow-merged. The brand slot also doubles as the connection
            status surface while an environment reconnects. */}
        <NativeStackScreenOptions
          // The brand slot carries the Chat / Code tabs, so their state
          // reapplies the header like a width change does.
          optionsVersion={[headerWidth, chatsSupported, section, sectionSummary]}
          options={{
            ...getConnectionAwareBrandHeaderOptions({
              headerWidth,
              trailingItemCount:
                nativePrimaryColumn && Platform.OS === "ios" && Platform.isPad ? 2 : 1,
              onOpenEnvironments: () =>
                navigation.navigate("SettingsSheet", {
                  screen: "SettingsContent",
                  params: { screen: "SettingsEnvironments" },
                }),
              tabs: chatsSupported ? (
                <HomeSectionTabs
                  section={section}
                  chat={sectionSummary.chat}
                  code={sectionSummary.code}
                  onSelect={setSection}
                />
              ) : undefined,
            }),
            headerShown: true,
          }}
        />
        <HomeHeader
          environments={environments}
          projects={section === "chat" ? [] : projectFilterOptions}
          searchQuery={searchQuery}
          searchPlaceholder={section === "chat" ? "Search chats" : "Search"}
          selectedEnvironmentId={selectedEnvironmentId}
          selectedProjectKey={selectedProjectKey}
          section={section}
          sectionSummary={chatsSupported ? sectionSummary : null}
          onSectionChange={setSection}
          onEnvironmentChange={setSelectedEnvironmentId}
          onProjectChange={setSelectedProjectKey}
          onOpenEnvironments={() =>
            navigation.navigate("SettingsSheet", {
              screen: "SettingsContent",
              params: { screen: "SettingsEnvironments" },
            })
          }
          onOpenSettings={() =>
            navigation.navigate("SettingsSheet", {
              screen: "SettingsContent",
              params: { screen: "Settings" },
            })
          }
          onSearchQueryChange={setSearchQuery}
          onStartNewTask={startNewThread}
        />

        <HomeScreen
          catalogState={catalogState}
          environments={environments}
          onAddConnection={() =>
            navigation.navigate("SettingsSheet", {
              screen: "SettingsContent",
              params: { screen: "SettingsEnvironmentNew" },
            })
          }
          onArchiveThread={archiveThread}
          onDeleteThread={confirmDeleteThread}
          onSettleThread={settleThread}
          onSnoozeThread={snoozeThread}
          onUnsnoozeThread={unsnoozeThread}
          onUnsettleThread={unsettleThread}
          onPinThread={pinThread}
          onUnpinThread={unpinThread}
          onSetThreadAutoSettle={setThreadAutoSettle}
          onMoveThread={moveThread}
          onRenameThread={renameThread}
          onRegenerateThreadTitle={regenerateThreadTitle}
          onEnvironmentChange={setSelectedEnvironmentId}
          onProjectChange={setSelectedProjectKey}
          onOpenSettings={() =>
            navigation.navigate("SettingsSheet", {
              screen: "SettingsContent",
              params: { screen: "Settings" },
            })
          }
          onSearchQueryChange={setSearchQuery}
          onSelectThread={handleSelectThread}
          onSelectPendingTask={openPendingTask}
          onDeletePendingTask={confirmDeletePendingTask}
          onNewThreadOnBranch={handleNewThreadOnBranch}
          onNewThreadInProject={(project) => {
            navigation.navigate("NewTaskSheet", {
              screen: "NewTaskDraft",
              params: {
                environmentId: String(project.environmentId),
                projectId: String(project.id),
                title: project.title,
              },
            });
          }}
          onStartNewTask={startNewThread}
          pendingTasks={pendingTasks}
          section={section}
          chatsProjectKeys={chatsProjectKeys}
          chatsWorkspaceRoots={chatsWorkspaceRoots}
          projectGroupingMode={listOptions.projectGroupingMode}
          projects={projects}
          projectSortOrder={listOptions.projectSortOrder}
          savedConnectionsById={savedConnectionsById}
          searchQuery={searchQuery}
          selectedEnvironmentId={selectedEnvironmentId}
          selectedProjectKey={section === "chat" ? null : selectedProjectKey}
          threads={threads}
        />
      </>
    </AndroidHomeFabLayout>
  );
}
