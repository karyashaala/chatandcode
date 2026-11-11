import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

// Serves the per-thread message_count lookup in ProjectionStore's selectShellThreadRows.
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE INDEX orchestration_v2_projection_turn_items_messages_idx
    ON orchestration_v2_projection_turn_items(thread_id, run_id)
    WHERE type IN ('user_message', 'assistant_message')
  `;
});
