import {
  threadRuntimeCanArchive,
  type ThreadRuntimeSummary,
} from "@cctools/client-runtime/state/models";

export function threadCanArchive(runtime: ThreadRuntimeSummary | null | undefined): boolean {
  return threadRuntimeCanArchive(runtime);
}
