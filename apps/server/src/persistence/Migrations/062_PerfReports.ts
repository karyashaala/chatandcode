import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS perf_reports (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      client_json TEXT NOT NULL,
      context_json TEXT NOT NULL,
      summary_json TEXT NOT NULL,
      samples_json TEXT NOT NULL
    )
  `;
});
