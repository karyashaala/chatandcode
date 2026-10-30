import type { ServerConfig } from "@cctools/contracts";
import { scopeProjectRef, scopedProjectKey } from "../environment/index.ts";
import type { EnvironmentProject } from "./models.ts";
import {
  isExplicitRelativePath,
  isUncPath,
  isWindowsAbsolutePath,
  isWindowsDrivePath,
  normalizeProjectPathForComparison,
  normalizeProjectPathForDispatch,
} from "@cctools/shared/path";

export { normalizeProjectPathForComparison, normalizeProjectPathForDispatch };

export const isWindowsPlatform = (platform: string): boolean => {
  return /^win(dows)?/i.test(platform);
};

function getAbsolutePathKind(value: string): "unix" | "windows" | null {
  if (isWindowsDrivePath(value) || isUncPath(value)) {
    return "windows";
  }
  if (value.startsWith("/")) {
    return "unix";
  }
  return null;
}

function preferredPathSeparator(value: string): "/" | "\\" {
  const absolutePathKind = getAbsolutePathKind(value);
  if (absolutePathKind === "windows") return "\\";
  if (absolutePathKind === "unix") return "/";
  return value.includes("\\") ? "\\" : "/";
}

export function hasTrailingPathSeparator(value: string): boolean {
  return (getAbsolutePathKind(value) === "unix" ? /\/$/ : /[\\/]$/).test(value);
}

export { isExplicitRelativePath as isExplicitRelativeProjectPath };

function splitPathSegments(value: string, separator: "/" | "\\"): string[] {
  return value.split(separator === "/" ? /\/+/ : /[\\/]+/).filter(Boolean);
}

function getLastPathSeparatorIndex(value: string): number {
  if (getAbsolutePathKind(value) === "unix") {
    return value.lastIndexOf("/");
  }
  return Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"));
}

function splitAbsolutePath(value: string): {
  root: string;
  separator: "/" | "\\";
  segments: string[];
} | null {
  if (isWindowsDrivePath(value)) {
    const root = `${value.slice(0, 2)}\\`;
    const segments = splitPathSegments(value.slice(root.length), "\\");
    return { root, separator: "\\", segments };
  }
  if (isUncPath(value)) {
    const segments = splitPathSegments(value, "\\");
    const [server, share, ...rest] = segments;
    if (!server || !share) return null;
    return {
      root: `\\\\${server}\\${share}\\`,
      separator: "\\",
      segments: rest,
    };
  }
  if (value.startsWith("/")) {
    return {
      root: "/",
      separator: "/",
      segments: splitPathSegments(value.slice(1), "/"),
    };
  }
  return null;
}

export function isFilesystemBrowseQuery(value: string, platform = ""): boolean {
  const allowWindowsPaths = isWindowsPlatform(platform);
  return (
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith(".\\") ||
    value.startsWith("..\\") ||
    value.startsWith("/") ||
    value.startsWith("~/") ||
    (allowWindowsPaths && isWindowsAbsolutePath(value))
  );
}

export function isUnsupportedWindowsProjectPath(value: string, platform: string): boolean {
  return isWindowsAbsolutePath(value) && !isWindowsPlatform(platform);
}

export function resolveProjectPathForDispatch(value: string, cwd?: string | null): string {
  const trimmedValue = value.trim();
  if (!isExplicitRelativePath(trimmedValue) || !cwd) {
    return normalizeProjectPathForDispatch(trimmedValue);
  }

  const absoluteBase = splitAbsolutePath(normalizeProjectPathForDispatch(cwd));
  if (!absoluteBase) {
    return normalizeProjectPathForDispatch(trimmedValue);
  }

  const nextSegments = [...absoluteBase.segments];
  for (const segment of trimmedValue.split(/[\\/]+/)) {
    if (segment.length === 0 || segment === ".") continue;
    if (segment === "..") {
      nextSegments.pop();
      continue;
    }
    nextSegments.push(segment);
  }

  const joinedPath = nextSegments.join(absoluteBase.separator);
  return normalizeProjectPathForDispatch(
    joinedPath.length === 0 ? absoluteBase.root : `${absoluteBase.root}${joinedPath}`,
  );
}

export function findProjectByPath<T extends { workspaceRoot?: string; cwd?: string }>(
  projects: ReadonlyArray<T>,
  candidatePath: string,
): T | undefined {
  const normalizedCandidate = normalizeProjectPathForComparison(candidatePath);
  if (normalizedCandidate.length === 0) {
    return undefined;
  }
  return projects.find((project) => {
    const cwd = project.workspaceRoot ?? project.cwd;
    return cwd ? normalizeProjectPathForComparison(cwd) === normalizedCandidate : false;
  });
}

/** Whether a project is its environment's Scratch project (`ServerConfig.scratchWorkspaceRoot`). */
export function isScratchProject(
  project: { readonly workspaceRoot: string },
  scratchWorkspaceRoot: string | null | undefined,
): boolean {
  return (
    scratchWorkspaceRoot != null && findProjectByPath([project], scratchWorkspaceRoot) !== undefined
  );
}

/** Whether a project is its environment's Chats project (`ServerConfig.chatsWorkspaceRoot`). */
export function isChatsProject(
  project: { readonly workspaceRoot: string },
  chatsWorkspaceRoot: string | null | undefined,
): boolean {
  return (
    chatsWorkspaceRoot != null && findProjectByPath([project], chatsWorkspaceRoot) !== undefined
  );
}

/** `environmentId:projectId` of every environment's Chats project, found by its folder. */
export function resolveChatsProjectKeys(
  projects: ReadonlyArray<Pick<EnvironmentProject, "environmentId" | "id" | "workspaceRoot">>,
  serverConfigs: ReadonlyMap<string, Pick<ServerConfig, "chatsWorkspaceRoot">>,
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const project of projects) {
    if (isChatsProject(project, serverConfigs.get(project.environmentId)?.chatsWorkspaceRoot)) {
      keys.add(scopedProjectKey(scopeProjectRef(project.environmentId, project.id)));
    }
  }
  return keys;
}

/** Threads in a Chats project are the Chat side; every other thread is the Code side. */
export function splitSidebarThreads<
  T extends { readonly environmentId: string; readonly projectId: string },
>(
  threads: readonly T[],
  chatsProjectKeys: ReadonlySet<string>,
): { chatThreads: readonly T[]; codeThreads: readonly T[] } {
  if (chatsProjectKeys.size === 0) return { chatThreads: [], codeThreads: threads };
  const chatThreads: T[] = [];
  const codeThreads: T[] = [];
  for (const thread of threads) {
    (chatsProjectKeys.has(`${thread.environmentId}:${thread.projectId}`)
      ? chatThreads
      : codeThreads
    ).push(thread);
  }
  return { chatThreads, codeThreads };
}

/**
 * Opening a thread reveals its side. Wait for navigation to finish before
 * syncing the switch, so the outgoing thread cannot undo a tab change.
 */
export function resolveSidebarSectionForNavigation(input: {
  previousThreadKey: string | null;
  currentThreadKey: string | null;
  /** null while the opened thread has not landed in the projection yet — an
      unclassifiable thread must never yank the switch to a guess. */
  currentThreadSection: "chat" | "code" | null;
  section: "chat" | "code";
}): "chat" | "code" | null {
  if (input.currentThreadKey === null) return null;
  if (input.currentThreadKey === input.previousThreadKey) return null;
  if (input.currentThreadSection === null) return null;
  return input.currentThreadSection === input.section ? null : input.currentThreadSection;
}

export function inferProjectTitleFromPath(value: string): string {
  const normalized = normalizeProjectPathForDispatch(value);
  const absolutePath = splitAbsolutePath(normalized);
  if (absolutePath) {
    return absolutePath.segments.findLast(Boolean) ?? normalized;
  }
  const segments = normalized.split(/[/\\]/);
  return segments.findLast(Boolean) ?? normalized;
}

export function appendBrowsePathSegment(currentPath: string, segment: string): string {
  const separator = preferredPathSeparator(currentPath);
  return `${getBrowseDirectoryPath(currentPath)}${segment}${separator}`;
}

export function getBrowseLeafPathSegment(currentPath: string): string {
  const lastSeparatorIndex = getLastPathSeparatorIndex(currentPath);
  return currentPath.slice(lastSeparatorIndex + 1);
}

export function getBrowseDirectoryPath(currentPath: string): string {
  if (hasTrailingPathSeparator(currentPath)) {
    return currentPath;
  }
  const lastSeparatorIndex = getLastPathSeparatorIndex(currentPath);
  return lastSeparatorIndex < 0 ? currentPath : currentPath.slice(0, lastSeparatorIndex + 1);
}

export function ensureBrowseDirectoryPath(currentPath: string): string {
  const trimmed = currentPath.trim();
  if (trimmed.length === 0 || hasTrailingPathSeparator(trimmed)) {
    return trimmed;
  }
  return `${trimmed}${preferredPathSeparator(trimmed)}`;
}

export function getBrowseParentPath(currentPath: string): string | null {
  const trimmed = normalizeProjectPathForDispatch(currentPath);
  const absolutePath = splitAbsolutePath(trimmed);
  if (absolutePath) {
    if (absolutePath.segments.length === 0) return null;
    if (absolutePath.segments.length === 1) return absolutePath.root;
    const parentSegments = absolutePath.segments.slice(0, -1).join(absolutePath.separator);
    return `${absolutePath.root}${parentSegments}${absolutePath.separator}`;
  }

  const separator = preferredPathSeparator(currentPath);
  const lastSeparatorIndex = getLastPathSeparatorIndex(trimmed);
  if (lastSeparatorIndex < 0) return null;
  if (lastSeparatorIndex === 2 && /^[a-zA-Z]:/.test(trimmed)) {
    return `${trimmed.slice(0, 2)}${separator}`;
  }
  return trimmed.slice(0, lastSeparatorIndex + 1);
}

export function canNavigateUp(currentPath: string): boolean {
  return hasTrailingPathSeparator(currentPath) && getBrowseParentPath(currentPath) !== null;
}

export * from "./projectCommands.ts";
export * from "./projectEntities.ts";
