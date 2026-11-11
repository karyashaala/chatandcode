import type { EnvironmentId, SidebarProjectGroupingMode } from "@cctools/contracts";
import { DEFAULT_SIDEBAR_PROJECT_SORT_ORDER } from "@cctools/contracts";
import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult, Atom } from "effect/reactivity";
import { createContext, createElement, useContext, useState, type PropsWithChildren } from "react";

import type { ThreadListFilters } from "../../persistence/mobile-preferences";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import { environmentServerConfigsAtom } from "../../state/server";
import type { HomeProjectSortOrder } from "./homeThreadList";

export type HomeListSection = "chat" | "code";

function selectHomeListSection(
  preferences: Atom.Type<typeof mobilePreferencesAtom>,
): HomeListSection {
  return (
    (AsyncResult.isSuccess(preferences) ? preferences.value.homeListSection : undefined) ?? "code"
  );
}

function selectChatsSupported(configs: Atom.Type<typeof environmentServerConfigsAtom>): boolean {
  for (const config of configs.values()) {
    if (config.chatsWorkspaceRoot !== undefined) return true;
  }
  return false;
}

export interface HomeListOptions {
  readonly selectedEnvironmentId: EnvironmentId | null;
  readonly selectedProjectKey: string | null;
  readonly projectSortOrder: HomeProjectSortOrder;
}

export interface ResolvedHomeListOptions extends HomeListOptions {
  readonly projectGroupingMode: SidebarProjectGroupingMode;
}

function defaultHomeListOptions(filters?: ThreadListFilters): HomeListOptions {
  return {
    selectedEnvironmentId: filters?.environmentId ?? null,
    selectedProjectKey: filters?.projectKey ?? null,
    projectSortOrder:
      DEFAULT_SIDEBAR_PROJECT_SORT_ORDER === "manual"
        ? "updated_at"
        : DEFAULT_SIDEBAR_PROJECT_SORT_ORDER,
  };
}

interface HomeListOptionsContextValue {
  readonly options: HomeListOptions;
  readonly updateOptions: (patch: Partial<HomeListOptions>) => void;
  readonly projectGroupingMode: SidebarProjectGroupingMode;
  readonly section: HomeListSection;
  readonly setSection: (section: HomeListSection) => void;
  readonly chatsSupported: boolean;
}

const HomeListOptionsContext = createContext<HomeListOptionsContextValue | null>(null);

export function HomeListOptionsProvider({
  children,
  projectGroupingMode,
  savedFilters,
}: PropsWithChildren<{
  readonly projectGroupingMode: SidebarProjectGroupingMode;
  readonly savedFilters?: ThreadListFilters | undefined;
}>) {
  const registry = useContext(RegistryContext);
  const [optionsAtom] = useState(() => Atom.make(defaultHomeListOptions(savedFilters)));
  const options = useAtomValue(optionsAtom);
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  // Only the scope persists; the sort order is per session. Updates read the
  // registry, so several in one event each build on the last and save it.
  const updateOptions = (patch: Partial<HomeListOptions>) => {
    const current = registry.get(optionsAtom);
    const next = { ...current, ...patch };
    registry.set(optionsAtom, next);
    if (
      next.selectedEnvironmentId !== current.selectedEnvironmentId ||
      next.selectedProjectKey !== current.selectedProjectKey
    ) {
      savePreferences({
        threadListFilters: {
          environmentId: next.selectedEnvironmentId,
          projectKey: next.selectedProjectKey,
        },
      });
    }
  };
  // The saved preference is the one source of truth, so a value that loads
  // after mount (or changes elsewhere) is never shadowed by a local copy.
  const storedSection = useAtomValue(mobilePreferencesAtom, selectHomeListSection);
  // Without an environment that offers chats there is no Chat side; Home is
  // Code and the saved side waits for one.
  const chatsSupported = useAtomValue(environmentServerConfigsAtom, selectChatsSupported);
  const section = chatsSupported ? storedSection : "code";
  const setSection = (nextSection: HomeListSection) =>
    savePreferences({ homeListSection: nextSection });
  const value = {
    options,
    updateOptions,
    projectGroupingMode,
    section,
    setSection,
    chatsSupported,
  };
  return createElement(HomeListOptionsContext, { value }, children);
}

export function useHomeListSection() {
  const shared = useContext(HomeListOptionsContext);
  if (shared === null) {
    throw new Error("useHomeListSection must be used within HomeListOptionsProvider");
  }
  return {
    section: shared.section,
    setSection: shared.setSection,
    chatsSupported: shared.chatsSupported,
  } as const;
}

export function useHomeListOptions(availableEnvironmentIds: ReadonlySet<EnvironmentId>) {
  const shared = useContext(HomeListOptionsContext);
  const [localOptions, setLocalOptions] = useState<HomeListOptions>(defaultHomeListOptions);
  const options = shared?.options ?? localOptions;
  const updateOptions =
    shared?.updateOptions ??
    ((patch: Partial<HomeListOptions>) => setLocalOptions((current) => ({ ...current, ...patch })));
  const selectedEnvironmentId =
    options.selectedEnvironmentId !== null &&
    availableEnvironmentIds.has(options.selectedEnvironmentId)
      ? options.selectedEnvironmentId
      : null;
  const availableOptions =
    selectedEnvironmentId === options.selectedEnvironmentId
      ? options
      : { ...options, selectedEnvironmentId };
  const resolvedOptions: ResolvedHomeListOptions = {
    ...availableOptions,
    projectGroupingMode: shared?.projectGroupingMode ?? "repository",
  };

  const setSelectedEnvironmentId = (value: EnvironmentId | null) => {
    updateOptions({ selectedEnvironmentId: value });
  };
  const setSelectedProjectKey = (value: string | null) => {
    updateOptions({ selectedProjectKey: value });
  };
  const setProjectSortOrder = (value: HomeProjectSortOrder) => {
    updateOptions({ projectSortOrder: value });
  };
  return {
    options: resolvedOptions,
    setSelectedEnvironmentId,
    setSelectedProjectKey,
    setProjectSortOrder,
  } as const;
}
