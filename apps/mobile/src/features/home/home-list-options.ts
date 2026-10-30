import type { EnvironmentId, SidebarProjectGroupingMode } from "@cctools/contracts";
import { DEFAULT_SIDEBAR_PROJECT_SORT_ORDER } from "@cctools/contracts";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult, type Atom } from "effect/reactivity";

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
  readonly projectSortOrder: HomeProjectSortOrder;
}

export interface ResolvedHomeListOptions extends HomeListOptions {
  readonly projectGroupingMode: SidebarProjectGroupingMode;
}

function defaultHomeListOptions(): HomeListOptions {
  return {
    selectedEnvironmentId: null,
    projectSortOrder:
      DEFAULT_SIDEBAR_PROJECT_SORT_ORDER === "manual"
        ? "updated_at"
        : DEFAULT_SIDEBAR_PROJECT_SORT_ORDER,
  };
}

interface HomeListOptionsContextValue {
  readonly options: HomeListOptions;
  readonly setOptions: Dispatch<SetStateAction<HomeListOptions>>;
  readonly projectGroupingMode: SidebarProjectGroupingMode;
  readonly section: HomeListSection;
  readonly setSection: (section: HomeListSection) => void;
  readonly chatsSupported: boolean;
}

const HomeListOptionsContext = createContext<HomeListOptionsContextValue | null>(null);

/** Keeps list preferences stable while the app moves between compact and split shells. */
export function HomeListOptionsProvider({
  children,
  projectGroupingMode,
}: PropsWithChildren<{
  readonly projectGroupingMode: SidebarProjectGroupingMode;
}>) {
  const [options, setOptions] = useState<HomeListOptions>(defaultHomeListOptions);
  // The saved preference is the one source of truth, so a value that loads
  // after mount (or changes elsewhere) is never shadowed by a local copy.
  const storedSection = useAtomValue(mobilePreferencesAtom, selectHomeListSection);
  // Without an environment that offers chats there is no Chat side; Home is
  // Code and the saved side waits for one.
  const chatsSupported = useAtomValue(environmentServerConfigsAtom, selectChatsSupported);
  const section = chatsSupported ? storedSection : "code";
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  const setSection = useCallback(
    (nextSection: HomeListSection) => savePreferences({ homeListSection: nextSection }),
    [savePreferences],
  );
  const value = useMemo(
    () => ({ options, setOptions, projectGroupingMode, section, setSection, chatsSupported }),
    [chatsSupported, options, projectGroupingMode, section, setSection],
  );
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
  const setOptions = shared?.setOptions ?? setLocalOptions;
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

  const setSelectedEnvironmentId = useCallback((value: EnvironmentId | null) => {
    setOptions((current) => ({ ...current, selectedEnvironmentId: value }));
  }, []);
  const setProjectSortOrder = useCallback((value: HomeProjectSortOrder) => {
    setOptions((current) => ({ ...current, projectSortOrder: value }));
  }, []);
  return {
    options: resolvedOptions,
    setSelectedEnvironmentId,
    setProjectSortOrder,
  } as const;
}
