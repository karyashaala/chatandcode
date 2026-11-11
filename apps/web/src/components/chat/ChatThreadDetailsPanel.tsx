import type { EnvironmentId, ThreadId } from "@cctools/contracts";
import type { ComponentProps } from "react";

import { ThreadDetailsCard } from "./ThreadDetailsCard";
import { ThreadRelationshipsPanel } from "./ThreadRelationshipsControl";

/**
 * A chat's thread panel: only the helper agents it delegated to, or the chat
 * that delegated to it. The code panel's workspace and git sections stay out.
 */
export function ChatThreadDetailsPanel(
  props: Pick<ComponentProps<typeof ThreadDetailsCard>, "anchor" | "handle"> & {
    environmentId: EnvironmentId;
    threadId: ThreadId;
  },
) {
  return (
    <ThreadDetailsCard
      threadRef={{ environmentId: props.environmentId, threadId: props.threadId }}
      anchor={props.anchor}
      handle={props.handle}
      contentKey="lineage"
    >
      {() => (
        // A chat keeps its right panel closed, so side chats have nowhere to open.
        <ThreadRelationshipsPanel
          environmentId={props.environmentId}
          threadId={props.threadId}
          showLineage
          showSideChats={false}
        />
      )}
    </ThreadDetailsCard>
  );
}
