import { assert, describe, it } from "@effect/vitest";
import * as NodeSqliteClient from "@cctools/shared/nodeSqliteClient";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

import { forkMigrationManifest, moveForkMigrationsToOwnLedger } from "./ForkMigrations.ts";
import Feedback from "./ForkMigrations/001_Feedback.ts";
import PerfReports from "./ForkMigrations/002_PerfReports.ts";
import ChatListMessageIndex from "./ForkMigrations/003_ChatListMessageIndex.ts";
import { migrationManifest, runMigrations } from "./Migrations.ts";

interface LedgerRow {
  readonly migration_id: number;
  readonly name: string;
  readonly created_at: string;
}

const ledgers = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  return {
    upstream: yield* sql<LedgerRow>`SELECT * FROM effect_sql_migrations ORDER BY migration_id`,
    fork: yield* sql<LedgerRow>`SELECT * FROM chatandcode_migrations ORDER BY migration_id`,
  };
});

describe("fork migration ledger", () => {
  it.effect("moves a pre-merge fork ledger out of upstream's ids and runs upstream's", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* runMigrations({ toMigrationInclusive: 60 });
      const upstreamHistory =
        yield* sql<LedgerRow>`SELECT * FROM effect_sql_migrations ORDER BY migration_id`;
      yield* Feedback;
      yield* PerfReports;
      yield* ChatListMessageIndex;
      yield* sql`
        INSERT INTO effect_sql_migrations (migration_id, name, created_at)
        VALUES
          (61, 'Feedback', '2026-10-10 00:00:61'),
          (62, 'PerfReports', '2026-10-10 00:00:62'),
          (63, 'ChatListMessageIndex', '2026-10-19 00:00:63')
      `;
      yield* sql`
        INSERT INTO feedback (id, kind, message, client_json, created_at)
        VALUES ('feedback-sentinel', 'bug', 'Keep this feedback', '{}', '2026-10-20')
      `;
      const feedback = yield* sql`SELECT * FROM feedback`;

      assert.deepStrictEqual(
        yield* runMigrations(),
        migrationManifest.filter(([id]) => id > 60),
      );
      const migrated = yield* ledgers;
      assert.deepStrictEqual(
        migrated.upstream.map((row) => [row.migration_id, row.name] as const),
        migrationManifest,
      );
      assert.deepStrictEqual(migrated.upstream.slice(0, 60), upstreamHistory);
      assert.deepStrictEqual(migrated.fork, [
        { migration_id: 1, name: "Feedback", created_at: "2026-10-10 00:00:61" },
        { migration_id: 2, name: "PerfReports", created_at: "2026-10-10 00:00:62" },
        { migration_id: 3, name: "ChatListMessageIndex", created_at: "2026-10-19 00:00:63" },
      ]);
      assert.deepStrictEqual(yield* sql`SELECT * FROM feedback`, feedback);

      assert.deepStrictEqual(yield* runMigrations(), []);
      assert.deepStrictEqual(yield* ledgers, migrated);
    }).pipe(Effect.provide(NodeSqliteClient.layer({ filename: ":memory:" }))),
  );

  it.effect("runs the fork's migrations in their own ledger on a fresh database", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      assert.deepStrictEqual(yield* runMigrations(), migrationManifest);
      const { fork } = yield* ledgers;
      assert.deepStrictEqual(
        fork.map((row) => [row.migration_id, row.name] as const),
        forkMigrationManifest,
      );
      assert.deepStrictEqual(
        yield* sql`
          SELECT name FROM sqlite_master
          WHERE name IN ('feedback', 'perf_reports', 'orchestration_v2_projection_turn_items_messages_idx')
          ORDER BY name
        `,
        [
          { name: "feedback" },
          { name: "orchestration_v2_projection_turn_items_messages_idx" },
          { name: "perf_reports" },
        ],
      );
    }).pipe(Effect.provide(NodeSqliteClient.layer({ filename: ":memory:" }))),
  );

  it.effect("leaves upstream's own migrations 61-63 in upstream's ledger", () =>
    Effect.gen(function* () {
      yield* runMigrations();
      const before = yield* ledgers;
      yield* moveForkMigrationsToOwnLedger();
      assert.deepStrictEqual(yield* ledgers, before);
    }).pipe(Effect.provide(NodeSqliteClient.layer({ filename: ":memory:" }))),
  );
});
