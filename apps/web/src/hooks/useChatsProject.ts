import { scopeProjectRef } from "@cctools/client-runtime/environment";
import { canCreateProjectInEnvironment } from "@cctools/client-runtime/operations/projects";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@cctools/client-runtime/state/runtime";
import type { EnvironmentId } from "@cctools/contracts";

import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { useEnvironments } from "~/state/environments";
import { projectEnvironment } from "~/state/projects";
import { useAtomCommand } from "~/state/use-atom-command";
import { useUiStateStore } from "~/uiStateStore";
import { useNewThreadHandler } from "./useHandleNewThread";

function reportChatFailure(error: unknown) {
  toastManager.add(
    stackedThreadToast({
      type: "error",
      title: "Could not start a chat",
      description: error instanceof Error ? error.message : "An error occurred.",
    }),
  );
}

/**
 * Chats live in the environment's Chats project, a plain folder the server
 * owns and creates on first use. A new chat is a draft there, like any new
 * thread; it becomes a chat when its first message is sent.
 */
export function useChatsProject() {
  const { environments } = useEnvironments();
  const openChats = useAtomCommand(projectEnvironment.openChats, { reportFailure: false });
  const handleNewThread = useNewThreadHandler();

  /** The Chats folder of a connected environment, or null when it offers none. */
  const chatsWorkspaceRootFor = (environmentId: EnvironmentId | null): string | null => {
    const environment = environments.find((entry) => entry.environmentId === environmentId);
    return canCreateProjectInEnvironment(environment?.connection.phase)
      ? (environment?.serverConfig?.chatsWorkspaceRoot ?? null)
      : null;
  };

  // A chat starts on the machine the user is working on when it offers chats,
  // otherwise on the first connected machine that does.
  const chatsEnvironmentId = (current: EnvironmentId | null): EnvironmentId | null => {
    if (current !== null && chatsWorkspaceRootFor(current) !== null) return current;
    return (
      environments.find((entry) => chatsWorkspaceRootFor(entry.environmentId) !== null)
        ?.environmentId ?? null
    );
  };

  // Without a connected environment that offers chats there is no Chat side.
  const chatsSupported = chatsEnvironmentId(null) !== null;

  /**
   * Opens a new chat draft; false when it could not (the failure is reported).
   * Resolves true without opening when the user switched sides meanwhile.
   */
  const startChatDraft = async (
    environmentId: EnvironmentId,
    options?: { replace?: boolean },
  ): Promise<boolean> => {
    const requestedSide = useUiStateStore.getState().sidebarSection;
    const result = await openChats({ environmentId, input: {} });
    if (result._tag !== "Success") {
      if (!isAtomCommandInterrupted(result)) reportChatFailure(squashAtomCommandFailure(result));
      return false;
    }
    if (useUiStateStore.getState().sidebarSection !== requestedSide) return true;
    try {
      await handleNewThread(scopeProjectRef(result.value.environmentId, result.value.id), options);
      return true;
    } catch (error) {
      reportChatFailure(error);
      return false;
    }
  };

  return { chatsWorkspaceRootFor, chatsSupported, chatsEnvironmentId, startChatDraft };
}
