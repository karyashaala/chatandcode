import type * as Path from "effect/Path";

export const chatsWorkspaceRootFor = (path: Path.Path, stateDir: string) =>
  path.resolve(stateDir, "chats");
