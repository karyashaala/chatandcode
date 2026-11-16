// The sidebar owns the thread lists, so it registers the handler and the command
// palette runs it. On narrow screens a closed sidebar sheet unmounts, leaving none.
let handler: (() => void) | undefined;

/** Registers the "Next thread that needs you" handler; returns its unregister function. */
export function registerNextNeedsYou(next: () => void): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = undefined;
  };
}

export function runNextNeedsYou(): void {
  handler?.();
}

/** Whether a mounted sidebar can run the command; the palette hides it otherwise. */
export function hasNextNeedsYou(): boolean {
  return handler !== undefined;
}
