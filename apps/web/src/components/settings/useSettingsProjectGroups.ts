import { isChatsProject } from "@cctools/client-runtime/state/projects";

import { useClientSettings } from "../../hooks/useSettings";
import { buildSidebarProjectSnapshots } from "../../sidebarProjectGrouping";
import { useEnvironments, usePrimaryEnvironmentId } from "../../state/environments";
import { useProjects } from "../../state/entities";

/** Settings lists the sidebar's logical projects by display name, without the Chats project. */
export function useSettingsProjectGroups() {
  const projects = useProjects();
  // Avoid object selector identities that rebuild groups and every settings row on each write.
  const sidebarProjectGroupingMode = useClientSettings(
    (settings) => settings.sidebarProjectGroupingMode,
  );
  const sidebarProjectGroupingOverrides = useClientSettings(
    (settings) => settings.sidebarProjectGroupingOverrides,
  );
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const { environments } = useEnvironments();
  const labels = new Map(environments.map((entry) => [entry.environmentId, entry.label]));
  const chatsRoots = new Map(
    environments.map((entry) => [entry.environmentId, entry.serverConfig?.chatsWorkspaceRoot]),
  );
  return buildSidebarProjectSnapshots({
    projects: projects.filter(
      (project) => !isChatsProject(project, chatsRoots.get(project.environmentId)),
    ),
    settings: { sidebarProjectGroupingMode, sidebarProjectGroupingOverrides },
    primaryEnvironmentId,
    resolveEnvironmentLabel: (id) => labels.get(id) ?? null,
  }).sort((a, b) => a.displayName.localeCompare(b.displayName));
}
