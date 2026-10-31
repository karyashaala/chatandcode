import type { ThreadDetailsPanelProps } from "./ThreadDetailsPanel";
import { ThreadDetailsCard } from "./ThreadDetailsCard";
import { ThreadRelationshipsPanel } from "./ThreadRelationshipsControl";

/**
 * A chat's thread panel: only the helper agents it delegated to, or the chat
 * that delegated to it. The code panel's workspace and git sections stay out.
 */
export function ChatThreadDetailsPanel(
  props: Pick<
    ThreadDetailsPanelProps,
    "anchor" | "handle" | "onPresentationChange" | "environmentId" | "threadId"
  >,
) {
  return (
    <ThreadDetailsCard
      threadRef={{ environmentId: props.environmentId, threadId: props.threadId }}
      anchor={props.anchor}
      handle={props.handle}
      onPresentationChange={props.onPresentationChange}
    >
      {() => (
        // The agents section leads this card, so it drops the divider it draws
        // below the code panel's workspace section.
        <div className="[&>section]:border-t-0">
          <ThreadRelationshipsPanel environmentId={props.environmentId} threadId={props.threadId} />
        </div>
      )}
    </ThreadDetailsCard>
  );
}
