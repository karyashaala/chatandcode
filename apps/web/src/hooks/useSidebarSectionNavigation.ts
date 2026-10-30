import { resolveChatsProjectKeys } from "@cctools/client-runtime/state/projects";
import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

import { resolveSidebarDestination, type SidebarDestination } from "../components/Sidebar.logic";
import { useComposerDraftStore } from "../composerDraftStore";
import { appAtomRegistry } from "../rpc/atomRegistry";
import { readProjects, readThreadShells } from "../state/entities";
import { usePrimaryEnvironmentId } from "../state/environments";
import { environmentServerConfigsAtom } from "../state/server";
import { buildThreadRouteParams, resolveThreadRouteTarget } from "../threadRoutes";
import { useUiStateStore, type SidebarSide } from "../uiStateStore";
import { useChatsProject } from "./useChatsProject";
import { useNewThreadHandler } from "./useHandleNewThread";

/**
 * Opens a sidebar side the way the switch, its shortcuts and app startup do:
 * the side's last thread or draft, else a new chat or a new draft in the most
 * recent project. `newChat` always opens a new chat on the machine in view,
 * as the sidebar's "New chat" button does. Reads threads, projects and drafts
 * when called, so mounting it subscribes to none of them.
 */
export function useSidebarSectionNavigation() {
  const router = useRouter();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const { chatsSupported, chatsEnvironmentId, startChatDraft } = useChatsProject();
  const handleNewThread = useNewThreadHandler();

  /** Resolves false when the side's destination could not be opened. */
  return useCallback(
    async (
      section: SidebarSide,
      options?: { startup?: boolean; newChat?: boolean },
    ): Promise<boolean> => {
      const startup = options?.startup ?? false;
      if (!startup && !chatsSupported) return true;
      const state = useUiStateStore.getState();
      const drafts = useComposerDraftStore.getState();
      const projects = readProjects();
      const currentTarget = resolveThreadRouteTarget(router.state.matches.at(-1)?.params ?? {});
      const destination: SidebarDestination | null = options?.newChat
        ? { kind: "new-chat" }
        : resolveSidebarDestination({
            section,
            currentSection: startup ? null : state.sidebarSection,
            currentTarget,
            rememberedTarget: chatsSupported ? state.sidebarTargets[section] : undefined,
            threads: readThreadShells(),
            projects,
            chatsProjectKeys: resolveChatsProjectKeys(
              projects,
              appAtomRegistry.get(environmentServerConfigsAtom),
            ),
            getDraftSession: drafts.getDraftSession,
          });
      const previousSection = state.sidebarSection;
      if (chatsSupported) state.setSidebarSection(section);
      if (!destination) return true;
      switch (destination.kind) {
        case "server":
          await router.navigate({
            to: "/$environmentId/$threadId",
            params: buildThreadRouteParams(destination.threadRef),
            replace: startup,
          });
          return true;
        case "draft":
          await router.navigate({
            to: "/draft/$draftId",
            params: { draftId: destination.draftId },
            replace: startup,
          });
          return true;
        case "new-chat": {
          const currentEnvironmentId =
            currentTarget?.kind === "server"
              ? currentTarget.threadRef.environmentId
              : currentTarget?.kind === "draft"
                ? (drafts.getDraftSession(currentTarget.draftId)?.environmentId ?? null)
                : null;
          const environmentId = chatsEnvironmentId(currentEnvironmentId ?? primaryEnvironmentId);
          const opened =
            environmentId !== null && (await startChatDraft(environmentId, { replace: startup }));
          // A chat that could not open leaves the switch where it was, so it can be retried.
          if (!opened && useUiStateStore.getState().sidebarSection === section) {
            state.setSidebarSection(previousSection);
          }
          return opened;
        }
        case "new-draft":
          await handleNewThread(destination.projectRef, { replace: startup });
          return true;
        case "projects":
          if (!startup) await router.navigate({ to: "/" });
          return true;
      }
    },
    [
      chatsEnvironmentId,
      chatsSupported,
      handleNewThread,
      primaryEnvironmentId,
      router,
      startChatDraft,
    ],
  );
}
