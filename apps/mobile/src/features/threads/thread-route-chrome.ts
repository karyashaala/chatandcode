/** Which coding chrome a thread screen shows: chats hide git, inspector, terminal and the project. */
export function resolveThreadRouteChrome(input: { readonly isChatThread: boolean }) {
  const isCodeThread = !input.isChatThread;
  return {
    showGitActions: isCodeThread,
    showInspector: isCodeThread,
    showTerminal: isCodeThread,
    showProjectSubtitle: isCodeThread,
  };
}

export type ThreadRouteChrome = ReturnType<typeof resolveThreadRouteChrome>;
