import * as Effect from "effect/Effect";
import * as Migrator from "effect/sql/Migrator";
import * as SqlClient from "effect/sql/SqlClient";

import Feedback from "./ForkMigrations/001_Feedback.ts";
import PerfReports from "./ForkMigrations/002_PerfReports.ts";
import ChatListMessageIndex from "./ForkMigrations/003_ChatListMessageIndex.ts";

// ChatAndCode's own schema changes. They keep their own ledger so Migrations.ts stays exactly
// upstream's and upstream's ids never collide with ours. Add new fork migrations here, never there.
const FORK_MIGRATIONS_TABLE = "chatandcode_migrations";

const forkMigrationEntries = [
  [1, "Feedback", Feedback],
  [2, "PerfReports", PerfReports],
  [3, "ChatListMessageIndex", ChatListMessageIndex],
] as const;

export const forkMigrationManifest = forkMigrationEntries.map(([id, name]) => [id, name] as const);

const run = Migrator.make({});

/** Runs after upstream's migrations, because ChatListMessageIndex indexes an upstream table. */
export const runForkMigrations = Effect.fn("runForkMigrations")(function* () {
  return yield* run({
    table: FORK_MIGRATIONS_TABLE,
    loader: Migrator.fromRecord(
      Object.fromEntries(
        forkMigrationEntries.map(([id, name, migration]) => [`${id}_${name}`, migration]),
      ),
    ),
  });
});

// Builds before the 2026-10-30 upstream merge recorded these in upstream's ledger, at ids upstream
// has since given to its own migrations.
const upstreamLedgerRows = [
  [61, "Feedback", 1],
  [62, "PerfReports", 2],
  [63, "ChatListMessageIndex", 3],
] as const;

/** Moves those rows into the fork ledger, keeping their timestamps. Changes no schema or data. */
export const moveForkMigrationsToOwnLedger = Effect.fn("moveForkMigrationsToOwnLedger")(
  function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql.withTransaction(
      Effect.gen(function* () {
        const tables = yield* sql`
          SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'effect_sql_migrations'
        `;
        if (tables.length === 0) return;
        const recorded = yield* sql<{
          readonly migration_id: number;
          readonly name: string;
          readonly created_at: string;
        }>`
          SELECT migration_id, name, created_at FROM effect_sql_migrations
          WHERE migration_id BETWEEN 61 AND 63
        `;
        const moves = upstreamLedgerRows.flatMap(([upstreamId, name, forkId]) => {
          const row = recorded.find(
            (candidate) => candidate.migration_id === upstreamId && candidate.name === name,
          );
          return row === undefined ? [] : [{ upstreamId, name, forkId, createdAt: row.created_at }];
        });
        if (moves.length === 0) return;
        // Same shape the Migrator creates for SQLite, so it adopts this table as its own.
        yield* sql`
          CREATE TABLE IF NOT EXISTS ${sql(FORK_MIGRATIONS_TABLE)} (
            migration_id integer PRIMARY KEY NOT NULL,
            created_at datetime NOT NULL DEFAULT current_timestamp,
            name VARCHAR(255) NOT NULL
          )
        `;
        for (const move of moves) {
          yield* sql`
            INSERT OR IGNORE INTO ${sql(FORK_MIGRATIONS_TABLE)} (migration_id, name, created_at)
            VALUES (${move.forkId}, ${move.name}, ${move.createdAt})
          `;
          yield* sql`
            DELETE FROM effect_sql_migrations
            WHERE migration_id = ${move.upstreamId} AND name = ${move.name}
          `;
        }
      }),
    );
  },
);
