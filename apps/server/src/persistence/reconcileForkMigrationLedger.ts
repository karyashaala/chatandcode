import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

const forkMigrations = [
  [41, "ProjectionThreadsParentThreadId"],
  [42, "ProjectionThreadHandoffs"],
  [43, "RepairProjectionMigrationCollision"],
  [44, "ProjectionThreadsLastMessagePreview"],
  [45, "AuthSessionClientConnection"],
  [46, "Feedback"],
  [47, "ProjectionThreadHandoffsMode"],
  [48, "PerfReports"],
  [49, "ProjectionThreadLinkedPullRequest"],
  [50, "ProjectionThreadsUnsettledAt"],
  [51, "ClearAutomaticProjectModelDefaults"],
  [52, "ProjectionProjectsAutoPull"],
  [53, "RepairAutomaticSettlementTimestamps"],
  [54, "ProjectionProjectIcon"],
  [55, "ProjectionThreadBranchPullRequest"],
  [56, "ProjectionThreadsActiveOrderKey"],
  [57, "ProjectionThreadPullRequests"],
  [58, "ProjectionThreadsChatSubMode"],
  [59, "ProjectionThreadsActivityCounts"],
] as const;

const sharedMigrationIds = new Map([
  [45, 41],
  [49, 42],
  [50, 43],
  [51, 44],
  [52, 45],
  [53, 46],
  [54, 47],
  [55, 48],
  [56, 49],
  [57, 50],
]);

// Remap only the known fork ledger, preserving its schema for the V1 importer.
export const reconcileForkMigrationLedger = Effect.fn("reconcileForkMigrationLedger")(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql.withTransaction(
    Effect.gen(function* () {
      const tables = yield* sql`
        SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'effect_sql_migrations'
      `;
      if (tables.length === 0) return;
      const history = yield* sql<{
        readonly migration_id: number;
        readonly name: string;
        readonly created_at: string;
      }>`
        SELECT migration_id, name, created_at FROM effect_sql_migrations
        WHERE migration_id >= 41 ORDER BY migration_id
      `;
      const isFork =
        history.length === forkMigrations.length &&
        history.every(
          (row, index) =>
            row.migration_id === forkMigrations[index]?.[0] &&
            row.name === forkMigrations[index]?.[1],
        );
      if (!isFork) return;
      yield* sql`DELETE FROM effect_sql_migrations WHERE migration_id >= 41`;
      for (const row of history) {
        const migrationId = sharedMigrationIds.get(row.migration_id);
        if (migrationId === undefined) continue;
        yield* sql`
          INSERT INTO effect_sql_migrations (migration_id, name, created_at)
          VALUES (${migrationId}, ${row.name}, ${row.created_at})
        `;
      }
    }),
  );
});
