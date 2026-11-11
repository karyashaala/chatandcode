import { workspaceAreaProps } from "../lib/workspaceFocus";
import { RefreshIcon } from "~/components/ui/refresh-icon";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { isElectron } from "../env";
import { NoProjectsHero } from "../components/NoProjectsHero";
import { resolveChatsProjectKeys } from "@cctools/client-runtime/state/projects";
import { Button } from "../components/ui/button";
import { HostedEmptyState } from "../components/HostedEmptyState";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../components/ui/empty";
import { SidebarInset } from "../components/ui/sidebar";
import { WorkspacePageHeader } from "../components/WorkspacePageHeader";
import { useChatsProject } from "../hooks/useChatsProject";
import { useSidebarSectionNavigation } from "../hooks/useSidebarSectionNavigation";
import {
  useAllEnvironmentShellsBootstrapped,
  useProjects,
  useServerConfigs,
} from "../state/entities";
import { useEnvironments } from "../state/environments";
import { useUiStateStore } from "../uiStateStore";

function ChatIndexRouteView() {
  const { authGateState } = Route.useRouteContext();
  const { environments, isReady } = useEnvironments();

  if (authGateState.status === "hosted-static") {
    if (!isReady) return null;
    if (environments.length === 0) return <HostedEmptyState />;
  }

  return <IndexDraftLanding />;
}

/**
 * Landing on the index route opens the sidebar side the user left: its last
 * thread or draft, else a new chat on Chat or a draft in the most recently
 * active project on Code, so the first screen is a prompt instead of a dead
 * end. Falls back to an add-project hero when Code has no project yet.
 */
function IndexDraftLanding() {
  const projects = useProjects();
  const serverConfigs = useServerConfigs();
  const bootstrapped = useAllEnvironmentShellsBootstrapped();
  const { chatsSupported } = useChatsProject();
  const { environments } = useEnvironments();
  const storedSide = useUiStateStore((state) => state.sidebarSection);
  const side = chatsSupported ? storedSide : "code";
  // A stored Chat side waits while a machine whose cached config offers chats
  // makes its first connection, so a reload or launch reopens Chat.
  const awaitingChats =
    storedSide === "chat" &&
    !chatsSupported &&
    environments.some(
      (entry) =>
        entry.entry.enabled &&
        (entry.connection.phase === "available" || entry.connection.phase === "connecting") &&
        entry.serverConfig?.chatsWorkspaceRoot != null,
    );
  const navigateSidebarSide = useSidebarSectionNavigation();
  const router = useRouter();
  // Read at effect time; this page can stay mounted while the router is already navigating away.
  const isStillOnIndex = useEffectEvent(() => router.state.location.pathname === "/");
  const startedAttemptRef = useRef<number | null>(null);
  const [startState, setStartState] = useState({ failed: false, retryRequest: 0 });

  const chatsProjectKeys = resolveChatsProjectKeys(projects, serverConfigs);
  // An archived project does not count, like upstream's most-recent-project landing.
  const hasCodeProject = projects.some(
    (project) =>
      project.archivedAt == null && !chatsProjectKeys.has(`${project.environmentId}:${project.id}`),
  );
  const canLand = side === "chat" || hasCodeProject;
  const attempt = startState.retryRequest;

  // oxlint-disable-next-line chatandcode/no-unreasoned-state-sync -- starts a draft thread in the most recent project and navigates to it while still on the index
  useEffect(() => {
    // Starting after the user has left would replace the page they picked.
    if (
      !bootstrapped ||
      awaitingChats ||
      !canLand ||
      startedAttemptRef.current === attempt ||
      !isStillOnIndex()
    ) {
      return;
    }
    startedAttemptRef.current = attempt;
    const fail = () => setStartState((state) => ({ ...state, failed: true }));
    void navigateSidebarSide(side, { startup: true })
      .then((landed) => {
        if (!landed) fail();
      })
      .catch(fail);
  }, [attempt, awaitingChats, bootstrapped, canLand, navigateSidebarSide, side]);

  if (!bootstrapped || awaitingChats) {
    return null;
  }
  if (canLand) {
    return startState.failed ? (
      <DraftStartError
        onRetry={() => {
          setStartState((state) => ({
            failed: false,
            retryRequest: state.retryRequest + 1,
          }));
        }}
      />
    ) : null;
  }
  return <NoProjectsHero />;
}

function DraftStartError({ onRetry }: { readonly onRetry: () => void }) {
  const contentArea = workspaceAreaProps("home", 1, "Home");
  return (
    <SidebarInset
      {...contentArea}
      role="main"
      className="h-dvh min-h-0 overflow-hidden overscroll-y-none"
    >
      {isElectron ? <WorkspacePageHeader electron /> : null}
      <Empty className="flex-1">
        <EmptyHeader className="max-w-md">
          <EmptyTitle>Couldn’t start a new thread</EmptyTitle>
          <EmptyDescription>
            The project is still available. Try opening the draft again.
          </EmptyDescription>
          <div className="mt-5 flex justify-center">
            <Button size="sm" onClick={onRetry}>
              <RefreshIcon size="md" />
              Try again
            </Button>
          </div>
        </EmptyHeader>
      </Empty>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/")({
  component: ChatIndexRouteView,
});
