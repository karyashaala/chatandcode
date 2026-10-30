import { canCreateProjectInEnvironment } from "@cctools/client-runtime/operations/projects";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@cctools/client-runtime/state/runtime";
import type { EnvironmentProject } from "@cctools/client-runtime/state/shell";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";

import { AppText as Text } from "../../components/AppText";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { useServerConfigs } from "../../state/entities";
import { projectEnvironment } from "../../state/projects";
import { useAtomCommand } from "../../state/use-atom-command";
import { useRemoteConnectionStatus } from "../../state/use-remote-environment-registry";
import { useNewTaskFlow } from "./new-task-flow-provider";
import { NewTaskDraftScreen } from "./NewTaskDraftScreen";

/**
 * Home's Chat-tab compose entry. Opens the machine's Chats project (creating it
 * when missing) and hands the draft to the new-task composer, which shows the
 * chat hero and mode pill. Nothing is sent until the user does.
 */
export function NewChatDraftScreen() {
  const navigation = useNavigation();
  const { isChatsDraft, selectedEnvironmentId, setProject } = useNewTaskFlow();
  const serverConfigs = useServerConfigs();
  const { connectedEnvironments } = useRemoteConnectionStatus();
  const openChats = useAtomCommand(projectEnvironment.openChats, { reportFailure: false });
  // Starts on the flow's machine when it offers chats, otherwise the first that does.
  const chatsEnvironments = connectedEnvironments.filter(
    (environment) =>
      canCreateProjectInEnvironment(environment.connectionState) &&
      serverConfigs.get(environment.environmentId)?.chatsWorkspaceRoot !== undefined,
  );
  const environmentId =
    (
      chatsEnvironments.find(
        (environment) => environment.environmentId === selectedEnvironmentId,
      ) ?? chatsEnvironments[0]
    )?.environmentId ?? null;
  const [chatsProject, setChatsProject] = useState<EnvironmentProject | null>(null);
  const startedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (environmentId === null || startedRef.current) return;
    startedRef.current = true;
    void openChats({ environmentId, input: {} }).then((result) => {
      if (!mountedRef.current) return;
      if (result._tag === "Failure") {
        if (!isAtomCommandInterrupted(result)) {
          const error = squashAtomCommandFailure(result);
          Alert.alert(
            "Could not start a chat",
            error instanceof Error ? error.message : "The Chats folder could not be created.",
          );
        }
        navigation.goBack();
        return;
      }
      setChatsProject(result.value);
    });
  }, [environmentId, navigation, openChats]);
  // Applied from a render after the open, so the flow's current setProject
  // moves the draft it already bound to the Chats project.
  useEffect(() => {
    if (chatsProject !== null) setProject(chatsProject);
  }, [chatsProject, setProject]);

  if (chatsProject !== null && isChatsDraft) return <NewTaskDraftScreen />;
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-screen px-8">
      <NativeStackScreenOptions options={{ title: "New chat" }} />
      {environmentId === null ? (
        <Text className="text-center text-foreground-muted">
          Connect to a machine that offers chats to start one.
        </Text>
      ) : (
        <ActivityIndicator colorClassName="accent-icon-muted" />
      )}
    </View>
  );
}
