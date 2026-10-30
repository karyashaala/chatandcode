import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      message TEXT NOT NULL,
      client_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS feedback_attachments (
      feedback_id TEXT NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
      attachment_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      relative_path TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (feedback_id, attachment_id)
    )
  `;
});
