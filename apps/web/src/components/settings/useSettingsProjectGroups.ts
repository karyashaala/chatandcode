import { isChatsProject } from "@cctools/client-runtime/state/projects";
import { useMemo } from "react";

import { useClientSettings } from "../../hooks/useSettings";
import { selectProjectGroupingSettings } from "../../logicalProject";
import { buildSidebarProjectSnapshots } from "../../sidebarProjectGrouping";
import { useEnvironments, usePrimaryEnvironmentId } from "../../state/environments";
import { useProjects } from "../../state/entities";

/**
 * Settings uses the same logical projects as the sidebar, sorted by display
 * name. The Chats project is not one of them.
 */
export function useSettingsProjectGroups() {
  const projects = useProjects();
  const settings = useClientSettings(selectProjectGroupingSettings);
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const { environments } = useEnvironments();
  return useMemo(() => {
    const labels = new Map(environments.map((entry) => [entry.environmentId, entry.label]));
    const chatsRoots = new Map(
      environments.map((entry) => [entry.environmentId, entry.serverConfig?.chatsWorkspaceRoot]),
    );
    return buildSidebarProjectSnapshots({
      projects: projects.filter(
        (project) => !isChatsProject(project, chatsRoots.get(project.environmentId)),
      ),
      settings,
      primaryEnvironmentId,
      resolveEnvironmentLabel: (id) => labels.get(id) ?? null,
    }).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [environments, primaryEnvironmentId, projects, settings]);
}
