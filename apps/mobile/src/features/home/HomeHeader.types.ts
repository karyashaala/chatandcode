import type { EnvironmentId } from "@cctools/contracts";
import type { HomeSectionSummary } from "../threads/threadListV2";
import type { HomeListSection } from "./home-list-options";
import type {
  HomeListFilterMenuEnvironment,
  HomeListFilterMenuProject,
} from "./home-list-filter-menu";

export type HomeHeaderEnvironment = HomeListFilterMenuEnvironment;

export interface HomeHeaderProps {
  readonly environments: ReadonlyArray<HomeHeaderEnvironment>;
  readonly projects: ReadonlyArray<HomeListFilterMenuProject>;
  readonly searchQuery: string;
  readonly searchPlaceholder: string;
  readonly selectedEnvironmentId: EnvironmentId | null;
  readonly selectedProjectKey: string | null;
  readonly section: HomeListSection;
  /** Null hides the Chat / Code tabs (no environment offers chats). */
  readonly sectionSummary: {
    readonly chat: HomeSectionSummary;
    readonly code: HomeSectionSummary;
  } | null;
  readonly onSearchQueryChange: (query: string) => void;
  readonly onEnvironmentChange: (environmentId: EnvironmentId | null) => void;
  readonly onProjectChange: (projectKey: string | null) => void;
  readonly onSectionChange: (section: HomeListSection) => void;
  readonly onOpenEnvironments: () => void;
  readonly onOpenSettings: () => void;
  readonly onStartNewTask: () => void;
}
